<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');

echo "=== Testing JSON Storage ===\n";
try {
    require_once __DIR__ . '/db.php';
    $dataDir = getDataDir();
    echo "Data directory: $dataDir\n";
    echo "Directory exists: " . (is_dir($dataDir) ? 'YES' : 'NO') . "\n";
    echo "Directory writable: " . (is_writable($dataDir) ? 'YES' : 'NO') . "\n";
    echo "JSON Storage: OK\n";
} catch (Throwable $e) {
    echo "Storage Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . ":" . $e->getLine() . "\n";
    exit(1);
}

echo "\n=== Testing saveOtpCode ===\n";
try {
    saveOtpCode('test@example.com', '1234', 300);
    echo "saveOtpCode: OK\n";
} catch (Throwable $e) {
    echo "saveOtpCode Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . ":" . $e->getLine() . "\n";
}

echo "\n=== Testing SMTP Config ===\n";
try {
    require_once __DIR__ . '/smtp-mailer.php';
    $cfg = getSmtpConfig();
    echo "SMTP server: " . $cfg['server'] . "\n";
    echo "SMTP port: " . $cfg['port'] . "\n";
    echo "SMTP email: " . $cfg['email'] . "\n";
    echo "SMTP password: " . (strlen($cfg['password']) > 0 ? 'SET (' . strlen($cfg['password']) . ' chars)' : 'EMPTY') . "\n";
} catch (Throwable $e) {
    echo "SMTP Config Error: " . $e->getMessage() . "\n";
}

echo "\n=== Testing SMTP Connection (no send) ===\n";
try {
    $cfg = getSmtpConfig();
    $scheme = $cfg['secure'] ? 'ssl://' : '';
    $socket = @fsockopen($scheme . $cfg['server'], $cfg['port'], $errno, $errstr, 10);
    if (!$socket) {
        echo "SMTP Connect FAILED: $errstr ($errno)\n";
    } else {
        $greeting = fgets($socket, 515);
        echo "SMTP Connect: OK\n";
        echo "Server greeting: " . trim($greeting) . "\n";
        fwrite($socket, "QUIT\r\n");
        fclose($socket);
    }
} catch (Throwable $e) {
    echo "SMTP Error: " . $e->getMessage() . "\n";
}

echo "\nDone.\n";
