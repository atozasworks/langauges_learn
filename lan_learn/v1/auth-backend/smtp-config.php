<?php
/**
 * SMTP configuration loader.
 */
$path = __DIR__ . '/smtp-config.local.php';
if (file_exists($path)) {
    return require $path;
}
return require __DIR__ . '/smtp-config.example.php';
