<?php
/**
 * ATOZAS single sign-on (OpenID Connect, Authorization Code + PKCE): one login for every AtoZ app.
 *
 * Settings come from the environment (like google-config.php):
 *   ATOZAS_SSO_ENABLED=true, ATOZAS_ISSUER (e.g. https://atozasindia.in), ATOZAS_CLIENT_ID,
 *   ATOZAS_CLIENT_SECRET, ATOZAS_REDIRECT_URI (default: <this folder>/atozas-callback.php),
 *   ATOZAS_SILENT=1/0 (optional: force the silent check on/off).
 */

function atozasConfig(): array
{
    $issuer = rtrim((string) (getenv('ATOZAS_ISSUER') ?: ''), '/');
    $issuer = preg_replace('#/sso$#', '', $issuer);
    $redirect = (string) (getenv('ATOZAS_REDIRECT_URI') ?: '');
    if ($redirect === '') {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/auth-backend/x.php')), '/');
        $redirect = $scheme . '://' . $host . $dir . '/atozas-callback.php';
    }
    return [
        'enabled' => strtolower((string) getenv('ATOZAS_SSO_ENABLED')) === 'true',
        'issuer' => $issuer,
        'client_id' => trim((string) (getenv('ATOZAS_CLIENT_ID') ?: '')),
        'client_secret' => trim((string) (getenv('ATOZAS_CLIENT_SECRET') ?: '')),
        'redirect_uri' => $redirect,
        'authorize_url' => $issuer . '/sso/authorize.php',
        'token_url' => $issuer . '/sso/token.php',
        'userinfo_url' => $issuer . '/sso/userinfo.php',
    ];
}

function atozasReady(): bool
{
    $c = atozasConfig();
    return $c['enabled'] && $c['issuer'] !== '' && $c['client_id'] !== '' && $c['client_secret'] !== '';
}

/**
 * The silent check (prompt=none) needs ATOZAS's support for it; an older ATOZAS would show its login
 * page to every guest. On only once ATOZAS reports `pending_login_method` in /sso/session.php
 * (checked at most every 10 minutes, cached in the temp folder).
 */
function atozasSilentSupported(): bool
{
    if (!atozasReady()) {
        return false;
    }
    $force = getenv('ATOZAS_SILENT');
    if ($force === '1' || $force === '0') {
        return $force === '1';
    }
    $c = atozasConfig();
    $cacheFile = rtrim(sys_get_temp_dir(), '/\\') . '/lanlearn_atozas_silent_' . md5($c['issuer']) . '.json';
    $cached = is_file($cacheFile) ? json_decode((string) @file_get_contents($cacheFile), true) : null;
    if (is_array($cached) && (int) ($cached['at'] ?? 0) > time() - 600) {
        return !empty($cached['ok']);
    }
    $ctx = stream_context_create(['http' => ['timeout' => 4, 'header' => "Accept: application/json\r\n", 'ignore_errors' => true]]);
    $raw = @file_get_contents($c['issuer'] . '/sso/session.php', false, $ctx);
    $data = is_string($raw) ? json_decode($raw, true) : null;
    $ok = is_array($data) && array_key_exists('pending_login_method', $data);
    @file_put_contents($cacheFile, json_encode(['ok' => $ok, 'at' => time()]));
    return $ok;
}

function atozasB64url(string $bytes): string
{
    return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
}

function atozasPost(string $url, array $fields): array
{
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'],
        CURLOPT_POSTFIELDS => http_build_query($fields),
    ]);
    $raw = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    return [$status, json_decode((string) $raw, true)];
}

function atozasGet(string $url, string $accessToken): array
{
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken, 'Accept: application/json'],
    ]);
    $raw = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    return [$status, json_decode((string) $raw, true)];
}

/** Back to the app; the result travels in the URL fragment (never sent to a server). */
function atozasBackToApp(string $fragment = ''): void
{
    header('Cache-Control: no-store');
    header('Location: ../index.html' . ($fragment !== '' ? '#' . $fragment : ''));
    exit;
}
