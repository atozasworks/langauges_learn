<?php
/**
 * Save Google login endpoint — verifies access token and saves to MySQL.
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

    $data        = json_decode(file_get_contents('php://input'), true);
    $accessToken = isset($data['accessToken']) ? trim($data['accessToken']) : '';

    if ($accessToken === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Access token is required.']);
        exit;
    }

    // Verify token with Google
    $ctx = stream_context_create([
        'http' => [
            'method'  => 'GET',
            'header'  => "Authorization: Bearer {$accessToken}\r\n",
            'timeout' => 15,
        ],
    ]);
    $raw = @file_get_contents('https://www.googleapis.com/oauth2/v3/userinfo', false, $ctx);

    if ($raw === false) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Failed to verify Google token.']);
        exit;
    }

    $profile = json_decode($raw, true);
    $email   = trim($profile['email'] ?? '');
    $name    = trim($profile['name']  ?? '');
    $sub     = trim($profile['sub']   ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $sub === '') {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid Google user profile.']);
        exit;
    }

    // Save to MySQL
    saveLoginAudit([
        'email'            => $email,
        'login_method'     => 'google',
        'provider_user_id' => $sub,
        'display_name'     => $name,
        'login_status'     => 'success',
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Google login saved successfully.',
        'user'    => [
            'email'   => $email,
            'name'    => $name,
            'sub'     => $sub,
            'picture' => $profile['picture'] ?? '',
        ],
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    $resp = ['success' => false, 'message' => 'Google login save failed.'];

    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if (in_array($ip, ['127.0.0.1', '::1'], true)) {
        $resp['error_detail'] = $e->getMessage();
    }

    echo json_encode($resp);
}
