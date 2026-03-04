<?php
/**
 * cache-headers.php
 * -------------------------------------------------------
 * Include this at the TOP of any PHP page to send
 * no-cache headers so browsers always fetch the latest.
 *
 * Usage:
 *   <?php require_once __DIR__ . '/cache-headers.php'; ?>
 * -------------------------------------------------------
 */

header("Cache-Control: no-cache, no-store, must-revalidate"); // HTTP 1.1
header("Pragma: no-cache");                                    // HTTP 1.0
header("Expires: 0");                                          // Proxies
