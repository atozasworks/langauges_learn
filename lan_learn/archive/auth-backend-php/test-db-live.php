<?php
header('Content-Type: text/plain');
header('Cache-Control: no-store');
error_reporting(E_ALL);
ini_set('display_errors', '1');

echo "=== DB Connection Test v2 ===\n\n";

// Load the config
$cfg = require __DIR__ . '/db-config.local.php';
echo "Config loaded:\n";
echo "  host:     " . ($cfg['host'] ?? 'NOT SET') . "\n";
echo "  port:     " . ($cfg['port'] ?? 'NOT SET') . "\n";
echo "  dbname:   " . ($cfg['dbname'] ?? 'NOT SET') . "\n";
echo "  username: " . ($cfg['username'] ?? 'NOT SET') . "\n";
echo "  password: " . (isset($cfg['password']) ? str_repeat('*', strlen($cfg['password'])) . ' (' . strlen($cfg['password']) . ' chars)' : 'NOT SET') . "\n\n";

// Test 1: Connect with localhost (Unix socket)
echo "--- Test 1: localhost (Unix socket) ---\n";
try {
    $dsn = "mysql:host=localhost;port=3307;charset=utf8mb4";
    $pdo = new PDO($dsn, $cfg['username'], $cfg['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5,
    ]);
    echo "CONNECTED OK via localhost\n";
    $pdo = null;
} catch (Throwable $e) {
    echo "FAILED: " . $e->getMessage() . "\n";
}

// Test 2: Connect with 127.0.0.1 (TCP)
echo "\n--- Test 2: 127.0.0.1 (TCP) ---\n";
try {
    $dsn = "mysql:host=127.0.0.1;port=3307;charset=utf8mb4";
    $pdo = new PDO($dsn, $cfg['username'], $cfg['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5,
    ]);
    echo "CONNECTED OK via 127.0.0.1\n";
    $pdo = null;
} catch (Throwable $e) {
    echo "FAILED: " . $e->getMessage() . "\n";
}

// Test 3: Check if database exists (using root-like access)
echo "\n--- Test 3: Check database existence ---\n";
try {
    $dsn = "mysql:host=localhost;charset=utf8mb4";
    $pdo = new PDO($dsn, $cfg['username'], $cfg['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5,
    ]);
    $stmt = $pdo->query("SHOW DATABASES");
    $dbs = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "Databases visible: " . implode(', ', $dbs) . "\n";
} catch (Throwable $e) {
    echo "FAILED: " . $e->getMessage() . "\n";
}

echo "\n--- Test 4: Connect directly to specific database ---\n";
try {
    $dsn = "mysql:host=localhost;dbname=" . $cfg['dbname'] . ";charset=utf8mb4";
    $pdo = new PDO($dsn, $cfg['username'], $cfg['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5,
    ]);
    echo "CONNECTED to " . $cfg['dbname'] . " OK!\n";
} catch (Throwable $e) {
    echo "FAILED: " . $e->getMessage() . "\n";
}

echo "\nDone.\n";
