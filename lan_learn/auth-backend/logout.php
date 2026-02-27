<?php
/**
 * Log out and redirect to app home.
 */

require_once __DIR__ . '/session.php';

auth_logout();

$base = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http')
    . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
$path = dirname(dirname($_SERVER['REQUEST_URI'] ?? '/lan_learn'));
header('Location: ' . $base . $path . '/index.html');
exit;
