<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

$email = strtolower(trim((string) ($_POST['email'] ?? '')));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['ok' => false, 'message' => 'Please enter a valid email address.'], 422);
}

try {
    $otp = create_email_otp($email);
    $subject = 'Your GTongue Learn OTP Code';
    $body = '<div style="font-family:Arial,sans-serif;line-height:1.5">'
        . '<h2>Login OTP</h2>'
        . '<p>Your verification code is:</p>'
        . '<p style="font-size:28px;font-weight:bold;letter-spacing:4px">' . htmlspecialchars($otp, ENT_QUOTES, 'UTF-8') . '</p>'
        . '<p>This code expires in 5 minutes.</p>'
        . '</div>';

    send_email_smtp($email, $subject, $body);
    json_response(['ok' => true, 'message' => 'OTP sent to your email.']);
} catch (Throwable $e) {
    auth_log('OTP send failed for ' . $email . ' :: ' . $e->getMessage());
    $msg = 'Failed to send OTP. Check SMTP settings.';
    if (app_debug()) {
        $msg .= ' Error: ' . $e->getMessage();
    }
    json_response(['ok' => false, 'message' => $msg], 500);
}