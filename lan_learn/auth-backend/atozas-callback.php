<?php
// ATOZAS redirect target (register this URL with ATOZAS as the redirect URI).
session_start();
require_once __DIR__ . '/atozas-lib.php';

$flow = $_SESSION['atozas_flow'] ?? null;
unset($_SESSION['atozas_flow']);
$state = (string) ($_GET['state'] ?? '');

if (!empty($_GET['error'])) {
    // Our own silent check: "not signed in at ATOZAS" -> back to the app as a guest.
    if (strncmp($state, 's.', 2) === 0) {
        atozasBackToApp();
    }
    atozasBackToApp('atozas_error=' . rawurlencode('ATOZAS sign-in was cancelled or did not complete.'));
}

if (!atozasReady() || !is_array($flow) || empty($_GET['code']) || !hash_equals((string) $flow['state'], $state)
    || time() - (int) $flow['at'] > 600) {
    atozasBackToApp('atozas_error=' . rawurlencode('ATOZAS sign-in expired. Please try again.'));
}

$c = atozasConfig();
[$status, $tokens] = atozasPost($c['token_url'], [
    'grant_type' => 'authorization_code',
    'code' => (string) $_GET['code'],
    'redirect_uri' => $c['redirect_uri'],
    'client_id' => $c['client_id'],
    'client_secret' => $c['client_secret'],
    'code_verifier' => $flow['verifier'],
]);
if ($status !== 200 || empty($tokens['access_token'])) {
    atozasBackToApp('atozas_error=' . rawurlencode('Failed to verify your ATOZAS sign-in.'));
}

[$status, $profile] = atozasGet($c['userinfo_url'], $tokens['access_token']);
$email = strtolower(trim((string) ($profile['email'] ?? '')));
if ($status !== 200 || $email === '') {
    atozasBackToApp('atozas_error=' . rawurlencode('ATOZAS did not share an email address.'));
}

$name = trim((string) ($profile['name'] ?? '')) ?: strstr($email, '@', true);
$_SESSION['auth_user'] = ['email' => $email, 'name' => $name, 'picture' => (string) ($profile['picture'] ?? '')];

atozasBackToApp('atozas_user=' . atozasB64url(json_encode(['name' => $name, 'email' => $email])));
