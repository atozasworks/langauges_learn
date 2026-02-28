<?php
/**
 * Secure session handling.
 */

if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', 1);
    ini_set('session.cookie_secure', isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 1 : 0);
    ini_set('session.use_strict_mode', 1);
    ini_set('session.cookie_samesite', 'Lax');
    session_start();
}

/**
 * Regenerate session ID to prevent fixation (call after login).
 */
function auth_regenerate_session(): void {
    session_regenerate_id(true);
}

/**
 * Set logged-in user in session.
 */
function auth_set_user(array $user): void {
    auth_regenerate_session();
    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['user_name'] = $user['name'] ?? '';
    $_SESSION['user_email'] = $user['email'] ?? '';
}

/**
 * Get current user from session or null.
 */
function auth_get_user(): ?array {
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    return [
        'id'    => $_SESSION['user_id'],
        'name'  => $_SESSION['user_name'] ?? '',
        'email' => $_SESSION['user_email'] ?? '',
    ];
}

/**
 * Check if user is logged in.
 */
function auth_is_logged_in(): bool {
    return auth_get_user() !== null;
}

/**
 * Log out (destroy session).
 */
function auth_logout(): void {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}
