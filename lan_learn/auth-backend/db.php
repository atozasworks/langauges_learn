<?php
/**
 * JSON file-based database helper — replaces MySQL.
 * Stores data in the data/ directory as JSON files.
 *
 * Data files:
 *   - data/login_audit.json                          (login events)
 *   - data/otp_codes.json                            (OTP codes)
 *   - data/{country}_{region}_{district}_{place}.json (learners per location)
 */

error_reporting(E_ALL);

/**
 * Get the data directory path from config or default.
 */
function getDataDir(): string
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
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            return $dir;
        }
    }

    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    return $dir;
}

/**
 * Sanitize a single location segment for use in filenames.
 */
function sanitizeSegment(string $s): string
{
    $s = trim($s);
    $s = str_replace(' ', '-', $s);
    return preg_replace('/[^a-zA-Z0-9-]/', '', $s);
}

/**
 * Build a safe filename key from location fields.
 * Empty fields are preserved as empty segments between underscores.
 */
function buildLocationKey(string $country, string $region, string $district, string $place): string
{
    $parts = array_map('sanitizeSegment', [$country, $region, $district, $place]);
    $key = implode('_', $parts);
    // If all fields are empty the key is "___" — use a default
    if (preg_match('/^_*$/', $key)) {
        $key = '_default';
    }
    return $key;
}

/**
 * Get the file path for a location-based learner JSON file.
 */
function getLocationFilePath(string $country, string $region, string $district, string $place): string
{
    return getDataDir() . '/' . buildLocationKey($country, $region, $district, $place) . '.json';
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
 * Write data to a JSON file with exclusive file locking.
 */
function writeJsonFile(string $path, array $data): void
{
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }

    $fp = fopen($path, 'c');
    if (!$fp) {
        throw new RuntimeException("Cannot open file: $path");
    }

    if (flock($fp, LOCK_EX)) {
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        fflush($fp);
        flock($fp, LOCK_UN);
    } else {
        fclose($fp);
        throw new RuntimeException("Cannot lock file: $path");
    }

    fclose($fp);
}

/* ────────────────────────────────────────────
   Learning Team helpers
   ──────────────────────────────────────────── */

/**
 * Get all learners for a specific user at a given location.
 */
function getLearnersByUser(string $email, string $country = '', string $region = '', string $district = '', string $place = ''): array
{
    $filePath = getLocationFilePath($country, $region, $district, $place);
    $data = readJsonFile($filePath);
    return $data['users'][$email]['learners'] ?? [];
}

/**
 * Add a learner to a user's team at a given location. Returns the new row id.
 * Throws RuntimeException with message 'DUPLICATE_ENTRY' on duplicate.
 */
function addLearner(string $email, string $name, string $country = '', string $region = '', string $district = '', string $place = ''): int
{
    $filePath = getLocationFilePath($country, $region, $district, $place);
    $data = readJsonFile($filePath);

    // Initialize structure
    if (!isset($data['location'])) {
        $data['location'] = compact('country', 'region', 'district', 'place');
    }
    if (!isset($data['users'])) {
        $data['users'] = [];
    }
    if (!isset($data['users'][$email])) {
        $data['users'][$email] = ['learners' => []];
    }

    // Duplicate check
    foreach ($data['users'][$email]['learners'] as $learner) {
        if (strcasecmp($learner['learner_name'], $name) === 0) {
            throw new RuntimeException('DUPLICATE_ENTRY');
        }
    }

    // Generate next ID (global across all users in this file)
    $maxId = 0;
    foreach ($data['users'] as $userData) {
        foreach ($userData['learners'] ?? [] as $l) {
            if (($l['id'] ?? 0) > $maxId) {
                $maxId = $l['id'];
            }
        }
    }
    $newId = $maxId + 1;

    $data['users'][$email]['learners'][] = [
        'id'           => $newId,
        'learner_name' => $name,
        'created_at'   => date('Y-m-d H:i:s'),
    ];

    writeJsonFile($filePath, $data);
    return $newId;
}

/**
 * Delete a learner from a user's team at a given location.
 */
function deleteLearner(string $email, int $learnerId, string $country = '', string $region = '', string $district = '', string $place = ''): bool
{
    $filePath = getLocationFilePath($country, $region, $district, $place);
    $data = readJsonFile($filePath);

    if (!isset($data['users'][$email]['learners'])) {
        return false;
    }

    $found = false;
    $data['users'][$email]['learners'] = array_values(
        array_filter($data['users'][$email]['learners'], function ($l) use ($learnerId, &$found) {
            if ($l['id'] === $learnerId) {
                $found = true;
                return false;
            }
            return true;
        })
    );

    if ($found) {
        writeJsonFile($filePath, $data);
    }

    return $found;
}

/* ────────────────────────────────────────────
   Login Audit helpers
   ──────────────────────────────────────────── */

/**
 * Save a login event to login_audit.json.
 */
function saveLoginAudit(array $rec): void
{
    $filePath = getDataDir() . '/login_audit.json';
    $data = readJsonFile($filePath);

    if (!isset($data['entries'])) {
        $data['entries'] = [];
    }

    $maxId = 0;
    foreach ($data['entries'] as $entry) {
        if (($entry['id'] ?? 0) > $maxId) {
            $maxId = $entry['id'];
        }
    }

    $data['entries'][] = [
        'id'               => $maxId + 1,
        'email'            => $rec['email'] ?? '',
        'login_method'     => $rec['login_method'] ?? 'unknown',
        'provider_user_id' => $rec['provider_user_id'] ?? null,
        'display_name'     => $rec['display_name'] ?? null,
        'login_status'     => $rec['login_status'] ?? 'success',
        'client_ip'        => $_SERVER['REMOTE_ADDR'] ?? null,
        'user_agent'       => $_SERVER['HTTP_USER_AGENT'] ?? null,
        'created_at'       => date('Y-m-d H:i:s'),
    ];

    writeJsonFile($filePath, $data);
}

/* ────────────────────────────────────────────
   OTP helpers
   ──────────────────────────────────────────── */

/**
 * Save OTP hash; expire previous unused OTPs for the same email.
 */
function saveOtpCode(string $email, string $otp, int $ttl = 300): void
{
    $filePath = getDataDir() . '/otp_codes.json';
    $data = readJsonFile($filePath);

    if (!isset($data['codes'])) {
        $data['codes'] = [];
    }

    // Expire old unused OTPs for this email
    foreach ($data['codes'] as &$code) {
        if ($code['email'] === $email && $code['used_at'] === null) {
            $code['used_at'] = date('Y-m-d H:i:s');
        }
    }
    unset($code);

    $maxId = 0;
    foreach ($data['codes'] as $c) {
        if (($c['id'] ?? 0) > $maxId) {
            $maxId = $c['id'];
        }
    }

    $expiresAt = date('Y-m-d H:i:s', time() + $ttl);

    $data['codes'][] = [
        'id'         => $maxId + 1,
        'email'      => $email,
        'otp_hash'   => password_hash($otp, PASSWORD_DEFAULT),
        'expires_at' => $expiresAt,
        'used_at'    => null,
        'created_at' => date('Y-m-d H:i:s'),
    ];

    writeJsonFile($filePath, $data);
}

/**
 * Verify OTP — checks latest unused code for the email.
 */
function verifyOtpCode(string $email, string $otp): bool
{
    $filePath = getDataDir() . '/otp_codes.json';
    $data = readJsonFile($filePath);

    if (empty($data['codes'])) {
        return false;
    }

    // Find latest unused OTP for this email
    $candidates = array_filter($data['codes'], function ($c) use ($email) {
        return $c['email'] === $email && $c['used_at'] === null;
    });

    if (empty($candidates)) {
        return false;
    }

    // Sort descending by id to get the latest
    usort($candidates, fn($a, $b) => ($b['id'] ?? 0) - ($a['id'] ?? 0));
    $latest = $candidates[0];

    // Check expiry
    if (strtotime($latest['expires_at']) < time()) {
        return false;
    }

    // Verify hash
    if (!password_verify($otp, $latest['otp_hash'])) {
        return false;
    }

    // Mark as used
    foreach ($data['codes'] as &$code) {
        if ($code['id'] === $latest['id']) {
            $code['used_at'] = date('Y-m-d H:i:s');
            break;
        }
    }
    unset($code);

    writeJsonFile($filePath, $data);
    return true;
}
