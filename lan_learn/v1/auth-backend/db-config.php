<?php
/**
 * Database configuration.
 * Uses env vars; create from db-config.example.php if missing.
 */
$path = __DIR__ . '/db-config.local.php';
if (file_exists($path)) {
    return require $path;
}
return require __DIR__ . '/db-config.example.php';
