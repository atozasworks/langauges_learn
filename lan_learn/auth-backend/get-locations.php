<?php
/**
 * GET /auth-backend/get-locations.php
 * Returns all stored location combinations for cascading dropdown suggestions.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/db.php';

try {
    $locations = function_exists('getAllLocations') ? getAllLocations() : [];

    echo json_encode(['success' => true, 'locations' => $locations]);
} catch (Throwable $e) {
    http_response_code(500);
    $response = ['success' => false, 'message' => 'Server error.'];
    if (in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'])) {
        $response['error_detail'] = $e->getMessage();
    }
    echo json_encode($response);
}
