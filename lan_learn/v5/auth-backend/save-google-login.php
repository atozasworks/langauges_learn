<?php
/**
 * Save Google login endpoint — verifies access token and saves to MongoDB.
 */

// Show errors for debugging (remove in production)
ini_set('display_errors', 1);
error_reporting(E_ALL);

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
    $data        = json_decode(file_get_contents('php://input'), true);
    $accessToken = isset($data['accessToken']) ? trim($data['accessToken']) : '';

    if ($accessToken === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Access token is required.']);
        exit;
    }

    // Verify token with Google (try cURL first, fallback to file_get_contents)
    $raw = false;

    // Method 1: cURL (works on most live servers)
    if (function_exists('curl_init')) {
        $ch = curl_init('https://www.googleapis.com/oauth2/v3/userinfo');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => ["Authorization: Bearer {$accessToken}"],
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $raw = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($raw === false || $httpCode !== 200) {
            $raw = false; // fallback to file_get_contents
            error_log("Google userinfo cURL failed: HTTP {$httpCode}, error: {$curlErr}");
        }
    }

    // Method 2: file_get_contents fallback (works when cURL is unavailable)
    if ($raw === false) {
        $ctx = stream_context_create([
            'http' => [
                'method'  => 'GET',
                'header'  => "Authorization: Bearer {$accessToken}\r\n",
                'timeout' => 15,
            ],
        ]);
        $raw = @file_get_contents('https://www.googleapis.com/oauth2/v3/userinfo', false, $ctx);
    }

    if ($raw === false) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to verify Google token.',
            'debug'   => [
                'curl_available' => function_exists('curl_init'),
                'allow_url_fopen' => ini_get('allow_url_fopen'),
            ]
        ]);
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

    // Try to save to MongoDB (optional — don't block login if DB is unavailable)
    $dbSaved = false;
    try {
        require_once __DIR__ . '/db.php';
        saveLoginAudit([
            'email'            => $email,
            'login_method'     => 'google',
            'provider_user_id' => $sub,
            'display_name'     => $name,
            'login_status'     => 'success',
        ]);
        $dbSaved = true;
    } catch (Throwable $dbErr) {
        // DB save failed — log it but don't block Google login
        error_log('Google login DB save failed: ' . $dbErr->getMessage());
    }

    echo json_encode([
        'success' => true,
        'message' => $dbSaved ? 'Google login saved successfully.' : 'Google login verified (DB save skipped).',
        'user'    => [
            'email'   => $email,
            'name'    => $name,
            'sub'     => $sub,
            'picture' => $profile['picture'] ?? '',
        ],
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    $resp = ['success' => false, 'message' => 'Google login failed: ' . $e->getMessage()];

    echo json_encode($resp);
}
