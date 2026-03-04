<?php
/**
 * Database connection and schema bootstrap.
 * Auto-creates the database and users table if they don't exist.
 */

$dbConfig = require __DIR__ . '/db-config.php';

/**
 * Output a JSON error and exit (used when connection fails).
 */
function db_fatal(string $msg): void {
    if (!headers_sent()) {
        header('Content-Type: application/json');
        http_response_code(500);
    }
    echo json_encode(['success' => false, 'message' => $msg]);
    exit;
}

// Check PDO MySQL extension
if (!extension_loaded('pdo_mysql')) {
    db_fatal('Server configuration error: pdo_mysql extension is not loaded');
}

$host    = $dbConfig['host'];
$port    = $dbConfig['port'];
$dbname  = $dbConfig['dbname'];
$charset = $dbConfig['charset'];
$user    = $dbConfig['username'];
$pass    = $dbConfig['password'];

// Step 1: Connect without database name to allow auto-create
$dsnServer = "mysql:host={$host};port={$port};charset={$charset}";
try {
    $pdoServer = new PDO($dsnServer, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    db_fatal('Cannot connect to MySQL server. Check host, port, username and password.');
}

// Step 2: Create database if it doesn't exist
try {
    $pdoServer->exec("CREATE DATABASE IF NOT EXISTS `{$dbname}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
} catch (PDOException $e) {
    db_fatal('Cannot create database. Grant CREATE privilege to the database user.');
}

// Step 3: Connect to the specific database
$dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}";
try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    db_fatal('Cannot select database. Check that the database exists and the user has access.');
}

unset($pdoServer);

/**
 * Ensure users table exists.
 */
function ensureUsersTable(PDO $pdo): void {
    $sql = <<<'SQL'
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL DEFAULT '',
    email VARCHAR(255) NOT NULL,
    google_id VARCHAR(255) NULL,
    otp VARCHAR(6) NULL,
    otp_expires_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_email (email),
    KEY idx_google_id (google_id),
    KEY idx_otp_expires (otp_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL;
    $pdo->exec($sql);
}

ensureUsersTable($pdo);
