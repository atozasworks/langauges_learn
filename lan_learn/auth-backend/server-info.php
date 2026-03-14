<?php
/**
 * Temporary diagnostic script to discover server environment.
 * DELETE THIS FILE after getting the info.
 */
require_once __DIR__ . '/diagnostics-guard.php';
requireDiagnosticsAccess('json');

header('Content-Type: application/json');

$info = [
    'php_version' => PHP_VERSION,
    'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown',
    'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'unknown',
    'server_name' => $_SERVER['SERVER_NAME'] ?? 'unknown',
    'extensions' => [
        'mongodb' => extension_loaded('mongodb'),
        'openssl' => extension_loaded('openssl'),
        'sockets' => extension_loaded('sockets'),
        'curl' => extension_loaded('curl'),
    ],
    'functions_disabled' => ini_get('disable_functions'),
    'fsockopen_available' => function_exists('fsockopen'),
    'allow_url_fopen' => ini_get('allow_url_fopen'),
];

$possibleFiles = [
    __DIR__ . '/db-config.local.php',
    __DIR__ . '/smtp-config.local.php',
    __DIR__ . '/../.env',
    ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/.env',
];

$info['config_files'] = [];
foreach ($possibleFiles as $f) {
    $info['config_files'][basename($f)] = is_file($f) ? 'EXISTS' : 'MISSING';
}

$envVars = [
    'MONGODB_URI',
    'MONGODB_DATABASE',
    'MONGODB_DB',
    'MONGO_URI',
    'DB_NAME',
];
$info['env_vars'] = [];
foreach ($envVars as $var) {
    $val = getenv($var);
    if ($val !== false && $val !== '') {
        if (stripos($var, 'URI') !== false) {
            $val = preg_replace('/:\/\/([^:@\/]+):([^@\/]+)@/', '://$1:***@', $val);
        }
        $info['env_vars'][$var] = $val;
    }
}

$info['db_config'] = [];
$dbLocalFile = __DIR__ . '/db-config.local.php';
if (is_file($dbLocalFile)) {
    $dbCfg = require $dbLocalFile;
    if (is_array($dbCfg)) {
        if (isset($dbCfg['uri'])) {
            $dbCfg['uri'] = preg_replace('/:\/\/([^:@\/]+):([^@\/]+)@/', '://$1:***@', (string) $dbCfg['uri']);
        }
        $info['db_config'] = $dbCfg;
    }
}

$info['mongodb_test'] = 'SKIPPED';
if (extension_loaded('mongodb')) {
    try {
        $uri = $info['db_config']['uri'] ?? (getenv('MONGODB_URI') ?: 'mongodb://127.0.0.1:27017');
        $dbName = $info['db_config']['dbname'] ?? (getenv('MONGODB_DATABASE') ?: 'lldb');

        $manager = new MongoDB\Driver\Manager($uri);
        $ping = $manager->executeCommand('admin', new MongoDB\Driver\Command(['ping' => 1]))->toArray();

        $collections = $manager
            ->executeCommand($dbName, new MongoDB\Driver\Command(['listCollections' => 1]))
            ->toArray();

        $list = [];
        if (!empty($collections[0]->cursor->firstBatch ?? [])) {
            foreach ($collections[0]->cursor->firstBatch as $c) {
                $list[] = $c->name ?? 'unknown';
            }
        }

        $info['mongodb_test'] = [
            'status' => 'CONNECTED',
            'ping' => $ping[0] ?? null,
            'database' => $dbName,
            'collections' => $list,
        ];
    } catch (Throwable $e) {
        $info['mongodb_test'] = [
            'status' => 'FAILED',
            'error' => $e->getMessage(),
        ];
    }
}

$info['smtp_config'] = [];
$smtpLocalFile = __DIR__ . '/smtp-config.local.php';
if (is_file($smtpLocalFile)) {
    $smtpCfg = require $smtpLocalFile;
    if (is_array($smtpCfg)) {
        $info['smtp_config'] = $smtpCfg;
        if (isset($info['smtp_config']['password'])) {
            $p = (string) $info['smtp_config']['password'];
            $info['smtp_config']['password'] = $p === '' ? '(empty)' : str_repeat('*', strlen($p)) . ' (' . strlen($p) . ' chars)';
        }
    }
}

$envFile = ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/.env';
if (is_file($envFile)) {
    $envContent = file_get_contents($envFile);
    $lines = explode("\n", (string) $envContent);
    $maskedLines = [];
    foreach ($lines as $line) {
        if (preg_match('/password|secret|key|mongo|mongodb/i', $line) && strpos($line, '=') !== false) {
            $parts = explode('=', $line, 2);
            $maskedLines[] = $parts[0] . '=***';
        } else {
            $maskedLines[] = $line;
        }
    }
    $info['env_file'] = implode("\n", $maskedLines);
}

echo json_encode($info, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
