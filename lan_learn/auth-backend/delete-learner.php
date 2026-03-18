<?php
/**
 * POST /auth-backend/delete-learner.php
 * Body: { "email": "...", "learner_id": 123 }
 * Deletes a learner from the logged-in user's team (only if it belongs to them).
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/db.php';

try {
    $body      = json_decode(file_get_contents('php://input'), true);
    $email     = trim($body['email'] ?? '');
    $learnerId = (int) ($body['learner_id'] ?? 0);

    // Location fields (for JSON file-based storage)
    $location = [
        'country'  => trim($body['country']  ?? ''),
        'region'   => trim($body['region']   ?? ''),
        'district' => trim($body['district'] ?? ''),
        'place'    => trim($body['place']    ?? ''),
    ];

    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Valid email is required.']);
        exit;
    }

    if ($learnerId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Valid learner_id is required.']);
        exit;
    }

    $deleted = deleteLearner($email, $learnerId, $location);

    if ($deleted) {
        echo json_encode(['success' => true, 'message' => 'Learner removed from your team.']);
    } else {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Learner not found or does not belong to you.']);
    }
} catch (Throwable $e) {
    http_response_code(500);
    $response = ['success' => false, 'message' => 'Server error.'];
    if (in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'])) {
        $response['error_detail'] = $e->getMessage();
    }
    echo json_encode($response);
}
