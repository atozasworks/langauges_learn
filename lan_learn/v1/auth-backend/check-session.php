<?php
/**
 * Return current session user as JSON for frontend.
 */

header('Content-Type: application/json');

require_once __DIR__ . '/session.php';

$user = auth_get_user();
if ($user) {
    echo json_encode([
        'logged_in' => true,
        'user'      => $user,
    ]);
} else {
    echo json_encode([
        'logged_in' => false,
        'user'      => null,
    ]);
}
exit;
