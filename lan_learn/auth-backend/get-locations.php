<?php
/**
 * GET /auth-backend/get-locations.php
 * Scans existing JSON data files and returns unique location values
 * for autocomplete suggestions.
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

$dataDir = getDataDir();

$locations = [
    'countries' => [],
    'regions'   => [],
    'districts' => [],
    'places'    => [],
];

if (!is_dir($dataDir)) {
    echo json_encode(['success' => true, 'locations' => $locations]);
    exit;
}

$files = glob($dataDir . '/*.json');
foreach ($files as $file) {
    $name = basename($file, '.json');
    // Skip non-location data files
    if (in_array($name, ['login_audit', 'otp_codes'], true)) {
        continue;
    }

    $data = json_decode(file_get_contents($file), true);
    if (!is_array($data) || !isset($data['location'])) {
        continue;
    }

    $loc = $data['location'];
    if (!empty($loc['country']))  $locations['countries'][] = $loc['country'];
    if (!empty($loc['region']))   $locations['regions'][]   = $loc['region'];
    if (!empty($loc['district'])) $locations['districts'][] = $loc['district'];
    if (!empty($loc['place']))    $locations['places'][]    = $loc['place'];
}

// Unique, sorted
$locations['countries'] = array_values(array_unique($locations['countries']));
$locations['regions']   = array_values(array_unique($locations['regions']));
$locations['districts'] = array_values(array_unique($locations['districts']));
$locations['places']    = array_values(array_unique($locations['places']));

sort($locations['countries']);
sort($locations['regions']);
sort($locations['districts']);
sort($locations['places']);

echo json_encode(['success' => true, 'locations' => $locations]);
