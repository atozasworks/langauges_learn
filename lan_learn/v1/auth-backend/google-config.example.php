<?php
/**
 * Google OAuth 2.0 configuration example.
 * Copy to google-config.local.php and set client ID/secret from Google Cloud Console.
 */
return [
    'client_id'     => getenv('GOOGLE_CLIENT_ID') ?: '',
    'client_secret' => getenv('GOOGLE_CLIENT_SECRET') ?: '',
    'redirect_uri'  => null, // Set in code from request base URL
];
