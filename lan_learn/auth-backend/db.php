<?php
/**
 * Database helper — works with both XAMPP (local) and Hostinger (live).
 * Auto-creates tables `login_audit`, `otp_codes`, `learning_team`.
 *
 * Config priority:
 *   1. db-config.local.php  (per-environment file, not committed)
 *   2. Environment variables DB_HOST, DB_NAME, DB_USER, DB_PASSWORD
 *   3. .env file in document root (Hostinger / other hosts)
 *   4. Default XAMPP config (root / no password)
 */

error_reporting(E_ALL);

/**
 * Parse a .env file into an associative array (does NOT call putenv).
 */
function parseEnvFile(string $path): array
{
    if (!is_file($path)) {
        return [];
    }
    $vars = [];
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }
        if (strpos($line, '=') === false) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key   = trim($key);
        $value = trim($value);
        // Strip surrounding quotes
        if (preg_match('/^(["\'])(.*)\\1$/', $value, $m)) {
            $value = $m[2];
        }
        // Strip inline comments (e.g., "value #comment")
        if (($pos = strpos($value, ' #')) !== false) {
            $value = rtrim(substr($value, 0, $pos));
        }
        $vars[$key] = $value;
    }
    return $vars;
}

/**
 * MySQL config — tries local file, env vars, .env file, then defaults.
 */
function getDbConfig(): array
{
    // 1. Local config file (highest priority)
    $localFile = __DIR__ . '/db-config.local.php';
    if (is_file($localFile)) {
        $cfg = require $localFile;
        if (is_array($cfg)) {
            return $cfg;
        }
    }

    // 2. Real environment variables
    $envHost = getenv('DB_HOST');
    if ($envHost !== false && $envHost !== '') {
        return [
            'host'     => $envHost,
            'port'     => (int)(getenv('DB_PORT') ?: 3306),
            'dbname'   => getenv('DB_NAME') ?: 'lan_learn_auth',
            'username' => getenv('DB_USER') ?: 'root',
            'password' => getenv('DB_PASSWORD') ?: '',
            'charset'  => 'utf8mb4',
        ];
    }

    // 3. .env file in document root (Hostinger, etc.)
    $envFile = ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/.env';
    $env = parseEnvFile($envFile);
    if (!empty($env['DB_HOST'])) {
        return [
            'host'     => $env['DB_HOST'],
            'port'     => (int)($env['DB_PORT'] ?? 3306),
            'dbname'   => $env['DB_NAME'] ?? 'lan_learn_auth',
            'username' => $env['DB_USER'] ?? 'root',
            'password' => $env['DB_PASSWORD'] ?? '',
            'charset'  => 'utf8mb4',
        ];
    }

    // 4. Default XAMPP config (localhost development)
    return [
        'host'     => '127.0.0.1',
        'port'     => 3306,
        'dbname'   => 'lan_learn_auth',
        'username' => 'root',
        'password' => '',
        'charset'  => 'utf8mb4',
    ];
}

/**
 * Returns a PDO MySQL connection. Creates DB and tables on first call.
 */
function getLoginDbConnection(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $c = getDbConfig();
    $host    = $c['host']     ?? '127.0.0.1';
    $port    = (int)($c['port'] ?? 3306);
    $dbname  = $c['dbname']   ?? 'lan_learn_auth';
    $user    = $c['username'] ?? 'root';
    $pass    = $c['password'] ?? '';
    $charset = $c['charset']  ?? 'utf8mb4';

    // Step 1: Connect WITHOUT database to create it first
    $dsn1 = "mysql:host={$host};port={$port};charset={$charset}";
    $tmp  = new PDO($dsn1, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    $tmp->exec("CREATE DATABASE IF NOT EXISTS `{$dbname}` CHARACTER SET {$charset} COLLATE {$charset}_unicode_ci");
    $tmp = null; // close

    // Step 2: Connect TO the database
    $dsn2 = "mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}";
    $pdo  = new PDO($dsn2, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    // Step 3: Create tables
    createTables($pdo);

    return $pdo;
}

/**
 * Creates login_audit and otp_codes tables if they don't exist.
 */
function createTables(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `login_audit` (
            `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            `email`            VARCHAR(255) NOT NULL,
            `login_method`     VARCHAR(30)  NOT NULL,
            `provider_user_id` VARCHAR(255) NULL,
            `display_name`     VARCHAR(255) NULL,
            `login_status`     VARCHAR(20)  NOT NULL DEFAULT 'success',
            `client_ip`        VARCHAR(64)  NULL,
            `user_agent`       TEXT         NULL,
            `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `otp_codes` (
            `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            `email`      VARCHAR(255) NOT NULL,
            `otp_hash`   VARCHAR(255) NOT NULL,
            `expires_at` DATETIME     NOT NULL,
            `used_at`    DATETIME     NULL,
            `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_otp_email` (`email`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `learning_team` (
            `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            `user_email`    VARCHAR(255) NOT NULL,
            `learner_name`  VARCHAR(255) NOT NULL,
            `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_lt_user` (`user_email`),
            UNIQUE KEY `uk_user_learner` (`user_email`, `learner_name`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
}

/* ────────────────────────────────────────────
   Learning Team helpers
   ──────────────────────────────────────────── */

/**
 * Get all learners for a specific user.
 */
function getLearnersByUser(string $email): array
{
    $pdo = getLoginDbConnection();
    $stmt = $pdo->prepare("SELECT id, learner_name FROM `learning_team` WHERE user_email = :email ORDER BY created_at ASC");
    $stmt->execute([':email' => $email]);
    return $stmt->fetchAll();
}

/**
 * Add a learner to a user's team. Returns the new row id.
 */
function addLearner(string $email, string $name): int
{
    $pdo = getLoginDbConnection();
    $stmt = $pdo->prepare("INSERT INTO `learning_team` (user_email, learner_name) VALUES (:email, :name)");
    $stmt->execute([':email' => $email, ':name' => $name]);
    return (int) $pdo->lastInsertId();
}

/**
 * Delete a learner from a user's team (only if it belongs to that user).
 */
function deleteLearner(string $email, int $learnerId): bool
{
    $pdo = getLoginDbConnection();
    $stmt = $pdo->prepare("DELETE FROM `learning_team` WHERE id = :id AND user_email = :email LIMIT 1");
    $stmt->execute([':id' => $learnerId, ':email' => $email]);
    return $stmt->rowCount() > 0;
}

/**
 * Save a login event.
 */
function saveLoginAudit(array $rec): void
{
    $pdo = getLoginDbConnection();
    $stmt = $pdo->prepare("
        INSERT INTO `login_audit`
            (email, login_method, provider_user_id, display_name, login_status, client_ip, user_agent, created_at)
        VALUES
            (:email, :method, :pid, :name, :status, :ip, :ua, NOW())
    ");
    $stmt->execute([
        ':email'  => $rec['email'] ?? '',
        ':method' => $rec['login_method'] ?? 'unknown',
        ':pid'    => $rec['provider_user_id'] ?? null,
        ':name'   => $rec['display_name'] ?? null,
        ':status' => $rec['login_status'] ?? 'success',
        ':ip'     => $_SERVER['REMOTE_ADDR'] ?? null,
        ':ua'     => $_SERVER['HTTP_USER_AGENT'] ?? null,
    ]);
}

/**
 * Save OTP hash; expire previous unused OTPs for the same email.
 */
function saveOtpCode(string $email, string $otp, int $ttl = 300): void
{
    $pdo = getLoginDbConnection();

    // Expire old unused OTPs
    $pdo->prepare("UPDATE `otp_codes` SET used_at = NOW() WHERE email = :email AND used_at IS NULL")
        ->execute([':email' => $email]);

    // Calculate expiry in PHP (avoids INTERVAL :param issue in some MySQL versions)
    $expiresAt = date('Y-m-d H:i:s', time() + $ttl);

    // Insert new OTP
    $stmt = $pdo->prepare("
        INSERT INTO `otp_codes` (email, otp_hash, expires_at, used_at, created_at)
        VALUES (:email, :hash, :expires, NULL, NOW())
    ");
    $stmt->execute([
        ':email'   => $email,
        ':hash'    => password_hash($otp, PASSWORD_DEFAULT),
        ':expires' => $expiresAt,
    ]);
}

/**
 * Verify OTP — checks latest unused row for the email.
 */
function verifyOtpCode(string $email, string $otp): bool
{
    $pdo = getLoginDbConnection();

    $stmt = $pdo->prepare("
        SELECT id, otp_hash, expires_at
        FROM `otp_codes`
        WHERE email = :email AND used_at IS NULL
        ORDER BY id DESC
        LIMIT 1
    ");
    $stmt->execute([':email' => $email]);
    $row = $stmt->fetch();

    if (!$row) {
        return false;
    }

    // Check expiry
    if (strtotime($row['expires_at']) < time()) {
        return false;
    }

    // Verify hash
    if (!password_verify($otp, $row['otp_hash'])) {
        return false;
    }

    // Mark as used
    $pdo->prepare("UPDATE `otp_codes` SET used_at = NOW() WHERE id = :id")
        ->execute([':id' => $row['id']]);

    return true;
}
