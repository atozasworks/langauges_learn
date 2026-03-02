<?php
session_start();
require_once __DIR__ . '/google-config.php';

$config = getGoogleOAuthConfig();

if ($config['client_id'] === '') {
    http_response_code(500);
    echo 'Google Client ID is missing.';
    exit;
}

$state = bin2hex(random_bytes(16));
$_SESSION['google_oauth_state'] = $state;

$params = [
    'client_id' => $config['client_id'],
    'redirect_uri' => $config['redirect_uri'],
    'response_type' => 'code',
    'scope' => 'openid email profile',
    'access_type' => 'online',
    'include_granted_scopes' => 'true',
    'state' => $state,
    'prompt' => 'select_account'
];

$googleAuthUrl = $config['auth_url'] . '?' . http_build_query($params);
header('Location: ' . $googleAuthUrl);
exit;
