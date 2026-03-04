<?php
/**
 * Database config — auto-detects local vs live environment.
 */
$isLive = isset($_SERVER['HTTP_HOST']) && strpos($_SERVER['HTTP_HOST'], 'ulsaapp.online') !== false;

if ($isLive) {
    return [
        'host'     => 'localhost',
        'port'     => 3306,
        'dbname'   => 'u893481695_lan_learn_auth',
        'username' => 'u893481695_lan_learnuser',
        'password' => 'lanLearn@574230',
        'charset'  => 'utf8mb4',
    ];
}

// Local development
return [
    'host'     => 'localhost',
    'port'     => 3306,
    'dbname'   => 'lan_learn',
    'username' => 'root',
    'password' => '',
    'charset'  => 'utf8mb4',
];
