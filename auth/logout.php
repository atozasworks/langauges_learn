<?php
/**
 * logout.php – Destroy session and redirect to login page.
 */

require_once __DIR__ . '/config.php';

startSecureSession();

// Clear all session variables
$_SESSION = [];

// Delete the session cookie
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

// Destroy the session
session_destroy();

header('Location: /spokenenglish/AtoZ_Services/auth/login.php');
exit;
