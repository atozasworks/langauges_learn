<?php
/**
 * MySQL config — auto-detects local (XAMPP) vs live (Hostinger).
 * Database: lan_learn_auth
 */

$isLocal = in_array($_SERVER['SERVER_NAME'] ?? '', ['localhost', '127.0.0.1'], true)
        || in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)
        || php_sapi_name() === 'cli';

if ($isLocal) {
    // ── Local XAMPP ──
    return [
        'host'     => '127.0.0.1',
        'port'     => 3306,
        'dbname'   => 'lan_learn_auth',
        'username' => 'root',
        'password' => '',
        'charset'  => 'utf8mb4',
    ];
}

// ── Live server (Hostinger) ──
return [
    'host'     => 'localhost',
    'port'     => 3306,
    'dbname'   => 'u893481695_lan_learn',
    'username' => 'u893481695_lan_learn_user',
    'password' => 'CDulsaapp@574221',
    'charset'  => 'utf8mb4',
];
