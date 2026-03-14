<?php
require_once __DIR__ . '/diagnostics-guard.php';
requireDiagnosticsAccess('json');

header('Content-Type: application/json');
header('Cache-Control: no-store');
$out = ['v'=>3];

$f1 = __DIR__ . '/db-config.local.php';
if (is_file($f1)) {
    $c = require $f1;
    if (is_array($c)) {
        if (isset($c['uri'])) {
            $c['uri'] = preg_replace('/:\/\/([^:@\/]+):([^@\/]+)@/', '://$1:***@', (string) $c['uri']);
        }
        $out['db'] = $c;
    }
} else { $out['db'] = 'MISSING'; }

$f2 = __DIR__ . '/smtp-config.local.php';
if (is_file($f2)) {
    $c2 = require $f2;
    if (is_array($c2)) {
        if (isset($c2['password'])) { $c2['password'] = '***(' . strlen($c2['password']) . ')'; }
        $out['smtp'] = $c2;
    }
} else { $out['smtp'] = 'MISSING'; }

$envFile = $_SERVER['DOCUMENT_ROOT'] . '/.env';
if (is_file($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $masked = [];
    foreach ($lines as $l) {
        if (preg_match('/password|secret|key|mongo|mongodb/i', $l) && strpos($l, '=') !== false) {
            $p = explode('=', $l, 2);
            $masked[] = $p[0] . '=***';
        } else {
            $masked[] = $l;
        }
    }
    $out['env'] = $masked;
} else { $out['env'] = 'NO .env'; }

echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
