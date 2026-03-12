<?php
/**
 * POST /auth-backend/update-learner.php
 * Body: { "email": "...", "learner_id": 123, "name": "..." }
 * Updates a learner for the logged-in user only.
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
    $body = json_decode(file_get_contents('php://input'), true);
    $email = trim($body['email'] ?? '');
    $learnerId = (int) ($body['learner_id'] ?? 0);
    $name = trim($body['name'] ?? '');

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

    if ($name === '' || mb_strlen($name) < 2) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Learner name must be at least 2 characters.']);
        exit;
    }

    $formattedName = mb_convert_case($name, MB_CASE_TITLE, 'UTF-8');
    $updated = updateLearner($email, $learnerId, $formattedName);

    if (!$updated) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Learner not found or does not belong to you.']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Learner updated successfully.',
        'learner' => [
            'id' => $learnerId,
            'name' => $formattedName,
        ],
    ]);
} catch (Throwable $e) {
    if ((int) $e->getCode() === 409 || stripos($e->getMessage(), 'duplicate') !== false) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'This learner already exists in your team.']);
        exit;
    }

    http_response_code(500);
    $response = ['success' => false, 'message' => 'Server error.'];
    if (in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)) {
        $response['error_detail'] = $e->getMessage();
    }
    echo json_encode($response);
}
