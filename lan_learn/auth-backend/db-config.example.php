<?php
/**
 * Database configuration example.
 * Copy to db-config.php and set your values.
 * Do not commit db-config.php.
 */
return [
    'host'     => getenv('DB_HOST') ?: 'localhost',
    'port'     => getenv('DB_PORT') ?: 3307,
    'dbname'   => getenv('DB_NAME') ?: 'your_database',
    'username' => getenv('DB_USER') ?: 'your_user',
    'password' => getenv('DB_PASSWORD') ?: '',
    'charset'  => 'utf8mb4',
];
