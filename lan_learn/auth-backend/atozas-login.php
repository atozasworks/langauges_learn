<?php
/**
 * Start an ATOZAS login.
 *   ?method=google|otp|atozas&login_hint=email   the button pressed here; ATOZAS opens that login
 *   ?silent=1                                    prompt=none: signed in at ATOZAS -> signed in here,
 *                                                otherwise straight back to the app as a guest
 */
session_start();
require_once __DIR__ . '/atozas-lib.php';

$silent = ($_GET['silent'] ?? '') === '1';
if (!atozasReady() || ($silent && !atozasSilentSupported())) {
    atozasBackToApp($silent ? '' : 'atozas_error=' . rawurlencode('ATOZAS login is not configured yet.'));
}

$c = atozasConfig();
$verifier = atozasB64url(random_bytes(48));
$state = ($silent ? 's.' : '') . bin2hex(random_bytes(16));
$_SESSION['atozas_flow'] = ['state' => $state, 'verifier' => $verifier, 'silent' => $silent, 'at' => time()];

$params = [
    'response_type' => 'code',
    'client_id' => $c['client_id'],
    'redirect_uri' => $c['redirect_uri'],
    'scope' => 'openid email profile',
    'state' => $state,
    'nonce' => bin2hex(random_bytes(16)),
    'code_challenge' => atozasB64url(hash('sha256', $verifier, true)),
    'code_challenge_method' => 'S256',
];
if ($silent) {
    $params['prompt'] = 'none';
} else {
    $method = strtolower((string) ($_GET['method'] ?? ''));
    if (in_array($method, ['google', 'otp', 'atozas'], true)) {
        $params['login_method'] = $method;
    }
    $hint = strtolower(trim((string) ($_GET['login_hint'] ?? '')));
    if ($hint !== '' && strlen($hint) <= 254 && filter_var($hint, FILTER_VALIDATE_EMAIL)) {
        $params['login_hint'] = $hint;
    }
}

header('Cache-Control: no-store');
header('Location: ' . $c['authorize_url'] . '?' . http_build_query($params));
exit;
