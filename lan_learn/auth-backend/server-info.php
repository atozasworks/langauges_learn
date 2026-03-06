<?php
/**
 * Temporary diagnostic script to discover server environment.
 * DELETE THIS FILE after getting the info!
 */
header('Content-Type: application/json');

$info = [
    'php_version' => PHP_VERSION,
    'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown',
    'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'unknown',
    'server_name' => $_SERVER['SERVER_NAME'] ?? 'unknown',
    'extensions' => [
        'pdo_mysql' => extension_loaded('pdo_mysql'),
        'mysqli' => extension_loaded('mysqli'),
        'openssl' => extension_loaded('openssl'),
        'sockets' => extension_loaded('sockets'),
    ],
    'functions_disabled' => ini_get('disable_functions'),
    'fsockopen_available' => function_exists('fsockopen'),
    'allow_url_fopen' => ini_get('allow_url_fopen'),
];

// Check if there's a .env or wp-config or any hint of DB credentials
$possibleFiles = [
    __DIR__ . '/db-config.local.php',
    __DIR__ . '/smtp-config.local.php',
    __DIR__ . '/../.env',
    $_SERVER['DOCUMENT_ROOT'] . '/.env',
];

$info['config_files'] = [];
foreach ($possibleFiles as $f) {
    $info['config_files'][basename($f)] = is_file($f) ? 'EXISTS' : 'MISSING';
}

// Try to connect to localhost MySQL (common on shared hosting)
$info['mysql_tests'] = [];
$hosts = ['localhost', '127.0.0.1'];
foreach ($hosts as $host) {
    try {
        $testPdo = new PDO("mysql:host={$host};port=3307;charset=utf8mb4", 'root', '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 3,
        ]);
        $info['mysql_tests'][$host . '_root_nopass'] = 'CONNECTED';
    } catch (Throwable $e) {
        $info['mysql_tests'][$host . '_root_nopass'] = $e->getMessage();
    }
}

// Check for Hostinger-style environment variables
$envVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'MYSQL_HOST', 'MYSQL_DATABASE', 'MYSQL_USER'];
$info['env_vars'] = [];
foreach ($envVars as $var) {
    $val = getenv($var);
    if ($val !== false && $val !== '') {
        // Mask passwords
        if (stripos($var, 'PASSWORD') !== false) {
            $info['env_vars'][$var] = str_repeat('*', strlen($val)) . ' (' . strlen($val) . ' chars)';
        } else {
            $info['env_vars'][$var] = $val;
        }
    }
}

// Read actual config files (mask password)
$info['db_config'] = [];
$dbLocalFile = __DIR__ . '/db-config.local.php';
if (is_file($dbLocalFile)) {
    $dbCfg = require $dbLocalFile;
    if (is_array($dbCfg)) {
        $info['db_config'] = $dbCfg;
        if (isset($info['db_config']['password'])) {
            $p = $info['db_config']['password'];
            $info['db_config']['password'] = $p === '' ? '(empty)' : str_repeat('*', strlen($p)) . ' (' . strlen($p) . ' chars)';
        }
    }
}

$info['smtp_config'] = [];
$smtpLocalFile = __DIR__ . '/smtp-config.local.php';
if (is_file($smtpLocalFile)) {
    $smtpCfg = require $smtpLocalFile;
    if (is_array($smtpCfg)) {
        $info['smtp_config'] = $smtpCfg;
        if (isset($info['smtp_config']['password'])) {
            $p = $info['smtp_config']['password'];
            $info['smtp_config']['password'] = $p === '' ? '(empty)' : str_repeat('*', strlen($p)) . ' (' . strlen($p) . ' chars)';
        }
    }
}

// Check .env file content
$envFile = $_SERVER['DOCUMENT_ROOT'] . '/.env';
if (is_file($envFile)) {
    $envContent = file_get_contents($envFile);
    // Mask any password-like values
    $lines = explode("\n", $envContent);
    $maskedLines = [];
    foreach ($lines as $line) {
        if (preg_match('/password|secret|key/i', $line) && strpos($line, '=') !== false) {
            $parts = explode('=', $line, 2);
            $val = trim($parts[1] ?? '');
            $maskedLines[] = $parts[0] . '=' . str_repeat('*', strlen($val));
        } else {
            $maskedLines[] = $line;
        }
    }
    $info['env_file'] = implode("\n", $maskedLines);
}

echo json_encode($info, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
