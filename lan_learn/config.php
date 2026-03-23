<?php
require_once __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

// ....................Central configuration for authentication + mail.
return [
    'app' => [
        // IMPORTANT: Set this to your public URL in production.
        // 'base_url' => 'https://www.ulsaapp.online',

         'base_url' => 'http://localhost/spokenenglish/AtoZ_Services/lan_learn',


        'session_name' => 'learn_auth',
        'otp_expiry_seconds' => 300,
        'debug' => true,
    ],
    
    'db' => [
        'path' => __DIR__ . '/auth/auth.sqlite',
    ],

    'email' => [
        'host' => 'smtp.hostinger.com',
        'port' => 465,
        'username' => 'info.ll@atozasindia.in',
        // Use your real mailbox/app password from Hostinger email account.
        'password' => 'A1b2ced4e5@ll',
        // true/'ssl' for port 465, 'tls' for port 587, false for plain SMTP.
        'secure' => true,
        'from_email' => 'info.ll@atozasindia.in',
        'from_name' => 'GTongue Learn',
    ],

    'google' => [
        'client_id' => getenv('GOOGLE_CLIENT_ID'),
        'client_secret' => getenv('GOOGLE_CLIENT_SECRET'),
        // Google Console must include this exact URL in Authorized redirect URIs.
         //'redirect_uri' => 'https://www.ulsaapp.online/auth/google-callback.php',
         'redirect_uri' => 'http://localhost/spokenenglish/AtoZ_Services/lan_learn/auth/google-callback.php',
    ],
];
