<?php
/**
 * Verify OTP and log user in. Sets session and returns user info.
 */

header('Content-Type: application/json');

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session.php';

$input = json_decode(file_get_contents('php://input') ?: '{}', true) ?: [];
$email = isset($input['email']) ? trim($input['email']) : '';
$otp = isset($input['otp']) ? preg_replace('/\D/', '', $input['otp']) : '';

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Valid email is required']);
    exit;
}

if (strlen($otp) !== 6) {
    echo json_encode(['success' => false, 'message' => 'Invalid or expired code']);
    exit;
}

$stmt = $pdo->prepare('SELECT id, name, email, otp, otp_expires_at FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user || $user['otp'] !== $otp) {
    echo json_encode(['success' => false, 'message' => 'Invalid or expired code']);
    exit;
}

if (strtotime($user['otp_expires_at']) < time()) {
    $pdo->prepare('UPDATE users SET otp = NULL, otp_expires_at = NULL WHERE id = ?')->execute([$user['id']]);
    echo json_encode(['success' => false, 'message' => 'Code has expired. Please request a new one.']);
    exit;
}

$pdo->prepare('UPDATE users SET otp = NULL, otp_expires_at = NULL WHERE id = ?')->execute([$user['id']]);

$userData = [
    'id'    => (int) $user['id'],
    'name'  => $user['name'] ?? '',
    'email' => $user['email'],
];

auth_set_user($userData);

echo json_encode([
    'success' => true,
    'user'    => $userData,
]);
exit;
