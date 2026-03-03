<?php
/**
 * Google OAuth config loader.
 */
$config = [];

$examplePath = __DIR__ . '/google-config.example.php';
if (file_exists($examplePath)) {
    $config = require $examplePath;
}

$localPath = __DIR__ . '/google-config.local.php';
if (file_exists($localPath)) {
    $localConfig = require $localPath;
    if (is_array($localConfig)) {
        $config = array_merge($config, $localConfig);
    }
}

$envClientId = getenv('GOOGLE_CLIENT_ID');
if ($envClientId !== false && $envClientId !== '') {
    $config['client_id'] = $envClientId;
}

$envClientSecret = getenv('GOOGLE_CLIENT_SECRET');
if ($envClientSecret !== false && $envClientSecret !== '') {
    $config['client_secret'] = $envClientSecret;
}

$envRedirectUri = getenv('GOOGLE_REDIRECT_URI');
if ($envRedirectUri !== false && trim($envRedirectUri) !== '') {
    $config['redirect_uri'] = trim($envRedirectUri);
}

$config['client_id'] = trim((string)($config['client_id'] ?? ''));
$config['client_secret'] = trim((string)($config['client_secret'] ?? ''));
$config['redirect_uri'] = trim((string)($config['redirect_uri'] ?? ''));

return $config;
