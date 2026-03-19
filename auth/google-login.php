<?php
/**
 * google-login.php – Handle Google Identity Services credential callback.
 *
 * Accepts POST JSON: { "credential": "<Google ID token>", "csrf_token": "..." }
 * Verifies token server-side, creates/links user, starts session.
 * Returns JSON: { "success": true/false, "message": "...", "redirect": "dashboard.php" }
 */

// Catch all errors and return as JSON
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Global error handler: convert PHP errors to JSON response
set_error_handler(function ($severity, $message, $file, $line) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Server error', 'debug' => "$message in $file:$line"]);
    exit;
});

// Global exception handler
set_exception_handler(function ($e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Server error', 'debug' => $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine()]);
    exit;
});

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/google-config.php';

startSecureSession();

// Set proper headers
header('Content-Type: application/json; charset=utf-8');

// ── Only accept POST ───────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Invalid request method.'], 405);
}

// ── Parse JSON body ────────────────────────────────────────────
$input = json_decode(file_get_contents('php://input'), true);
$credential = $input['credential'] ?? '';
$csrfToken  = $input['csrf_token'] ?? '';

// ── CSRF validation ────────────────────────────────────────────
if (!validateCSRFToken($csrfToken)) {
    jsonResponse(['success' => false, 'message' => 'Invalid session. Please refresh the page.'], 403);
}

if (empty($credential)) {
    jsonResponse(['success' => false, 'message' => 'Missing Google credential.'], 400);
}

// ── Verify Google ID Token ─────────────────────────────────────
// Google provides a tokeninfo endpoint for simple verification.
// For production, use the google/apiclient library.
// This approach verifies via Google's oauth2 API securely.

$payload = verifyGoogleToken($credential);

if (!$payload) {
    jsonResponse(['success' => false, 'message' => 'Google authentication failed. Invalid token.'], 401);
}

$googleSub      = $payload['sub'];
$email          = strtolower(trim($payload['email']));
$emailVerified  = $payload['email_verified'] ?? false;
$name           = $payload['name'] ?? '';
$picture        = $payload['picture'] ?? '';

if (!$emailVerified) {
    jsonResponse(['success' => false, 'message' => 'Google email is not verified.'], 401);
}

// ── Find or create/link user ───────────────────────────────────
$db  = getDB();
$now = date('Y-m-d H:i:s');

// First check by google_sub
$stmt = $db->prepare("SELECT * FROM users WHERE google_sub = :sub LIMIT 1");
$stmt->execute([':sub' => $googleSub]);
$user = $stmt->fetch();

if (!$user) {
    // Check by email (could be existing OTP user)
    $stmt = $db->prepare("SELECT * FROM users WHERE email = :email LIMIT 1");
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if ($user) {
        // Link Google to existing account
        $newProvider = ($user['auth_provider'] === 'email_otp') ? 'both' : $user['auth_provider'];
        $stmt = $db->prepare(
            "UPDATE users SET google_sub = :sub, auth_provider = :prov, name = COALESCE(name, :name),
             profile_picture = COALESCE(profile_picture, :pic), updated_at = :now1, last_login_at = :now2
             WHERE id = :id"
        );
        $stmt->execute([
            ':sub'  => $googleSub,
            ':prov' => $newProvider,
            ':name' => $name,
            ':pic'  => $picture,
            ':now1' => $now,
            ':now2' => $now,
            ':id'   => $user['id'],
        ]);
        // Re-fetch updated user
        $stmt = $db->prepare("SELECT * FROM users WHERE id = :id");
        $stmt->execute([':id' => $user['id']]);
        $user = $stmt->fetch();
    } else {
        // Create brand new user
        $stmt = $db->prepare(
            "INSERT INTO users (email, name, auth_provider, google_sub, profile_picture, is_verified, created_at, last_login_at)
             VALUES (:email, :name, 'google', :sub, :pic, 1, :now1, :now2)"
        );
        $stmt->execute([
            ':email' => $email,
            ':name'  => $name,
            ':sub'   => $googleSub,
            ':pic'   => $picture,
            ':now1'  => $now,
            ':now2'  => $now,
        ]);

        $stmt = $db->prepare("SELECT * FROM users WHERE id = :id");
        $stmt->execute([':id' => $db->lastInsertId()]);
        $user = $stmt->fetch();
    }
} else {
    // Existing Google user – update last login & profile info
    $stmt = $db->prepare(
        "UPDATE users SET name = :name, profile_picture = :pic, last_login_at = :now WHERE id = :id"
    );
    $stmt->execute([':name' => $name, ':pic' => $picture, ':now' => $now, ':id' => $user['id']]);
}

// ── Audit log ──────────────────────────────────────────────────
$stmt = $db->prepare(
    "INSERT INTO login_audit (user_id, method, ip_address, user_agent, created_at)
     VALUES (:uid, 'google', :ip, :ua, :now)"
);
$stmt->execute([
    ':uid' => $user['id'],
    ':ip'  => getClientIP(),
    ':ua'  => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500),
    ':now' => $now,
]);

// ── Create session ─────────────────────────────────────────────
session_regenerate_id(true);

$_SESSION['user_id']   = (int)$user['id'];
$_SESSION['email']     = $user['email'];
$_SESSION['name']      = $user['name'] ?? $name;
$_SESSION['provider']  = $user['auth_provider'];
$_SESSION['picture']   = $user['profile_picture'] ?? $picture;
$_SESSION['logged_in'] = true;

jsonResponse([
    'success'  => true,
    'message'  => 'Google login successful!',
    'redirect' => '/spokenenglish/AtoZ_Services/lan_learn/index.php'
]);

// ────────────────────────────────────────────────────────────────
// Google Token Verification
// ────────────────────────────────────────────────────────────────

/**
 * Verify a Google ID token by decoding the JWT and checking with Google's certs.
 * Uses Google's tokeninfo endpoint for simplicity.
 * For high-traffic production, use the google-api-php-client library instead.
 *
 * @param string $idToken The Google ID token (JWT)
 * @return array|null Decoded payload or null on failure
 */
function verifyGoogleToken(string $idToken): ?array {
    // Step 1: Decode the JWT without verification to get the header
    $parts = explode('.', $idToken);
    if (count($parts) !== 3) {
        return null;
    }

    // Step 2: Verify with Google's oauth2/v3 tokeninfo endpoint
    $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) {
        return null;
    }

    $payload = json_decode($response, true);
    if (!$payload || json_last_error() !== JSON_ERROR_NONE) {
        return null;
    }

    // Step 3: Validate audience (aud) matches our client ID
    if (($payload['aud'] ?? '') !== GOOGLE_CLIENT_ID) {
        return null;
    }

    // Step 4: Validate issuer
    $validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!in_array($payload['iss'] ?? '', $validIssuers, true)) {
        return null;
    }

    // Step 5: Validate expiry
    if (isset($payload['exp']) && (int)$payload['exp'] < time()) {
        return null;
    }

    return $payload;
}
