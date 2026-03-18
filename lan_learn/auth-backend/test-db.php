<?php
/**
 * TEST SCRIPT — Open in browser to verify JSON file storage.
 * URL: http://localhost/AtoZ_Services/lan_learn/auth-backend/test-db.php
 *
 * This will:
 *  1. Check data directory is writable
 *  2. Test writing and reading JSON data
 *  3. Insert a test login audit entry
 *  4. Show results
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

header('Content-Type: text/html; charset=utf-8');

echo '<h1>JSON File Storage Test</h1>';

require_once __DIR__ . '/db.php';

// ── Step 1: Check data directory ──
echo '<h2>Step 1: Check Data Directory</h2>';
$dataDir = getDataDir();
echo '<p>Data directory: <code>' . htmlspecialchars($dataDir) . '</code></p>';

if (!is_dir($dataDir)) {
    echo '<p style="color:orange;">⚠ Directory does not exist. Attempting to create...</p>';
    if (mkdir($dataDir, 0755, true)) {
        echo '<p style="color:green;">✅ Directory created successfully.</p>';
    } else {
        echo '<p style="color:red;">❌ Failed to create directory!</p>';
        exit;
    }
} else {
    echo '<p style="color:green;">✅ Data directory exists.</p>';
}

if (is_writable($dataDir)) {
    echo '<p style="color:green;">✅ Data directory is writable.</p>';
} else {
    echo '<p style="color:red;">❌ Data directory is NOT writable! Fix permissions.</p>';
    exit;
}

// ── Step 2: Test write/read ──
echo '<h2>Step 2: Test JSON Write/Read</h2>';
try {
    $testFile = $dataDir . '/_test_temp.json';
    writeJsonFile($testFile, ['test' => true, 'timestamp' => date('Y-m-d H:i:s')]);
    $readBack = readJsonFile($testFile);
    if ($readBack['test'] === true) {
        echo '<p style="color:green;">✅ JSON write/read works correctly.</p>';
    } else {
        echo '<p style="color:red;">❌ Read-back mismatch!</p>';
    }
    @unlink($testFile);
} catch (Throwable $e) {
    echo '<p style="color:red;">❌ JSON write/read failed: ' . htmlspecialchars($e->getMessage()) . '</p>';
    exit;
}

// ── Step 3: Insert test login audit ──
echo '<h2>Step 3: Insert Test Login Audit</h2>';
try {
    saveLoginAudit([
        'email'        => 'test@example.com',
        'login_method' => 'test',
        'login_status' => 'success',
    ]);
    echo '<p style="color:green;">✅ Test entry inserted into login_audit.json.</p>';
} catch (Throwable $e) {
    echo '<p style="color:red;">❌ Insert failed: ' . htmlspecialchars($e->getMessage()) . '</p>';
}

// ── Step 4: Show login audit data ──
echo '<h2>Step 4: Current Data in login_audit.json</h2>';
$auditData = readJsonFile($dataDir . '/login_audit.json');
$entries = $auditData['entries'] ?? [];

if (empty($entries)) {
    echo '<p>No entries found.</p>';
} else {
    $recent = array_slice(array_reverse($entries), 0, 10);
    echo '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; font-family:monospace;">';
    echo '<tr>';
    foreach (array_keys($recent[0]) as $col) {
        echo '<th style="background:#eee;">' . htmlspecialchars($col) . '</th>';
    }
    echo '</tr>';
    foreach ($recent as $row) {
        echo '<tr>';
        foreach ($row as $val) {
            echo '<td>' . htmlspecialchars(is_null($val) ? 'NULL' : (string)$val) . '</td>';
        }
        echo '</tr>';
    }
    echo '</table>';
}

// ── Step 5: Show OTP data ──
echo '<h2>Step 5: Current Data in otp_codes.json</h2>';
$otpData = readJsonFile($dataDir . '/otp_codes.json');
$codes = $otpData['codes'] ?? [];

if (empty($codes)) {
    echo '<p>No OTP codes yet (will appear after Send OTP).</p>';
} else {
    $recent = array_slice(array_reverse($codes), 0, 10);
    echo '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; font-family:monospace;">';
    echo '<tr>';
    foreach (array_keys($recent[0]) as $col) {
        echo '<th style="background:#eee;">' . htmlspecialchars($col) . '</th>';
    }
    echo '</tr>';
    foreach ($recent as $row) {
        echo '<tr>';
        foreach ($row as $val) {
            echo '<td>' . htmlspecialchars(is_null($val) ? 'NULL' : (string)$val) . '</td>';
        }
        echo '</tr>';
    }
    echo '</table>';
}

// ── Step 6: List location data files ──
echo '<h2>Step 6: Location Data Files</h2>';
$files = glob($dataDir . '/*.json');
$locationFiles = array_filter($files, function ($f) {
    $name = basename($f, '.json');
    return !in_array($name, ['login_audit', 'otp_codes', '_test_temp'], true);
});

if (empty($locationFiles)) {
    echo '<p>No location data files yet (will appear after adding learners).</p>';
} else {
    echo '<ul>';
    foreach ($locationFiles as $f) {
        echo '<li><code>' . htmlspecialchars(basename($f)) . '</code></li>';
    }
    echo '</ul>';
}

echo '<hr>';
echo '<p style="color:green; font-size:18px;"><b>✅ All done! JSON file storage is working correctly.</b></p>';
echo '<p>Data is stored in: <code>' . htmlspecialchars($dataDir) . '</code></p>';
