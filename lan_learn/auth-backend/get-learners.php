<?php
/**
 * GET /auth-backend/get-learners.php?email=user@example.com
 * Returns all learners belonging to the logged-in user.
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
    $email = trim($_GET['email'] ?? '');

    // Location fields (for JSON file-based storage)
    $location = [
        'country'  => trim($_GET['country']  ?? ''),
        'region'   => trim($_GET['region']   ?? ''),
        'district' => trim($_GET['district'] ?? ''),
        'place'    => trim($_GET['place']    ?? ''),
    ];

    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Valid email parameter is required.']);
        exit;
    }

    $learners = getLearnersByUser($email, $location);

    // Map to front-end friendly format
    $result = array_map(function ($row) {
        return [
            'id'   => (int) $row['id'],
            'name' => $row['learner_name'],
        ];
    }, $learners);

    echo json_encode(['success' => true, 'learners' => $result]);
} catch (Throwable $e) {
    http_response_code(500);
    $response = ['success' => false, 'message' => 'Server error.'];
    if (in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'])) {
        $response['error_detail'] = $e->getMessage();
    }
    echo json_encode($response);
}
