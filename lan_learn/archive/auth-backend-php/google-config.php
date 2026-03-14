<?php
require_once __DIR__ . '/env-loader.php';
loadEnv(__DIR__ . '/../.env');

function getGoogleOAuthConfig(): array
{
    $clientId     = env('GOOGLE_CLIENT_ID');
    $clientSecret = env('GOOGLE_CLIENT_SECRET');
    $redirectUri  = env('GOOGLE_REDIRECT_URI');

    // Build redirect URI from current host if env is not configured.
    if ($redirectUri === '') {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $redirectUri = $scheme . '://' . $host . '/lan_learn/auth-backend/google-callback.php';
    }

    return [
        'client_id'     => $clientId,
        'client_secret' => $clientSecret,
        'redirect_uri'  => $redirectUri,
        'auth_url'      => 'https://accounts.google.com/o/oauth2/v2/auth',
        'token_url'     => 'https://oauth2.googleapis.com/token',
        'userinfo_url'  => 'https://www.googleapis.com/oauth2/v3/userinfo'
    ];
}
