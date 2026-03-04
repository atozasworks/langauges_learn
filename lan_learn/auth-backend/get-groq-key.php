<?php
/**
 * Returns the Groq API key from the .env file.
 * Called by the front-end JS so the key is never hardcoded in client code.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/env-loader.php';
loadEnv(__DIR__ . '/../.env');

$key = env('GROQ_API_KEY');

if (!$key) {
    http_response_code(500);
    echo json_encode(['error' => 'GROQ_API_KEY not configured']);
    exit;
}

echo json_encode(['key' => $key]);
