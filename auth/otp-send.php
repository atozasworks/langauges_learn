<?php
/**
 * otp-send.php – Generate and send a 6-digit OTP to the user's email.
 *
 * Accepts POST JSON: { "email": "user@example.com", "csrf_token": "..." }
 * Returns JSON: { "success": true/false, "message": "..." }
 */

// Suppress PHP errors from appearing as HTML in JSON responses
error_reporting(0);
ini_set('display_errors', '0');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mail-config.php';

// PHPMailer autoload
require_once __DIR__ . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

startSecureSession();

// ── Only accept POST ───────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Invalid request method.'], 405);
}

// ── Parse JSON body ────────────────────────────────────────────
$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');
$csrfToken = $input['csrf_token'] ?? '';

// ── CSRF validation ────────────────────────────────────────────
if (!validateCSRFToken($csrfToken)) {
    jsonResponse(['success' => false, 'message' => 'Invalid session. Please refresh the page.'], 403);
}

// ── Validate email ─────────────────────────────────────────────
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['success' => false, 'message' => 'Please enter a valid email address.'], 400);
}

$db = getDB();
$ip = getClientIP();
$now = date('Y-m-d H:i:s');

// ── Rate limiting: by email ────────────────────────────────────
$windowStart = date('Y-m-d H:i:s', strtotime("-" . RATE_LIMIT_WINDOW_MINUTES . " minutes"));

$stmt = $db->prepare(
    "SELECT COUNT(*) FROM otp_rate_limits WHERE identifier = :id AND request_time > :window"
);
$stmt->execute([':id' => $email, ':window' => $windowStart]);
if ((int)$stmt->fetchColumn() >= RATE_LIMIT_MAX_REQUESTS) {
    jsonResponse(['success' => false, 'message' => 'Too many OTP requests. Please try again later.'], 429);
}

// ── Rate limiting: by IP ───────────────────────────────────────
$stmt = $db->prepare(
    "SELECT COUNT(*) FROM otp_rate_limits WHERE identifier = :id AND request_time > :window"
);
$stmt->execute([':id' => $ip, ':window' => $windowStart]);
if ((int)$stmt->fetchColumn() >= RATE_LIMIT_MAX_REQUESTS * 2) {
    jsonResponse(['success' => false, 'message' => 'Too many requests from your network. Please try again later.'], 429);
}

// ── Resend cooldown: check last OTP sent to this email ─────────
$stmt = $db->prepare(
    "SELECT created_at FROM email_otps WHERE email = :email ORDER BY id DESC LIMIT 1"
);
$stmt->execute([':email' => $email]);
$lastOtp = $stmt->fetch();

if ($lastOtp) {
    $secondsSinceLast = time() - strtotime($lastOtp['created_at']);
    if ($secondsSinceLast < OTP_RESEND_COOLDOWN_SECONDS) {
        $remaining = OTP_RESEND_COOLDOWN_SECONDS - $secondsSinceLast;
        jsonResponse([
            'success' => false,
            'message' => "Please wait {$remaining} seconds before requesting a new OTP.",
            'cooldown' => $remaining
        ], 429);
    }
}

// ── Generate OTP ───────────────────────────────────────────────
$otp = str_pad((string)random_int(0, 999999), OTP_LENGTH, '0', STR_PAD_LEFT);
$otpHash = password_hash($otp, PASSWORD_DEFAULT);
$expiresAt = date('Y-m-d H:i:s', strtotime("+".OTP_EXPIRY_MINUTES." minutes"));

// ── Save hashed OTP to database ────────────────────────────────
$stmt = $db->prepare(
    "INSERT INTO email_otps (email, otp_hash, expires_at, ip_address, created_at)
     VALUES (:email, :otp_hash, :expires_at, :ip, :created)"
);
$stmt->execute([
    ':email'      => $email,
    ':otp_hash'   => $otpHash,
    ':expires_at'  => $expiresAt,
    ':ip'         => $ip,
    ':created'    => $now,
]);

// ── Record rate-limit hits ─────────────────────────────────────
$stmt = $db->prepare(
    "INSERT INTO otp_rate_limits (identifier, request_time) VALUES (:id, :time)"
);
$stmt->execute([':id' => $email, ':time' => $now]);
$stmt->execute([':id' => $ip, ':time' => $now]);

// ── Send email via PHPMailer ───────────────────────────────────
try {
    $mail = new PHPMailer(true);

    // SMTP settings
    $mail->isSMTP();
    $mail->Host       = SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = SMTP_USERNAME;
    $mail->Password   = SMTP_PASSWORD;
    $mail->SMTPSecure = SMTP_ENCRYPTION;
    $mail->Port       = SMTP_PORT;

    // Sender / recipient
    $mail->setFrom(MAIL_FROM_EMAIL, MAIL_FROM_NAME);
    $mail->addAddress($email);

    // Content
    $mail->isHTML(true);
    $mail->Subject = 'Your Login OTP – ' . SITE_NAME;
    $mail->Body    = getOtpEmailBody($otp);
    $mail->AltBody = "Your OTP is: {$otp}\nThis code expires in " . OTP_EXPIRY_MINUTES . " minutes.\nIf you did not request this, please ignore this email.";

    $mail->send();

    jsonResponse([
        'success'  => true,
        'message'  => 'OTP sent to your email.',
        'cooldown' => OTP_RESEND_COOLDOWN_SECONDS
    ]);

} catch (Exception $e) {
    // Log error server-side; don't expose details to client
    error_log('PHPMailer Error: ' . $e->getMessage());
    jsonResponse(['success' => false, 'message' => 'Failed to send OTP email. Please try again.'], 500);
}

// ── Email HTML template ────────────────────────────────────────
function getOtpEmailBody(string $otp): string {
    $siteName = SITE_NAME;
    $expiry   = OTP_EXPIRY_MINUTES;
    return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="420" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="text-align:center;">
          <h2 style="color:#333;margin:0 0 8px;">{$siteName}</h2>
          <p style="color:#666;font-size:15px;margin:0 0 24px;">Your one-time login code</p>
          <div style="background:#f0f4ff;border-radius:8px;padding:20px;margin:0 0 24px;">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#4f46e5;">{$otp}</span>
          </div>
          <p style="color:#666;font-size:14px;margin:0 0 8px;">This code expires in <strong>{$expiry} minutes</strong>.</p>
          <p style="color:#999;font-size:13px;margin:24px 0 0;">If you did not request this, please ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;
}
