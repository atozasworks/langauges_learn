<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

$email = strtolower(trim((string) ($_POST['email'] ?? '')));
$otp = trim((string) ($_POST['otp'] ?? ''));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['ok' => false, 'message' => 'Invalid email.'], 422);
}

if (!preg_match('/^\d{6}$/', $otp)) {
    json_response(['ok' => false, 'message' => 'OTP must be 6 digits.'], 422);
}

if (!verify_email_otp($email, $otp)) {
    json_response(['ok' => false, 'message' => 'Invalid or expired OTP.'], 401);
}

$user = find_or_create_user($email, 'email', explode('@', $email)[0], null);
set_user_session($user);

json_response(['ok' => true, 'message' => 'Login successful.', 'redirect' => app_base_url() . '/index.php']);