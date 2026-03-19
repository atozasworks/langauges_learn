<?php
/**
 * otp-verify.php – Verify the OTP entered by the user.
 *
 * Accepts POST JSON: { "email": "...", "otp": "123456", "csrf_token": "..." }
 * Returns JSON: { "success": true/false, "message": "...", "redirect": "dashboard.php" }
 */

// Suppress PHP errors from appearing as HTML in JSON responses
error_reporting(0);
ini_set('display_errors', '0');

require_once __DIR__ . '/config.php';

startSecureSession();

// ── Only accept POST ───────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Invalid request method.'], 405);
}

// ── Parse JSON body ────────────────────────────────────────────
$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');
$otp   = trim($input['otp'] ?? '');
$csrfToken = $input['csrf_token'] ?? '';

// ── CSRF validation ────────────────────────────────────────────
if (!validateCSRFToken($csrfToken)) {
    jsonResponse(['success' => false, 'message' => 'Invalid session. Please refresh the page.'], 403);
}

// ── Validate inputs ────────────────────────────────────────────
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['success' => false, 'message' => 'Invalid email address.'], 400);
}
if (!preg_match('/^\d{' . OTP_LENGTH . '}$/', $otp)) {
    jsonResponse(['success' => false, 'message' => 'OTP must be a ' . OTP_LENGTH . '-digit number.'], 400);
}

$db  = getDB();
$now = date('Y-m-d H:i:s');

// ── Fetch the latest unused, non-expired OTP for this email ────
$stmt = $db->prepare(
    "SELECT id, otp_hash, expires_at, attempts
     FROM email_otps
     WHERE email = :email AND used_at IS NULL AND expires_at > :now
     ORDER BY id DESC
     LIMIT 1"
);
$stmt->execute([':email' => $email, ':now' => $now]);
$record = $stmt->fetch();

if (!$record) {
    jsonResponse(['success' => false, 'message' => 'No valid OTP found. Please request a new one.'], 400);
}

// ── Check max attempts ─────────────────────────────────────────
if ((int)$record['attempts'] >= OTP_MAX_VERIFY_ATTEMPTS) {
    // Mark OTP as used (burned) so it can't be tried again
    $stmt = $db->prepare("UPDATE email_otps SET used_at = :now WHERE id = :id");
    $stmt->execute([':now' => $now, ':id' => $record['id']]);
    jsonResponse(['success' => false, 'message' => 'Too many attempts. Please request a new OTP.'], 429);
}

// ── Increment attempt counter ──────────────────────────────────
$stmt = $db->prepare("UPDATE email_otps SET attempts = attempts + 1 WHERE id = :id");
$stmt->execute([':id' => $record['id']]);

// ── Verify the OTP hash ────────────────────────────────────────
if (!password_verify($otp, $record['otp_hash'])) {
    $remaining = OTP_MAX_VERIFY_ATTEMPTS - (int)$record['attempts'] - 1;
    jsonResponse([
        'success' => false,
        'message' => "Invalid OTP. {$remaining} attempt(s) remaining."
    ], 400);
}

// ── Mark OTP as used ───────────────────────────────────────────
$stmt = $db->prepare("UPDATE email_otps SET used_at = :now WHERE id = :id");
$stmt->execute([':now' => $now, ':id' => $record['id']]);

// ── Find or create user ────────────────────────────────────────
$stmt = $db->prepare("SELECT * FROM users WHERE email = :email LIMIT 1");
$stmt->execute([':email' => $email]);
$user = $stmt->fetch();

if ($user) {
    // Update auth_provider if they previously only used Google
    if ($user['auth_provider'] === 'google') {
        $stmt = $db->prepare("UPDATE users SET auth_provider = 'both', updated_at = :now WHERE id = :id");
        $stmt->execute([':now' => $now, ':id' => $user['id']]);
    }
    // Update last login
    $stmt = $db->prepare("UPDATE users SET last_login_at = :now WHERE id = :id");
    $stmt->execute([':now' => $now, ':id' => $user['id']]);
} else {
    // Create new user (auto-registration on first login)
    $stmt = $db->prepare(
        "INSERT INTO users (email, auth_provider, is_verified, created_at, last_login_at)
         VALUES (:email, 'email_otp', 1, :now1, :now2)"
    );
    $stmt->execute([':email' => $email, ':now1' => $now, ':now2' => $now]);

    $stmt = $db->prepare("SELECT * FROM users WHERE id = :id");
    $stmt->execute([':id' => $db->lastInsertId()]);
    $user = $stmt->fetch();
}

// ── Audit log ──────────────────────────────────────────────────
$stmt = $db->prepare(
    "INSERT INTO login_audit (user_id, method, ip_address, user_agent, created_at)
     VALUES (:uid, 'email_otp', :ip, :ua, :now)"
);
$stmt->execute([
    ':uid' => $user['id'],
    ':ip'  => getClientIP(),
    ':ua'  => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500),
    ':now' => $now,
]);

// ── Create session ─────────────────────────────────────────────
session_regenerate_id(true);

$_SESSION['user_id']   = (int)$user['id'];
$_SESSION['email']     = $user['email'];
$_SESSION['name']      = $user['name'] ?? '';
$_SESSION['provider']  = $user['auth_provider'];
$_SESSION['logged_in'] = true;

jsonResponse([
    'success'  => true,
    'message'  => 'Login successful!',
    'redirect' => '/spokenenglish/AtoZ_Services/lan_learn/index.php'
]);
