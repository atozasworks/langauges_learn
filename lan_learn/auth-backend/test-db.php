<?php
/**
 * TEST SCRIPT — Open in browser to verify MySQL connection.
 * URL: http://localhost/AtoZ_Services/lan_learn/auth-backend/test-db.php
 *
 * This will:
 *  1. Connect to MySQL via XAMPP
 *  2. Create database `lan_learn_auth`
 *  3. Create tables `login_audit` and `otp_codes`
 *  4. Insert a test row
 *  5. Show results
 *
 * After running, open phpMyAdmin and check database `lan_learn_auth`.
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

header('Content-Type: text/html; charset=utf-8');

echo '<h1>MySQL Database Test</h1>';

// ── Step 1: Check PDO MySQL extension ──
echo '<h2>Step 1: Check PHP Extensions</h2>';
if (!extension_loaded('pdo_mysql')) {
    echo '<p style="color:red;">❌ pdo_mysql extension is NOT loaded!</p>';
    echo '<p>Fix: Open <code>C:\xampp\php\php.ini</code>, find <code>;extension=pdo_mysql</code>, remove the semicolon, save, restart Apache.</p>';
    exit;
}
echo '<p style="color:green;">✅ pdo_mysql extension is loaded.</p>';

// ── Step 2: Test MySQL connection ──
echo '<h2>Step 2: Connect to MySQL</h2>';
try {
    $pdo = new PDO('mysql:host=127.0.0.1;port=3306;charset=utf8mb4', 'root', '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    echo '<p style="color:green;">✅ Connected to MySQL server.</p>';
} catch (PDOException $e) {
    echo '<p style="color:red;">❌ MySQL connection failed: ' . htmlspecialchars($e->getMessage()) . '</p>';
    echo '<p>Make sure MySQL is running in XAMPP Control Panel.</p>';
    exit;
}

// ── Step 3: Create database ──
echo '<h2>Step 3: Create Database</h2>';
try {
    $pdo->exec('CREATE DATABASE IF NOT EXISTS `lan_learn_auth` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    echo '<p style="color:green;">✅ Database <b>lan_learn_auth</b> created (or already exists).</p>';
} catch (PDOException $e) {
    echo '<p style="color:red;">❌ Failed to create database: ' . htmlspecialchars($e->getMessage()) . '</p>';
    exit;
}

// ── Step 4: Connect to database ──
$pdo->exec('USE `lan_learn_auth`');

// ── Step 5: Create tables ──
echo '<h2>Step 4: Create Tables</h2>';
try {
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
    echo '<p style="color:green;">✅ Table <b>login_audit</b> created.</p>';

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
    echo '<p style="color:green;">✅ Table <b>otp_codes</b> created.</p>';
} catch (PDOException $e) {
    echo '<p style="color:red;">❌ Table creation failed: ' . htmlspecialchars($e->getMessage()) . '</p>';
    exit;
}

// ── Step 6: Insert test row ──
echo '<h2>Step 5: Insert Test Data</h2>';
try {
    $stmt = $pdo->prepare("
        INSERT INTO `login_audit` (email, login_method, login_status, client_ip, user_agent, created_at)
        VALUES (:email, :method, :status, :ip, :ua, NOW())
    ");
    $stmt->execute([
        ':email'  => 'test@example.com',
        ':method' => 'test',
        ':status' => 'success',
        ':ip'     => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
        ':ua'     => $_SERVER['HTTP_USER_AGENT'] ?? 'test-script',
    ]);
    echo '<p style="color:green;">✅ Test row inserted into <b>login_audit</b>.</p>';
} catch (PDOException $e) {
    echo '<p style="color:red;">❌ Insert failed: ' . htmlspecialchars($e->getMessage()) . '</p>';
}

// ── Step 7: Show data ──
echo '<h2>Step 6: Current Data in login_audit</h2>';
$rows = $pdo->query('SELECT * FROM `login_audit` ORDER BY id DESC LIMIT 10')->fetchAll(PDO::FETCH_ASSOC);

if (empty($rows)) {
    echo '<p>No rows found.</p>';
} else {
    echo '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; font-family:monospace;">';
    echo '<tr>';
    foreach (array_keys($rows[0]) as $col) {
        echo '<th style="background:#eee;">' . htmlspecialchars($col) . '</th>';
    }
    echo '</tr>';
    foreach ($rows as $row) {
        echo '<tr>';
        foreach ($row as $val) {
            echo '<td>' . htmlspecialchars($val ?? 'NULL') . '</td>';
        }
        echo '</tr>';
    }
    echo '</table>';
}

echo '<h2>Step 7: Current Data in otp_codes</h2>';
$otpRows = $pdo->query('SELECT * FROM `otp_codes` ORDER BY id DESC LIMIT 10')->fetchAll(PDO::FETCH_ASSOC);

if (empty($otpRows)) {
    echo '<p>No OTP rows yet (will appear after Send OTP).</p>';
} else {
    echo '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; font-family:monospace;">';
    echo '<tr>';
    foreach (array_keys($otpRows[0]) as $col) {
        echo '<th style="background:#eee;">' . htmlspecialchars($col) . '</th>';
    }
    echo '</tr>';
    foreach ($otpRows as $row) {
        echo '<tr>';
        foreach ($row as $val) {
            echo '<td>' . htmlspecialchars($val ?? 'NULL') . '</td>';
        }
        echo '</tr>';
    }
    echo '</table>';
}

echo '<hr>';
echo '<p style="color:green; font-size:18px;"><b>✅ All done! Now open phpMyAdmin → database <code>lan_learn_auth</code> → you will see both tables.</b></p>';
echo '<p><a href="http://localhost/phpmyadmin/" target="_blank">Open phpMyAdmin →</a></p>';
