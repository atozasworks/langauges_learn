<?php
/**
 * config.php – Database connection & global settings
 *
 * INSTRUCTIONS:
 *   1. Set your MySQL credentials below.
 *   2. Make sure the database exists (run schema.sql first).
 */

// ── Database credentials ───────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'atozservices_auth');     // database name from schema.sql
define('DB_USER', 'root');                  // XAMPP default user
define('DB_PASS', '');                      // XAMPP default password (empty)
define('DB_CHARSET', 'utf8mb4');

// ── Site settings ──────────────────────────────────────────────
define('SITE_NAME', 'AtoZ Language Learning');
// IMPORTANT: Set this to your deployment folder under public_html.
// Examples:
//   Local: '/spokenenglish/AtoZ_Services/lan_learn'
//   Live:  '/chaithra_langlearn'
define('SITE_BASE_PATH', '/chaithra_langlearn');

// Optional display URL used in messages/logs.
define('SITE_URL', SITE_BASE_PATH . '/auth');

// ── OTP settings ───────────────────────────────────────────────
define('OTP_LENGTH', 6);
define('OTP_EXPIRY_MINUTES', 5);
define('OTP_RESEND_COOLDOWN_SECONDS', 60);
define('OTP_MAX_VERIFY_ATTEMPTS', 5);

// ── Rate-limit: max OTP requests per email/IP in a window ─────
define('RATE_LIMIT_MAX_REQUESTS', 5);       // max 5 OTP sends
define('RATE_LIMIT_WINDOW_MINUTES', 15);    // within 15 minutes

// ── Session settings ───────────────────────────────────────────
define('SESSION_LIFETIME', 86400); // 24 hours

// ── PDO connection (singleton) ─────────────────────────────────
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    }
    return $pdo;
}

// ── Helpers ────────────────────────────────────────────────────

/**
 * Get the real client IP address.
 */
function getClientIP(): string {
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($ips[0]);
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

/**
 * Return a JSON response and exit.
 */
function jsonResponse(array $data, int $httpCode = 200): void {
    http_response_code($httpCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

/**
 * Validate a CSRF token from request against session.
 */
function validateCSRFToken(string $token): bool {
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Generate (or return existing) CSRF token for the session.
 */
function getCSRFToken(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Start secure session if not already started.
 */
function startSecureSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['SERVER_PORT'] ?? '') === '443');
        session_set_cookie_params([
            'lifetime' => SESSION_LIFETIME,
            'path'     => '/',
            'secure'   => $isHttps,
            'httponly'  => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

/**
 * Build an absolute app path from SITE_BASE_PATH.
 */
function appPath(string $path = ''): string {
    $base = rtrim(SITE_BASE_PATH, '/');
    if ($base === '') {
        $base = '/';
    }
    $suffix = ltrim($path, '/');
    if ($suffix === '') {
        return $base;
    }
    return $base . '/' . $suffix;
}
