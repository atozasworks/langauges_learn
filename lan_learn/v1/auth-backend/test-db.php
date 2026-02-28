<?php
/**
 * DB connection test – open this directly in browser to diagnose.
 * REMOVE or restrict access before going to production.
 */
header('Content-Type: text/plain; charset=UTF-8');

$cfg = require __DIR__ . '/db-config.php';

echo "=== DB Config (password hidden) ===\n";
echo "host     : " . $cfg['host'] . "\n";
echo "port     : " . $cfg['port'] . "\n";
echo "dbname   : " . $cfg['dbname'] . "\n";
echo "username : " . $cfg['username'] . "\n";
echo "password : " . (empty($cfg['password']) ? '(empty – set it in db-config.local.php)' : '(set)') . "\n";
echo "charset  : " . $cfg['charset'] . "\n";
echo "\n";

// 1. PDO extension
if (!extension_loaded('pdo_mysql')) {
    die("FAIL: pdo_mysql extension is NOT loaded.\nFix: enable extension=pdo_mysql in php.ini and restart Apache.\n");
}
echo "pdo_mysql extension  : OK\n";

// 2. PHP version
echo "PHP version          : " . PHP_VERSION . "\n\n";

// Helper: try a server-level connection
function tryConnect(string $host, int $port, string $user, string $pass, string $charset): string {
    $dsn = "mysql:host={$host};port={$port};charset={$charset}";
    try {
        new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        return 'OK';
    } catch (PDOException $e) {
        return 'FAIL: ' . $e->getMessage();
    }
}

$host    = $cfg['host'];
$port    = (int) $cfg['port'];
$user    = $cfg['username'];
$pass    = $cfg['password'];
$dbname  = $cfg['dbname'];
$charset = $cfg['charset'];

// 3. Try configured host
$result = tryConnect($host, $port, $user, $pass, $charset);
echo "Connect ({$host}:{$port}) : {$result}\n";

// 4. If localhost failed, try 127.0.0.1
if ($result !== 'OK' && $host === 'localhost') {
    $result2 = tryConnect('127.0.0.1', $port, $user, $pass, $charset);
    echo "Connect (127.0.0.1:{$port})  : {$result2}\n";
    if ($result2 === 'OK') {
        echo "\n>>> FIX: Change 'host' to '127.0.0.1' in db-config.local.php\n";
    }
}

// 5. If still failing, try empty password
if ($result !== 'OK' && !empty($pass)) {
    $result3 = tryConnect($host, $port, $user, '', $charset);
    echo "Connect (empty password): {$result3}\n";
    if ($result3 === 'OK') {
        echo "\n>>> FIX: Your MySQL root password is empty. Clear the password in db-config.local.php.\n";
    }
    $result4 = tryConnect('127.0.0.1', $port, $user, '', $charset);
    echo "Connect (127.0.0.1 + empty pw): {$result4}\n";
    if ($result4 === 'OK') {
        echo "\n>>> FIX: Use host='127.0.0.1' and empty password in db-config.local.php.\n";
    }
}

if ($result !== 'OK') {
    echo "\n=== Connection failed. Common fixes ===\n";
    echo "1. Make sure MySQL/MariaDB is running in XAMPP Control Panel.\n";
    echo "2. Try host '127.0.0.1' instead of 'localhost'.\n";
    echo "3. Verify the password in XAMPP > phpMyAdmin (root often has no password).\n";
    echo "4. Confirm port: open XAMPP Control Panel > MySQL > Config > my.ini and check port=\n";
    die();
}

// 6. Auto-create database
try {
    $pdoS = new PDO("mysql:host={$host};port={$port};charset={$charset}", $user, $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdoS->exec("CREATE DATABASE IF NOT EXISTS `{$dbname}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    echo "Database '{$dbname}'     : OK (created if missing)\n";
} catch (PDOException $e) {
    echo "Database create FAIL     : " . $e->getMessage() . "\n";
    die();
}

// 7. Connect with dbname
try {
    $pdo = new PDO("mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}", $user, $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    echo "Select database          : OK\n";
} catch (PDOException $e) {
    echo "Select database FAIL     : " . $e->getMessage() . "\n";
    die();
}

// 8. Create users table
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL DEFAULT '',
        email VARCHAR(255) NOT NULL,
        google_id VARCHAR(255) NULL,
        otp VARCHAR(6) NULL,
        otp_expires_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    echo "Users table              : OK\n";
} catch (PDOException $e) {
    echo "Users table FAIL         : " . $e->getMessage() . "\n";
    die();
}

echo "\n=== ALL CHECKS PASSED – DB is ready ===\n";
