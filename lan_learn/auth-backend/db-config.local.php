<?php
/**
 * Local database config (not committed).
 * Copy from db-config.example.php and set your DB credentials.
 */
return [
    'host'     => getenv('DB_HOST') ?: 'localhost',
    'port'     => getenv('DB_PORT') ?: 3307,
    'dbname'   => getenv('DB_NAME') ?: 'lan_learn',
    'username' => getenv('DB_USER') ?: 'root',
    'password' => getenv('DB_PASSWORD') ?: '',
    'charset'  => 'utf8mb4',
];
