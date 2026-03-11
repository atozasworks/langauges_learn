<?php
/**
 * TEST SCRIPT — Open in browser to verify MongoDB connection.
 * URL: http://localhost/AtoZ_Services/lan_learn/auth-backend/test-db.php
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

header('Content-Type: text/html; charset=utf-8');

echo '<h1>MongoDB Database Test</h1>';

echo '<h2>Step 1: Check PHP Extension</h2>';
if (!extension_loaded('mongodb')) {
    echo '<p style="color:red;">FAIL: mongodb extension is NOT loaded.</p>';
    echo '<p>Fix: enable <code>extension=mongodb</code> in php.ini and restart Apache.</p>';
    exit;
}
echo '<p style="color:green;">OK: mongodb extension is loaded.</p>';

try {
    require_once __DIR__ . '/db.php';

    echo '<h2>Step 2: Connect to MongoDB</h2>';
    $manager = getLoginDbConnection();
    $cfg = getDbConfig();
    $dbName = $cfg['dbname'] ?? 'lldb';

    $manager->executeCommand('admin', new MongoDB\Driver\Command(['ping' => 1]));
    echo '<p style="color:green;">OK: Connected to MongoDB server.</p>';

    echo '<h2>Step 3: Insert test login audit row</h2>';
    saveLoginAudit([
        'email' => 'test@example.com',
        'login_method' => 'test',
        'provider_user_id' => null,
        'display_name' => 'Test User',
        'login_status' => 'success',
    ]);
    echo '<p style="color:green;">OK: Inserted test row in login_audit.</p>';

    echo '<h2>Step 4: Read recent login_audit rows</h2>';
    $query = new MongoDB\Driver\Query([], [
        'sort' => ['created_at' => -1],
        'limit' => 10,
        'projection' => ['_id' => 0],
    ]);
    $rows = $manager->executeQuery($dbName . '.login_audit', $query)->toArray();

    if (empty($rows)) {
        echo '<p>No rows found.</p>';
    } else {
        echo '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; font-family:monospace;">';
        echo '<tr><th style="background:#eee;">email</th><th style="background:#eee;">login_method</th><th style="background:#eee;">login_status</th></tr>';
        foreach ($rows as $row) {
            echo '<tr>';
            echo '<td>' . htmlspecialchars((string) ($row->email ?? '')) . '</td>';
            echo '<td>' . htmlspecialchars((string) ($row->login_method ?? '')) . '</td>';
            echo '<td>' . htmlspecialchars((string) ($row->login_status ?? '')) . '</td>';
            echo '</tr>';
        }
        echo '</table>';
    }

    echo '<h2>Step 5: Read recent otp_codes rows</h2>';
    $otpRows = $manager->executeQuery(
        $dbName . '.otp_codes',
        new MongoDB\Driver\Query([], ['sort' => ['created_at' => -1], 'limit' => 10])
    )->toArray();

    if (empty($otpRows)) {
        echo '<p>No OTP rows yet (will appear after Send OTP).</p>';
    } else {
        echo '<p style="color:green;">OK: OTP collection has data.</p>';
    }

    echo '<hr>';
    echo '<p style="color:green; font-size:18px;"><b>DONE: MongoDB connectivity and collections are working.</b></p>';
} catch (Throwable $e) {
    echo '<p style="color:red;">ERROR: ' . htmlspecialchars($e->getMessage()) . '</p>';
    if (in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)) {
        echo '<pre>' . htmlspecialchars($e->getFile() . ':' . $e->getLine()) . '</pre>';
    }
}
