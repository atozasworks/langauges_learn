<?php

return [
    'driver' => 'mongodb',

    // Replace with your live MongoDB URI.
    // Atlas example:
    // 'uri' => 'mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/lldb?retryWrites=true&w=majority',
    // Self-hosted example:
    // 'uri' => 'mongodb://USER:PASSWORD@HOST:27017',
    'uri' => 'mongodb://LIVE_USER:LIVE_PASSWORD@LIVE_HOST:27017',

    // Keep same DB name used locally.
    'dbname' => 'lldb',

    // Optional advanced options.
    'uriOptions' => [
        // 'authSource' => 'admin',
    ],
    // 'driverOptions' => [],
];
