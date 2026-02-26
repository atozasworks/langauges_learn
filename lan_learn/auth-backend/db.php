<?php
/**
 * Database helper for XAMPP MySQL (phpMyAdmin).
 * Auto-creates database `lan_learn_auth` and tables `login_audit`, `otp_codes`.
 */

error_reporting(E_ALL);

/**
 * MySQL config for XAMPP.
 */
function getDbConfig(): array
{
    $localFile = __DIR__ . '/db-config.local.php';
    if (is_file($localFile)) {
        $cfg = require $localFile;
        if (is_array($cfg)) {
            return $cfg;
        }
    }

    // Default XAMPP config
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
