<?php

function getGoogleOAuthConfig(): array
{
    $clientIdFromEnv = getenv('GOOGLE_CLIENT_ID') ?: '';
    $clientSecretFromEnv = getenv('GOOGLE_CLIENT_SECRET') ?: '';
    $redirectUriFromEnv = getenv('GOOGLE_REDIRECT_URI') ?: '';

    $defaultClientId = '444024521791-26vj3nj553l540pjhofsgnk9tv2du5gh.apps.googleusercontent.com';

    // Build redirect URI from current host if env is not configured.
    if ($redirectUriFromEnv === '') {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $redirectUriFromEnv = $scheme . '://' . $host . '/lan_learn/auth-backend/google-callback.php';
    }

    return [
        'client_id' => $clientIdFromEnv !== '' ? $clientIdFromEnv : $defaultClientId,
        'client_secret' => $clientSecretFromEnv,
        'redirect_uri' => $redirectUriFromEnv,
        'auth_url' => 'https://accounts.google.com/o/oauth2/v2/auth',
        'token_url' => 'https://oauth2.googleapis.com/token',
        'userinfo_url' => 'https://www.googleapis.com/oauth2/v3/userinfo'
    ];
}
