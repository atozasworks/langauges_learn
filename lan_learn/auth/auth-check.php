<?php
/**
 * auth-check.php – Include this at the top of every protected page.
 *
 * Usage:
 *   <?php require_once __DIR__ . '/auth-check.php'; ?>
 *
 * If user is not logged in, they are redirected to login.php.
 */

require_once __DIR__ . '/config.php';

startSecureSession();

if (empty($_SESSION['user_id'])) {
    header('Location: ' . appPath('/auth/login.php'));
    exit;
}
