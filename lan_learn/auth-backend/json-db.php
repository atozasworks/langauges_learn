<?php
define('JSON_DB_LOADED', true);
/**
 * JSON file-based database — drop-in replacement for MySQL functions in db.php.
 * Stores data in JSON files under auth-backend/json-data/.
 *
 * File structure:
 *   json-data/
 *     otp_codes.json       – OTP records
 *     login_audit.json     – Login audit log
 *     locations.json       – All entered location combinations
 *     learners/
 *       {email_safe}.json  – One file per user (email-based)
 */

error_reporting(E_ALL);

/**
 * Get the JSON data directory from config or default.
 */
function getJsonDataDir(): string
{
    static $dir = null;
    if ($dir !== null) {
        return $dir;
    }

    $localFile = __DIR__ . '/db-config.local.php';
    if (is_file($localFile)) {
        $cfg = require $localFile;
        if (is_array($cfg) && !empty($cfg['data_dir'])) {
            $dir = rtrim($cfg['data_dir'], '/\\');
            return $dir;
        }
    }

    $dir = __DIR__ . '/json-data';
    return $dir;
}

/**
 * Ensure the data directory and subdirectories exist.
 */
function ensureJsonDataDirs(): void
{
    $base = getJsonDataDir();
    $dirs = [$base, $base . '/learners'];
    foreach ($dirs as $d) {
        if (!is_dir($d)) {
            mkdir($d, 0755, true);
        }
    }
}

/**
 * Read a JSON file and return its contents as an array.
 */
function readJsonFile(string $path): array
{
    if (!is_file($path)) {
        return [];
    }
    $content = file_get_contents($path);
    if ($content === false || $content === '') {
        return [];
    }
    $data = json_decode($content, true);
    return is_array($data) ? $data : [];
}

/**
 * Write data to a JSON file atomically.
 */
function writeJsonFile(string $path, array $data): void
{
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    $tmpFile = $path . '.tmp.' . getmypid();
    if (file_put_contents($tmpFile, $json, LOCK_EX) === false) {
        throw new RuntimeException('Failed to write JSON data file.');
    }
    rename($tmpFile, $path);
}

/**
 * Convert email to a safe filename.
 * e.g., "user@gmail.com" → "user_gmail.com"
 */
function emailToFilename(string $email): string
{
    $email = strtolower(trim($email));
    // Replace @ with underscore, remove filesystem-unsafe chars
    $safe = str_replace('@', '_', $email);
    $safe = preg_replace('/[\/\\\\:*?"<>|]/', '', $safe);
    return $safe;
}

/**
 * Get the path to a learner JSON file for a specific user (email-based).
 */
function getLearnerFilePath(string $email): string
{
    ensureJsonDataDirs();
    $filename = emailToFilename($email);
    return getJsonDataDir() . '/learners/' . $filename . '.json';
}

/* ────────────────────────────────────────────
   Learning Team helpers — JSON file-based
   One file per user email. Each learner entry
   stores its own location data inside the file.
   ──────────────────────────────────────────── */

/**
 * Get all learners for a specific user.
 */
function getLearnersByUser(string $email, array $location = []): array
{
    $filePath = getLearnerFilePath($email);
    $allLearners = readJsonFile($filePath);

    return array_map(function ($l) {
        return [
            'id'           => $l['id'],
            'learner_name' => $l['learner_name'],
        ];
    }, $allLearners);
}

/**
 * Add a learner to a user's file. Returns the new row id.
 */
function addLearner(string $email, string $name, array $location = []): int
{
    $filePath    = getLearnerFilePath($email);
    $allLearners = readJsonFile($filePath);

    // Check for duplicate name (same name + same location)
    foreach ($allLearners as $l) {
        if (strtolower($l['learner_name']) === strtolower($name) &&
            ($l['country']  ?? '') === ($location['country']  ?? '') &&
            ($l['region']   ?? '') === ($location['region']   ?? '') &&
            ($l['district'] ?? '') === ($location['district'] ?? '') &&
            ($l['place']    ?? '') === ($location['place']    ?? '')) {
            throw new RuntimeException('DUPLICATE_ENTRY');
        }
    }

    // Generate next ID
    $maxId = 0;
    foreach ($allLearners as $l) {
        if (($l['id'] ?? 0) > $maxId) {
            $maxId = $l['id'];
        }
    }
    $newId = $maxId + 1;

    $allLearners[] = [
        'id'           => $newId,
        'learner_name' => $name,
        'country'      => $location['country']  ?? '',
        'region'       => $location['region']   ?? '',
        'district'     => $location['district'] ?? '',
        'place'        => $location['place']    ?? '',
        'created_at'   => date('Y-m-d H:i:s'),
    ];

    writeJsonFile($filePath, $allLearners);

    // Also update locations.json with this location combo
    updateLocationsIndex($location);

    return $newId;
}

/**
 * Delete a learner from a user's file (by ID).
 */
function deleteLearner(string $email, int $learnerId, array $location = []): bool
{
    $filePath    = getLearnerFilePath($email);
    $allLearners = readJsonFile($filePath);

    $found = false;
    $allLearners = array_values(array_filter($allLearners, function ($l) use ($learnerId, &$found) {
        if ($l['id'] === $learnerId) {
            $found = true;
            return false;
        }
        return true;
    }));

    if (!$found) {
        return false;
    }

    writeJsonFile($filePath, $allLearners);
    return true;
}

/* ────────────────────────────────────────────
   Login Audit — JSON file-based
   ──────────────────────────────────────────── */

/**
 * Save a login event to JSON.
 */
function saveLoginAudit(array $rec): void
{
    ensureJsonDataDirs();

    $filePath = getJsonDataDir() . '/login_audit.json';
    $data = readJsonFile($filePath);

    $data[] = [
        'email'            => $rec['email'] ?? '',
        'login_method'     => $rec['login_method'] ?? 'unknown',
        'provider_user_id' => $rec['provider_user_id'] ?? null,
        'display_name'     => $rec['display_name'] ?? null,
        'login_status'     => $rec['login_status'] ?? 'success',
        'client_ip'        => $_SERVER['REMOTE_ADDR'] ?? null,
        'user_agent'       => $_SERVER['HTTP_USER_AGENT'] ?? null,
        'created_at'       => date('Y-m-d H:i:s'),
    ];

    // Keep only last 500 audit entries to prevent file bloat
    if (count($data) > 500) {
        $data = array_slice($data, -500);
    }

    writeJsonFile($filePath, $data);
}

/* ────────────────────────────────────────────
   OTP codes — JSON file-based
   ──────────────────────────────────────────── */

/**
 * Save OTP hash; expire previous unused OTPs for the same email.
 */
function saveOtpCode(string $email, string $otp, int $ttl = 300): void
{
    ensureJsonDataDirs();

    $filePath = getJsonDataDir() . '/otp_codes.json';
    $data = readJsonFile($filePath);

    // Mark old unused OTPs for this email as used
    foreach ($data as &$row) {
        if ($row['email'] === $email && $row['used_at'] === null) {
            $row['used_at'] = date('Y-m-d H:i:s');
        }
    }
    unset($row);

    // Add new OTP
    $data[] = [
        'id'         => count($data) + 1,
        'email'      => $email,
        'otp_hash'   => password_hash($otp, PASSWORD_DEFAULT),
        'expires_at' => date('Y-m-d H:i:s', time() + $ttl),
        'used_at'    => null,
        'created_at' => date('Y-m-d H:i:s'),
    ];

    // Cleanup: keep only last 200 OTP entries to prevent file bloat
    if (count($data) > 200) {
        $data = array_slice($data, -200);
    }

    writeJsonFile($filePath, $data);
}

/**
 * Verify OTP — checks latest unused row for the email.
 */
function verifyOtpCode(string $email, string $otp): bool
{
    ensureJsonDataDirs();

    $filePath = getJsonDataDir() . '/otp_codes.json';
    $data = readJsonFile($filePath);

    // Find latest unused OTP for this email
    $latestRow   = null;
    $latestIndex = -1;

    foreach ($data as $i => $row) {
        if ($row['email'] === $email && $row['used_at'] === null) {
            $latestRow   = $row;
            $latestIndex = $i;
        }
    }

    if ($latestRow === null) {
        return false;
    }

    // Check expiry
    if (strtotime($latestRow['expires_at']) < time()) {
        return false;
    }

    // Verify hash
    if (!password_verify($otp, $latestRow['otp_hash'])) {
        return false;
    }

    // Mark as used
    $data[$latestIndex]['used_at'] = date('Y-m-d H:i:s');
    writeJsonFile($filePath, $data);

    return true;
}

/* ────────────────────────────────────────────
   Locations index — tracks all location combos
   ──────────────────────────────────────────── */

/**
 * Add a location combo to the index (if not already present).
 */
function updateLocationsIndex(array $location): void
{
    ensureJsonDataDirs();

    $filePath  = getJsonDataDir() . '/locations.json';
    $locations = readJsonFile($filePath);

    $entry = [
        'country'  => trim($location['country']  ?? ''),
        'region'   => trim($location['region']   ?? ''),
        'district' => trim($location['district'] ?? ''),
        'place'    => trim($location['place']    ?? ''),
    ];

    // Check if already exists
    foreach ($locations as $loc) {
        if ($loc['country']  === $entry['country'] &&
            $loc['region']   === $entry['region'] &&
            $loc['district'] === $entry['district'] &&
            $loc['place']    === $entry['place']) {
            return;
        }
    }

    $locations[] = $entry;
    writeJsonFile($filePath, $locations);
}

/**
 * Get all stored location combinations.
 */
function getAllLocations(): array
{
    ensureJsonDataDirs();

    $filePath = getJsonDataDir() . '/locations.json';
    return readJsonFile($filePath);
}
