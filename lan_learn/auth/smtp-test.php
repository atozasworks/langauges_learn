<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if (!app_debug()) {
    json_response(['ok' => false, 'message' => 'Disabled.'], 403);
}

$email = strtolower(trim((string) ($_GET['email'] ?? '')));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['ok' => false, 'message' => 'Use ?email=you@example.com'], 422);
}

try {
    send_email_smtp(
        $email,
        'SMTP Test - GTongue Learn',
        '<p>SMTP test successful at ' . htmlspecialchars(gmdate('c'), ENT_QUOTES, 'UTF-8') . '</p>'
    );
    json_response(['ok' => true, 'message' => 'Test email sent.']);
} catch (Throwable $e) {
    auth_log('SMTP test failed for ' . $email . ' :: ' . $e->getMessage());
    json_response(['ok' => false, 'message' => $e->getMessage()], 500);
}