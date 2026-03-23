<?php
declare(strict_types=1);

$config = require __DIR__ . '/../config.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name($config['app']['session_name']);
    session_start();
}

function app_config(): array
{
    global $config;
    return $config;
}

function app_base_url(): string
{
    $cfg = app_config();
    return rtrim($cfg['app']['base_url'], '/');
}

function app_debug(): bool
{
    $cfg = app_config();
    return (bool) ($cfg['app']['debug'] ?? false);
}

function auth_log(string $message): void
{
    $line = '[' . gmdate('c') . '] ' . $message . PHP_EOL;
    @file_put_contents(__DIR__ . '/auth-error.log', $line, FILE_APPEND);
}

function json_response(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($payload);
    exit;
}

function redirect_to(string $path): void
{
    header('Location: ' . app_base_url() . $path);
    exit;
}

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $cfg = app_config();
    $dbPath = $cfg['db']['path'];

    if (!is_dir(dirname($dbPath))) {
        mkdir(dirname($dbPath), 0775, true);
    }

    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            provider TEXT NOT NULL,
            google_sub TEXT,
            created_at TEXT NOT NULL,
            last_login TEXT NOT NULL
        )'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS otp_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            otp_hash TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        )'
    );

    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_requests(email)');

    return $pdo;
}

function current_user(): ?array
{
    return $_SESSION['user'] ?? null;
}

function require_auth(): void
{
    if (!current_user()) {
        redirect_to('/login.php');
    }
}

function set_user_session(array $user): void
{
    $_SESSION['user'] = [
        'id' => (int) $user['id'],
        'email' => $user['email'],
        'name' => $user['name'] ?? '',
        'provider' => $user['provider'],
    ];
}

function logout_user(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
}

function find_or_create_user(string $email, string $provider, ?string $name = null, ?string $googleSub = null): array
{
    $pdo = db();
    $now = gmdate('c');

    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if ($user) {
        $update = $pdo->prepare('UPDATE users SET name = :name, provider = :provider, google_sub = :google_sub, last_login = :last_login WHERE id = :id');
        $update->execute([
            ':name' => $name ?: ($user['name'] ?? ''),
            ':provider' => $provider,
            ':google_sub' => $googleSub,
            ':last_login' => $now,
            ':id' => $user['id'],
        ]);

        $stmt->execute([':email' => $email]);
        return $stmt->fetch();
    }

    $insert = $pdo->prepare(
        'INSERT INTO users(email, name, provider, google_sub, created_at, last_login)
         VALUES(:email, :name, :provider, :google_sub, :created_at, :last_login)'
    );
    $insert->execute([
        ':email' => $email,
        ':name' => $name,
        ':provider' => $provider,
        ':google_sub' => $googleSub,
        ':created_at' => $now,
        ':last_login' => $now,
    ]);

    $stmt->execute([':email' => $email]);
    return $stmt->fetch();
}

function generate_otp(): string
{
    return (string) random_int(100000, 999999);
}

function create_email_otp(string $email): string
{
    $cfg = app_config();
    $pdo = db();
    $otp = generate_otp();
    $expiresAt = time() + (int) $cfg['app']['otp_expiry_seconds'];

    $delete = $pdo->prepare('DELETE FROM otp_requests WHERE email = :email');
    $delete->execute([':email' => $email]);

    $insert = $pdo->prepare('INSERT INTO otp_requests(email, otp_hash, expires_at, created_at) VALUES(:email, :otp_hash, :expires_at, :created_at)');
    $insert->execute([
        ':email' => $email,
        ':otp_hash' => password_hash($otp, PASSWORD_DEFAULT),
        ':expires_at' => $expiresAt,
        ':created_at' => time(),
    ]);

    return $otp;
}

function verify_email_otp(string $email, string $otp): bool
{
    $pdo = db();

    $stmt = $pdo->prepare('SELECT * FROM otp_requests WHERE email = :email ORDER BY id DESC LIMIT 1');
    $stmt->execute([':email' => $email]);
    $row = $stmt->fetch();

    if (!$row) {
        return false;
    }

    if ((int) $row['expires_at'] < time() || (int) $row['attempts'] >= 5) {
        return false;
    }

    if (!password_verify($otp, $row['otp_hash'])) {
        $update = $pdo->prepare('UPDATE otp_requests SET attempts = attempts + 1 WHERE id = :id');
        $update->execute([':id' => $row['id']]);
        return false;
    }

    $del = $pdo->prepare('DELETE FROM otp_requests WHERE id = :id');
    $del->execute([':id' => $row['id']]);

    return true;
}

function smtp_expect($socket, array $codes): void
{
    $response = '';
    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (strlen($line) >= 4 && $line[3] === ' ') {
            break;
        }
    }

    $status = (int) substr(trim($response), 0, 3);
    if (!in_array($status, $codes, true)) {
        throw new RuntimeException('SMTP error: ' . trim($response));
    }
}

function smtp_cmd($socket, string $cmd, array $expect): void
{
    fwrite($socket, $cmd . "\r\n");
    smtp_expect($socket, $expect);
}

function send_email_smtp(string $to, string $subject, string $htmlBody): void
{
    $cfg = app_config()['email'];
    $secure = $cfg['secure'] ?? false;

    if ($secure === true) {
        $secure = 'ssl';
    }
    $secure = strtolower((string) $secure);

    $transport = $secure === 'ssl' ? 'ssl://' : '';
    $remote = $transport . $cfg['host'] . ':' . $cfg['port'];

    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'allow_self_signed' => false,
        ],
    ]);

    $socket = stream_socket_client($remote, $errno, $errstr, 20, STREAM_CLIENT_CONNECT, $context);

    if (!$socket) {
        throw new RuntimeException("SMTP connection failed: {$errstr} ({$errno})");
    }

    stream_set_timeout($socket, 20);

    smtp_expect($socket, [220]);
    smtp_cmd($socket, 'EHLO localhost', [250]);

    if ($secure === 'tls') {
        smtp_cmd($socket, 'STARTTLS', [220]);
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            throw new RuntimeException('Failed to enable TLS encryption.');
        }
        smtp_cmd($socket, 'EHLO localhost', [250]);
    }

    smtp_cmd($socket, 'AUTH LOGIN', [334]);
    smtp_cmd($socket, base64_encode($cfg['username']), [334]);
    smtp_cmd($socket, base64_encode($cfg['password']), [235]);
    smtp_cmd($socket, 'MAIL FROM:<' . $cfg['from_email'] . '>', [250]);
    smtp_cmd($socket, 'RCPT TO:<' . $to . '>', [250, 251]);
    smtp_cmd($socket, 'DATA', [354]);

    $headers = [];
    $headers[] = 'From: ' . $cfg['from_name'] . ' <' . $cfg['from_email'] . '>';
    $headers[] = 'To: <' . $to . '>';
    $headers[] = 'Subject: ' . $subject;
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: text/html; charset=UTF-8';

    $message = implode("\r\n", $headers) . "\r\n\r\n" . $htmlBody . "\r\n.";
    fwrite($socket, $message . "\r\n");
    smtp_expect($socket, [250]);
    smtp_cmd($socket, 'QUIT', [221]);

    fclose($socket);
}

function google_exchange_code(string $code): array
{
    $google = app_config()['google'];

    $payload = http_build_query([
        'code' => $code,
        'client_id' => $google['client_id'],
        'client_secret' => $google['client_secret'],
        'redirect_uri' => $google['redirect_uri'],
        'grant_type' => 'authorization_code',
    ]);

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
    ]);

    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode((string) $response, true);
    if ($httpCode !== 200 || !is_array($data) || empty($data['access_token'])) {
        throw new RuntimeException('Failed to exchange Google OAuth code.');
    }

    return $data;
}

function google_get_user_info(string $accessToken): array
{
    $ch = curl_init('https://openidconnect.googleapis.com/v1/userinfo');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken],
    ]);

    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode((string) $response, true);
    if ($httpCode !== 200 || !is_array($data) || empty($data['email'])) {
        throw new RuntimeException('Failed to fetch Google user profile.');
    }

    return $data;
}

