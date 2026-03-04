<?php
/**
 * Google OAuth callback: exchange code for token, get user info, create/update user, set session.
 */

require_once __DIR__ . '/session.php';
require_once __DIR__ . '/db.php';

$config = require __DIR__ . '/google-config.php';
$clientId = $config['client_id'] ?? '';
$clientSecret = $config['client_secret'] ?? '';

$baseUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http')
    . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost')
    . dirname($_SERVER['REQUEST_URI'] ?? '/auth-backend');
$redirectUri = rtrim($baseUrl, '/') . '/google-callback.php';

$errorUrl = '../index.html?error=google_login_failed';

if (empty($_GET['code']) || empty($_GET['state'])) {
    header('Location: ' . $errorUrl);
    exit;
}

if (empty($_SESSION['oauth_state']) || $_GET['state'] !== $_SESSION['oauth_state']) {
    header('Location: ' . $errorUrl);
    exit;
}

unset($_SESSION['oauth_state']);

$code = $_GET['code'];

$tokenResp = @file_get_contents('https://oauth2.googleapis.com/token', false, stream_context_create([
    'http' => [
        'method'  => 'POST',
        'header'  => 'Content-Type: application/x-www-form-urlencoded',
        'content' => http_build_query([
            'code'          => $code,
            'client_id'     => $clientId,
            'client_secret' => $clientSecret,
            'redirect_uri'  => $redirectUri,
            'grant_type'    => 'authorization_code',
        ]),
    ],
]));

if ($tokenResp === false) {
    header('Location: ' . $errorUrl);
    exit;
}

$token = json_decode($tokenResp, true);
if (empty($token['access_token'])) {
    header('Location: ' . $errorUrl);
    exit;
}

$userInfoResp = @file_get_contents('https://www.googleapis.com/oauth2/v2/userinfo', false, stream_context_create([
    'http' => [
        'header' => 'Authorization: Bearer ' . $token['access_token'],
    ],
]));

if ($userInfoResp === false) {
    header('Location: ' . $errorUrl);
    exit;
}

$userInfo = json_decode($userInfoResp, true);
if (empty($userInfo['id']) || empty($userInfo['email'])) {
    header('Location: ' . $errorUrl);
    exit;
}

$googleId = $userInfo['id'];
$email = filter_var($userInfo['email'], FILTER_SANITIZE_EMAIL);
$name = trim($userInfo['name'] ?? $userInfo['email'] ?? '');

$stmt = $pdo->prepare('SELECT id, name, email FROM users WHERE google_id = ? OR email = ? LIMIT 1');
$stmt->execute([$googleId, $email]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if ($user) {
    $pdo->prepare('UPDATE users SET name = ?, google_id = ? WHERE id = ?')
        ->execute([$name ?: $user['name'], $googleId, $user['id']]);
    $user['name'] = $name ?: $user['name'];
} else {
    $pdo->prepare('INSERT INTO users (name, email, google_id, created_at) VALUES (?, ?, ?, NOW())')
        ->execute([$name, $email, $googleId]);
    $user = [
        'id'    => (int) $pdo->lastInsertId(),
        'name'  => $name,
        'email' => $email,
    ];
}

auth_set_user($user);
header('Location: ../index.html');
exit;
