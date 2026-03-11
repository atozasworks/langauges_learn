<?php
header('Content-Type: text/plain');
header('Cache-Control: no-store');
error_reporting(E_ALL);
ini_set('display_errors', '1');

echo "=== MongoDB Connection Test ===\n\n";

if (!extension_loaded('mongodb')) {
    echo "mongodb extension: NOT LOADED\n";
    echo "Enable extension=mongodb in php.ini and restart Apache.\n";
    exit(1);
}

echo "mongodb extension: loaded\n\n";

$cfgFile = __DIR__ . '/db-config.local.php';
if (is_file($cfgFile)) {
    $cfg = require $cfgFile;
    if (!is_array($cfg)) {
        $cfg = [];
    }
} else {
    $cfg = [];
}

$uri = (string) ($cfg['uri'] ?? 'mongodb://127.0.0.1:27017');
$dbName = (string) ($cfg['dbname'] ?? 'lldb');
$maskedUri = preg_replace('/:\/\/([^:@\/]+):([^@\/]+)@/', '://$1:***@', $uri);

echo "Config:\n";
echo "  uri:    {$maskedUri}\n";
echo "  dbname: {$dbName}\n\n";

try {
    $manager = new MongoDB\Driver\Manager($uri);
    $ping = $manager->executeCommand('admin', new MongoDB\Driver\Command(['ping' => 1]))->toArray();
    echo "Ping: OK\n";
    if (!empty($ping)) {
        echo "Ping response: " . json_encode($ping[0], JSON_UNESCAPED_SLASHES) . "\n";
    }
} catch (Throwable $e) {
    echo "Ping FAILED: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\nListing collections in {$dbName}:\n";
try {
    $list = $manager->executeCommand($dbName, new MongoDB\Driver\Command(['listCollections' => 1]))->toArray();
    if (empty($list[0]->cursor->firstBatch ?? [])) {
        echo "  (no collections yet)\n";
    } else {
        foreach ($list[0]->cursor->firstBatch as $c) {
            echo "  - " . ($c->name ?? 'unknown') . "\n";
        }
    }
} catch (Throwable $e) {
    echo "listCollections FAILED: " . $e->getMessage() . "\n";
}

echo "\nDone.\n";
