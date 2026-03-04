<?php
/**
 * Send OTP to email. Creates user if not exists. OTP expires in 10 minutes.
 */

header('Content-Type: application/json');

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/smtp-mailer.php';

$input = json_decode(file_get_contents('php://input') ?: '{}', true) ?: [];
$email = isset($input['email']) ? trim($input['email']) : '';

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Valid email is required']);
    exit;
}

$otp = (string) random_int(100000, 999999);
$expiresAt = date('Y-m-d H:i:s', time() + 600); // 10 minutes

$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if ($row) {
    $pdo->prepare('UPDATE users SET otp = ?, otp_expires_at = ? WHERE id = ?')
        ->execute([$otp, $expiresAt, $row['id']]);
} else {
    $pdo->prepare('INSERT INTO users (name, email, otp, otp_expires_at, created_at) VALUES (\'\', ?, ?, ?, NOW())')
        ->execute([$email, $otp, $expiresAt]);
}

$subject = 'Your login code - GTongue Learn';
$body = "Your one-time login code is: $otp\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.";

$result = smtp_send($email, $subject, $body);

if (!$result['success']) {
    echo json_encode(['success' => false, 'message' => $result['message'] ?: 'Failed to send email']);
    exit;
}

echo json_encode(['success' => true, 'message' => 'OTP sent']);
exit;
