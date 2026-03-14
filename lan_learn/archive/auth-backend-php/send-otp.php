<?php
/**
 * Send OTP endpoint — generates 4-digit OTP, saves to MySQL, sends via SMTP.
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
    require_once __DIR__ . '/smtp-mailer.php';

    $data  = json_decode(file_get_contents('php://input'), true);
    $email = isset($data['email']) ? trim($data['email']) : '';

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Enter a valid email address.']);
        exit;
    }

    // Generate 4-digit OTP
    $otp = str_pad((string)random_int(0, 9999), 4, '0', STR_PAD_LEFT);

    // Save to MySQL
    saveOtpCode($email, $otp, 300);

    // Send via SMTP
    sendOtpEmail($email, $otp);

    echo json_encode(['success' => true, 'message' => 'OTP sent successfully to your email.']);

} catch (Throwable $e) {
    http_response_code(500);
    
    // Classify the error for a useful client message
    $msg = $e->getMessage();
    if (stripos($msg, 'Access denied') !== false || stripos($msg, 'SQLSTATE') !== false) {
        $clientMsg = 'Database connection failed. Please contact support.';
    } elseif (stripos($msg, 'SMTP') !== false || stripos($msg, 'fsockopen') !== false) {
        $clientMsg = 'Email service unavailable. Please try again later.';
    } else {
        $clientMsg = 'Failed to send OTP. Please try again.';
    }

    $resp = ['success' => false, 'message' => $clientMsg];

    // Show full error detail on localhost
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if (in_array($ip, ['127.0.0.1', '::1'], true)) {
        $resp['error_detail'] = $msg;
        $resp['error_file']   = $e->getFile() . ':' . $e->getLine();
    }

    echo json_encode($resp);
}
