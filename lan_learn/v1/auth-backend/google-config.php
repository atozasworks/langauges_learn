<?php
/**
 * Google OAuth config loader.
 */
$path = __DIR__ . '/google-config.local.php';
if (file_exists($path)) {
    return require $path;
}
return require __DIR__ . '/google-config.example.php';
