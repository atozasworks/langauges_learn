<?php
header('Content-Type: text/plain');
header('Cache-Control: no-store');
error_reporting(E_ALL);
ini_set('display_errors', '1');

echo "=== JSON File Storage Test ===\n\n";

require_once __DIR__ . '/db.php';

// Load the config
$cfg = require __DIR__ . '/db-config.local.php';
echo "Config loaded:\n";
echo "  driver:   " . ($cfg['driver'] ?? 'NOT SET') . "\n";
echo "  data_dir: " . ($cfg['data_dir'] ?? 'NOT SET') . "\n\n";

$dataDir = getDataDir();

// Test 1: Check data directory
echo "--- Test 1: Data directory ---\n";
echo "Path: $dataDir\n";
echo "Exists: " . (is_dir($dataDir) ? 'YES' : 'NO') . "\n";
echo "Writable: " . (is_writable($dataDir) ? 'YES' : 'NO') . "\n\n";

// Test 2: Write test
echo "--- Test 2: Write/read test ---\n";
try {
    $testFile = $dataDir . '/_test_live.json';
    writeJsonFile($testFile, ['test' => true, 'time' => date('Y-m-d H:i:s')]);
    $readBack = readJsonFile($testFile);
    echo "Write: OK\n";
    echo "Read back: " . ($readBack['test'] === true ? 'OK' : 'MISMATCH') . "\n";
    @unlink($testFile);
} catch (Throwable $e) {
    echo "FAILED: " . $e->getMessage() . "\n";
}

// Test 3: List existing data files
echo "\n--- Test 3: Existing data files ---\n";
$files = glob($dataDir . '/*.json');
if (empty($files)) {
    echo "No data files yet.\n";
} else {
    foreach ($files as $f) {
        $size = filesize($f);
        echo basename($f) . " ($size bytes)\n";
    }
}

// Test 4: Test login audit write
echo "\n--- Test 4: Login audit write ---\n";
try {
    saveLoginAudit([
        'email' => 'test-live@example.com',
        'login_method' => 'test',
        'login_status' => 'success',
    ]);
    echo "Login audit write: OK\n";
} catch (Throwable $e) {
    echo "FAILED: " . $e->getMessage() . "\n";
}

echo "\nDone.\n";
