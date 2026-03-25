<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$google = app_config()['google'];

if (empty($google['client_id']) || empty($google['redirect_uri'])) {
    auth_log('Google OAuth is not configured correctly. Missing client_id or redirect_uri.');
    redirect_to('/login.php?error=google_failed');
}

$state = bin2hex(random_bytes(16));
$_SESSION['google_oauth_state'] = $state;

$params = [
    'client_id' => $google['client_id'],
    'redirect_uri' => $google['redirect_uri'],
    'response_type' => 'code',
    'scope' => 'openid email profile',
    'state' => $state,
    'prompt' => 'select_account',
];

$authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($params);
header('Location: ' . $authUrl);
exit;
