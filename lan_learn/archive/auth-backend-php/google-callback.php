<?php
session_start();
require_once __DIR__ . '/google-config.php';

$config = getGoogleOAuthConfig();

if (empty($_GET['code']) || empty($_GET['state'])) {
    http_response_code(400);
    echo 'Invalid Google callback.';
    exit;
}

if (!isset($_SESSION['google_oauth_state']) || $_GET['state'] !== $_SESSION['google_oauth_state']) {
    http_response_code(400);
    echo 'State validation failed.';
    exit;
}

unset($_SESSION['google_oauth_state']);

if ($config['client_secret'] === '') {
    http_response_code(500);
    echo 'Google Client Secret missing. Set GOOGLE_CLIENT_SECRET in environment.';
    exit;
}

$tokenRequestBody = [
    'code' => $_GET['code'],
    'client_id' => $config['client_id'],
    'client_secret' => $config['client_secret'],
    'redirect_uri' => $config['redirect_uri'],
    'grant_type' => 'authorization_code'
];

$curl = curl_init($config['token_url']);
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
    CURLOPT_POSTFIELDS => http_build_query($tokenRequestBody)
]);

$tokenResponseRaw = curl_exec($curl);
$tokenHttpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

$tokenResponse = json_decode($tokenResponseRaw, true);

if ($tokenHttpCode !== 200 || empty($tokenResponse['access_token'])) {
    http_response_code(401);
    echo 'Failed to get access token from Google.';
    exit;
}

$accessToken = $tokenResponse['access_token'];

$userCurl = curl_init($config['userinfo_url']);
curl_setopt_array($userCurl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken]
]);

$userResponseRaw = curl_exec($userCurl);
$userHttpCode = curl_getinfo($userCurl, CURLINFO_HTTP_CODE);
curl_close($userCurl);

$userProfile = json_decode($userResponseRaw, true);

if ($userHttpCode !== 200 || empty($userProfile['email'])) {
    http_response_code(401);
    echo 'Failed to fetch Google user profile.';
    exit;
}

$_SESSION['auth_user'] = [
    'email' => $userProfile['email'],
    'name' => $userProfile['name'] ?? '',
    'picture' => $userProfile['picture'] ?? ''
];

header('Location: ../login-modal.html?google=success');
exit;
