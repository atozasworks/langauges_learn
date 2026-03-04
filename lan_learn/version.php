<?php
/**
 * version.php — Auto cache-busting helper
 * -------------------------------------------------------
 * Generates a version query string based on the file's
 * last-modified timestamp. When a file changes on the
 * server, the version string changes automatically,
 * forcing browsers to download the new version.
 *
 * Usage in a PHP-rendered page:
 *
 *   <?php require_once __DIR__ . '/version.php'; ?>
 *   <link rel="stylesheet" href="styles/style.css<?= v('styles/style.css') ?>">
 *   <script src="js/App.js<?= v('js/App.js') ?>"></script>
 *
 * Output example:
 *   styles/style.css?v=1709537412
 * -------------------------------------------------------
 */

/**
 * Return a cache-busting query string like "?v=1709537412"
 * based on the file's last-modified time. Falls back to
 * the current timestamp if the file cannot be found.
 *
 * @param string $filePath  Path relative to this file's directory (or absolute)
 * @return string           e.g. "?v=1709537412"
 */
function v(string $filePath): string
{
    // Resolve relative to the document root first, then fallback to __DIR__
    $candidates = [
        $_SERVER['DOCUMENT_ROOT'] . '/' . ltrim($filePath, '/'),
        __DIR__ . '/' . ltrim($filePath, '/'),
        $filePath, // absolute path
    ];

    foreach ($candidates as $path) {
        if (file_exists($path)) {
            return '?v=' . filemtime($path);
        }
    }

    // File not found — use current timestamp (always bust cache)
    return '?v=' . time();
}
