<?php
/**
 * MongoDB helper (MongoDB Compass / local MongoDB server).
 *
 * Stores authentication and learner data in MongoDB collections:
 * - login_audit
 * - otp_codes
 * - learning_team
 * - religions
 * - members
 */

error_reporting(E_ALL);

/**
 * Parse a .env file into key/value pairs.
 */
function parseEnvFile(string $path): array
{
    if (!is_file($path)) {
        return [];
    }

    $vars = [];
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }
        if (strpos($line, '=') === false) {
            continue;
        }

        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);

        if (preg_match('/^(["\'])(.*)\\1$/', $value, $m)) {
            $value = $m[2];
        }
        if (($pos = strpos($value, ' #')) !== false) {
            $value = rtrim(substr($value, 0, $pos));
        }

        $vars[$key] = $value;
    }

    return $vars;
}

/**
 * Normalizes config to required Mongo keys.
 */
function normalizeMongoConfig(array $cfg): array
{
    $uri = (string) ($cfg['uri'] ?? ($cfg['mongodb_uri'] ?? ''));
    $dbname = (string) ($cfg['dbname'] ?? ($cfg['database'] ?? ($cfg['db_name'] ?? '')));

    if ($uri === '') {
        $uri = 'mongodb://127.0.0.1:27017';
    }
    if ($dbname === '') {
        $dbname = 'lldb';
    }

    return [
        'driver' => 'mongodb',
        'uri' => $uri,
        'dbname' => $dbname,
        'uriOptions' => is_array($cfg['uriOptions'] ?? null) ? $cfg['uriOptions'] : [],
        'driverOptions' => is_array($cfg['driverOptions'] ?? null) ? $cfg['driverOptions'] : [],
    ];
}

/**
 * MongoDB config priority:
 * 1. db-config.local.php
 * 2. Environment variables
 * 3. .env file
 * 4. Defaults
 */
function getDbConfig(): array
{
    $localFile = __DIR__ . '/db-config.local.php';
    if (is_file($localFile)) {
        $cfg = require $localFile;
        if (is_array($cfg)) {
            return normalizeMongoConfig($cfg);
        }
    }

    $envUri = getenv('MONGODB_URI') ?: getenv('MONGO_URI');
    if ($envUri !== false && $envUri !== '') {
        return normalizeMongoConfig([
            'uri' => $envUri,
            'dbname' => getenv('MONGODB_DATABASE') ?: (getenv('MONGODB_DB') ?: (getenv('DB_NAME') ?: 'lldb')),
        ]);
    }

    $envCandidates = [
        ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/.env',
        dirname(__DIR__) . '/.env',
    ];

    foreach ($envCandidates as $envFile) {
        $env = parseEnvFile($envFile);
        if (!empty($env['MONGODB_URI']) || !empty($env['MONGO_URI'])) {
            return normalizeMongoConfig([
                'uri' => $env['MONGODB_URI'] ?? $env['MONGO_URI'],
                'dbname' => $env['MONGODB_DATABASE'] ?? ($env['MONGODB_DB'] ?? ($env['DB_NAME'] ?? 'lldb')),
            ]);
        }
    }

    return normalizeMongoConfig([
        'uri' => 'mongodb://127.0.0.1:27017',
        'dbname' => 'lldb',
    ]);
}

/**
 * Returns Mongo manager + db name singleton.
 */
function getMongoConnection(): array
{
    return getMongoConnectionInternal();
}

/**
 * Backward-compatible function name used by existing endpoints.
 */
function getLoginDbConnection()
{
    return getMongoConnection()['manager'];
}

function getMongoDbName(): string
{
    return getMongoConnection()['dbname'];
}

function utcNow(): MongoDB\BSON\UTCDateTime
{
    return new MongoDB\BSON\UTCDateTime((int) round(microtime(true) * 1000));
}

function utcFromUnix(int $seconds): MongoDB\BSON\UTCDateTime
{
    return new MongoDB\BSON\UTCDateTime($seconds * 1000);
}

function toUnixTimestamp($value): int
{
    if ($value instanceof MongoDB\BSON\UTCDateTime) {
        return (int) $value->toDateTime()->format('U');
    }

    if (is_string($value) && $value !== '') {
        $ts = strtotime($value);
        return $ts === false ? 0 : $ts;
    }

    return 0;
}

function ensureCollections(): void
{
    static $done = false;
    if ($done) {
        return;
    }

    $conn = getMongoConnectionInternal();
    $manager = $conn['manager'];
    $db = $conn['dbname'];

    // learning_team indexes
    $manager->executeCommand($db, new MongoDB\Driver\Command([
        'createIndexes' => 'learning_team',
        'indexes' => [
            ['key' => ['id' => 1], 'name' => 'idx_learning_team_id'],
            ['key' => ['user_email' => 1], 'name' => 'idx_lt_user'],
            ['key' => ['user_email' => 1, 'learner_name' => 1], 'name' => 'uk_user_learner', 'unique' => true],
        ],
    ]));

    // OTP indexes
    $manager->executeCommand($db, new MongoDB\Driver\Command([
        'createIndexes' => 'otp_codes',
        'indexes' => [
            ['key' => ['email' => 1, 'used_at' => 1, 'created_at' => -1], 'name' => 'idx_otp_email_used_created'],
        ],
    ]));

    // Audit index
    $manager->executeCommand($db, new MongoDB\Driver\Command([
        'createIndexes' => 'login_audit',
        'indexes' => [
            ['key' => ['email' => 1, 'created_at' => -1], 'name' => 'idx_login_audit_email_created'],
        ],
    ]));

    // Extra collections kept for compatibility with existing schema usage.
    $manager->executeCommand($db, new MongoDB\Driver\Command([
        'createIndexes' => 'religions',
        'indexes' => [
            ['key' => ['religion_name' => 1], 'name' => 'uk_religion_name', 'unique' => true],
        ],
    ]));

    $manager->executeCommand($db, new MongoDB\Driver\Command([
        'createIndexes' => 'members',
        'indexes' => [
            ['key' => ['email' => 1], 'name' => 'idx_members_email'],
            ['key' => ['religion_id' => 1], 'name' => 'idx_members_religion'],
        ],
    ]));

    seedReligions();

    $done = true;
}

/**
 * Internal connection getter that avoids recursive ensureCollections() calls.
 */
function getMongoConnectionInternal(): array
{
    static $conn = null;
    if ($conn !== null) {
        return $conn;
    }

    if (!extension_loaded('mongodb')) {
        throw new RuntimeException('MongoDB PHP extension is not loaded. Enable ext-mongodb in php.ini.');
    }

    $cfg = getDbConfig();
    $manager = new MongoDB\Driver\Manager(
        $cfg['uri'],
        $cfg['uriOptions'] ?? [],
        $cfg['driverOptions'] ?? []
    );
    $manager->executeCommand('admin', new MongoDB\Driver\Command(['ping' => 1]));

    $conn = [
        'manager' => $manager,
        'dbname' => $cfg['dbname'],
    ];

    ensureCollections();

    return $conn;
}

function seedReligions(): void
{
    $names = ['Hindu', 'Muslim', 'Christian', 'Jain', 'Sikh'];

    $bulk = new MongoDB\Driver\BulkWrite();
    foreach ($names as $name) {
        $bulk->update(
            ['religion_name' => $name],
            ['$setOnInsert' => ['religion_name' => $name]],
            ['multi' => false, 'upsert' => true]
        );
    }

    $conn = getMongoConnectionInternal();
    $conn['manager']->executeBulkWrite(getMongoDbName() . '.religions', $bulk);
}

function getNextSequence(string $counterId): int
{
    $conn = getMongoConnectionInternal();
    $result = $conn['manager']->executeCommand(
        $conn['dbname'],
        new MongoDB\Driver\Command([
            'findAndModify' => 'counters',
            'query' => ['_id' => $counterId],
            'update' => ['$inc' => ['seq' => 1]],
            'upsert' => true,
            'new' => true,
        ])
    )->toArray();

    $doc = $result[0] ?? null;
    if (!is_object($doc) || !isset($doc->value) || !is_object($doc->value) || !isset($doc->value->seq)) {
        return 1;
    }

    return (int) $doc->value->seq;
}

function isDuplicateKeyError(Throwable $e): bool
{
    if ($e instanceof MongoDB\Driver\Exception\BulkWriteException) {
        $wr = $e->getWriteResult();
        foreach ($wr->getWriteErrors() as $we) {
            if (in_array((int) $we->getCode(), [11000, 11001], true)) {
                return true;
            }
        }
    }

    return stripos($e->getMessage(), 'duplicate key') !== false;
}

/*
 * Learning Team helpers
 */

function getLearnersByUser(string $email): array
{
    $conn = getMongoConnectionInternal();
    $query = new MongoDB\Driver\Query(
        ['user_email' => $email],
        [
            'projection' => ['_id' => 0, 'id' => 1, 'learner_name' => 1],
            'sort' => ['id' => 1],
        ]
    );

    $rows = [];
    $cursor = $conn['manager']->executeQuery($conn['dbname'] . '.learning_team', $query);
    foreach ($cursor as $doc) {
        $rows[] = [
            'id' => (int) ($doc->id ?? 0),
            'learner_name' => (string) ($doc->learner_name ?? ''),
        ];
    }

    return $rows;
}

function addLearner(string $email, string $name): int
{
    $conn = getMongoConnectionInternal();
    $newId = getNextSequence('learning_team_id');

    $bulk = new MongoDB\Driver\BulkWrite();
    $bulk->insert([
        'id' => $newId,
        'user_email' => $email,
        'learner_name' => $name,
        'created_at' => utcNow(),
    ]);

    try {
        $conn['manager']->executeBulkWrite($conn['dbname'] . '.learning_team', $bulk);
    } catch (Throwable $e) {
        if (isDuplicateKeyError($e)) {
            throw new RuntimeException('Duplicate learner', 409, $e);
        }
        throw $e;
    }

    return $newId;
}

function deleteLearner(string $email, int $learnerId): bool
{
    $conn = getMongoConnectionInternal();

    $bulk = new MongoDB\Driver\BulkWrite();
    $bulk->delete(['id' => $learnerId, 'user_email' => $email], ['limit' => 1]);

    $res = $conn['manager']->executeBulkWrite($conn['dbname'] . '.learning_team', $bulk);
    return $res->getDeletedCount() > 0;
}

function saveLoginAudit(array $rec): void
{
    $conn = getMongoConnectionInternal();

    $bulk = new MongoDB\Driver\BulkWrite();
    $bulk->insert([
        'email' => (string) ($rec['email'] ?? ''),
        'login_method' => (string) ($rec['login_method'] ?? 'unknown'),
        'provider_user_id' => $rec['provider_user_id'] ?? null,
        'display_name' => $rec['display_name'] ?? null,
        'login_status' => (string) ($rec['login_status'] ?? 'success'),
        'client_ip' => $_SERVER['REMOTE_ADDR'] ?? null,
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
        'created_at' => utcNow(),
    ]);

    $conn['manager']->executeBulkWrite($conn['dbname'] . '.login_audit', $bulk);
}

function saveOtpCode(string $email, string $otp, int $ttl = 300): void
{
    $conn = getMongoConnectionInternal();
    $now = utcNow();

    // Expire old unused OTPs.
    $bulkExpire = new MongoDB\Driver\BulkWrite();
    $bulkExpire->update(
        ['email' => $email, 'used_at' => null],
        ['$set' => ['used_at' => $now]],
        ['multi' => true, 'upsert' => false]
    );
    $conn['manager']->executeBulkWrite($conn['dbname'] . '.otp_codes', $bulkExpire);

    // Insert new OTP row.
    $bulkInsert = new MongoDB\Driver\BulkWrite();
    $bulkInsert->insert([
        'email' => $email,
        'otp_hash' => password_hash($otp, PASSWORD_DEFAULT),
        'expires_at' => utcFromUnix(time() + $ttl),
        'used_at' => null,
        'created_at' => $now,
    ]);
    $conn['manager']->executeBulkWrite($conn['dbname'] . '.otp_codes', $bulkInsert);
}

function verifyOtpCode(string $email, string $otp): bool
{
    $conn = getMongoConnectionInternal();

    $query = new MongoDB\Driver\Query(
        ['email' => $email, 'used_at' => null],
        ['sort' => ['created_at' => -1], 'limit' => 1]
    );

    $cursor = $conn['manager']->executeQuery($conn['dbname'] . '.otp_codes', $query);
    $rows = $cursor->toArray();
    $row = $rows[0] ?? null;

    if (!is_object($row)) {
        return false;
    }

    $expiresAt = toUnixTimestamp($row->expires_at ?? null);
    if ($expiresAt <= 0 || $expiresAt < time()) {
        return false;
    }

    $otpHash = (string) ($row->otp_hash ?? '');
    if ($otpHash === '' || !password_verify($otp, $otpHash)) {
        return false;
    }

    if (isset($row->_id)) {
        $bulk = new MongoDB\Driver\BulkWrite();
        $bulk->update(
            ['_id' => $row->_id],
            ['$set' => ['used_at' => utcNow()]],
            ['multi' => false, 'upsert' => false]
        );
        $conn['manager']->executeBulkWrite($conn['dbname'] . '.otp_codes', $bulk);
    }

    return true;
}
