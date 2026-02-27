<?php
/**
 * SMTP configuration example for OTP emails.
 * Copy to smtp-config.local.php and set your values.
 */
return [
    'name'    => getenv('SMTP_NAME') ?: 'GTongue Learn',
    'host'    => getenv('SMTP_SERVER') ?: 'smtp.hostinger.com',
    'port'    => (int) (getenv('SMTP_PORT') ?: 465),
    'secure'  => filter_var(getenv('SMTP_SECURE') ?: 'true', FILTER_VALIDATE_BOOLEAN),
    'user'    => getenv('SMTP_EMAIL') ?: 'no-reply@yourdomain.com',
    'pass'    => getenv('SMTP_EMAIL_PASSWORD') ?: 'YYiPNiLmtx4@11',
];
