<?php
/**
 * Verify OTP endpoint — checks OTP against JSON store, saves login_audit on success.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed. Use POST.']);
    exit;
}

try {
    require_once __DIR__ . '/db.php';

    $data  = json_decode(file_get_contents('php://input'), true);
    $email = isset($data['email']) ? trim($data['email']) : '';
    $otp   = isset($data['otp'])   ? trim($data['otp'])   : '';

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Enter a valid email address.']);
        exit;
    }

    if (!preg_match('/^\d{4}$/', $otp)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'OTP must be exactly 4 digits.']);
        exit;
    }

    if (!verifyOtpCode($email, $otp)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired OTP.']);
        exit;
    }

    // OTP correct — save login audit
    saveLoginAudit([
        'email'            => $email,
        'login_method'     => 'otp',
        'provider_user_id' => null,
        'display_name'     => null,
        'login_status'     => 'success',
    ]);

    echo json_encode(['success' => true, 'message' => 'OTP verified. Login successful.']);

} catch (Throwable $e) {
    http_response_code(500);
    $resp = ['success' => false, 'message' => 'OTP verification failed.'];

    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if (in_array($ip, ['127.0.0.1', '::1'], true)) {
        $resp['error_detail'] = $e->getMessage();
    }

    echo json_encode($resp);
}
