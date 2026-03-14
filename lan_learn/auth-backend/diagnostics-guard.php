<?php
/**
 * Guard for diagnostic endpoints.
 *
 * Access policy:
 * - Always allow localhost requests (127.0.0.1 / ::1)
 * - Allow remote access only when ALLOW_DIAGNOSTICS=true-ish
 * - Otherwise return 404
 */

require_once __DIR__ . '/env-loader.php';

loadEnv(dirname(__DIR__) . '/.env');
if (!empty($_SERVER['DOCUMENT_ROOT'])) {
    loadEnv($_SERVER['DOCUMENT_ROOT'] . '/.env');
}

function diagnosticsIsLocalRequest(): bool
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    return in_array($ip, ['127.0.0.1', '::1'], true);
}

function diagnosticsEnvEnabled(): bool
{
    $raw = getenv('ALLOW_DIAGNOSTICS');
    if ($raw === false) {
        return false;
    }

    $value = strtolower(trim((string) $raw));
    return in_array($value, ['1', 'true', 'yes', 'on'], true);
}

function requireDiagnosticsAccess(string $responseType = 'text'): void
{
    if (diagnosticsIsLocalRequest() || diagnosticsEnvEnabled()) {
        return;
    }

    http_response_code(404);

    if ($responseType === 'json') {
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Not found']);
        exit;
    }

    if ($responseType === 'html') {
        header('Content-Type: text/html; charset=utf-8');
        echo '<h1>Not found</h1>';
        exit;
    }

    header('Content-Type: text/plain; charset=utf-8');
    echo 'Not found';
    exit;
}
