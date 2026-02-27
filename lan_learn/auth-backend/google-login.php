<?php
/**
 * Redirect user to Google OAuth consent screen.
 */

require_once __DIR__ . '/session.php';

$config = require __DIR__ . '/google-config.php';
$clientId = $config['client_id'] ?? '';

if (empty($clientId)) {
    header('Location: ../index.html?error=google_not_configured');
    exit;
}

$base = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http')
    . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost')
    . dirname($_SERVER['REQUEST_URI'] ?? '/auth-backend');
$redirectUri = rtrim($base, '/') . '/google-callback.php';

$state = bin2hex(random_bytes(16));
$_SESSION['oauth_state'] = $state;

$params = [
    'client_id'     => $clientId,
    'redirect_uri'  => $redirectUri,
    'response_type' => 'code',
    'scope'         => 'openid email profile',
    'state'         => $state,
    'access_type'   => 'offline',
    'prompt'        => 'consent',
];
$url = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($params);
header('Location: ' . $url);
exit;
