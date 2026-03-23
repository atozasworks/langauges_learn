<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$state = (string) ($_GET['state'] ?? '');
$code = (string) ($_GET['code'] ?? '');

if (!$code || !$state || !hash_equals((string) ($_SESSION['google_oauth_state'] ?? ''), $state)) {
    redirect_to('/login.php?error=google_state');
}

unset($_SESSION['google_oauth_state']);

try {
    $token = google_exchange_code($code);
    $profile = google_get_user_info($token['access_token']);

    $user = find_or_create_user(
        strtolower((string) $profile['email']),
        'google',
        (string) ($profile['name'] ?? ''),
        (string) ($profile['sub'] ?? '')
    );

    set_user_session($user);
    redirect_to('/index.php');
} catch (Throwable $e) {
    redirect_to('/login.php?error=google_failed');
}