<?php
/**
 * Local SMTP config (not committed). Set SMTP_EMAIL_PASSWORD in env.
 */
return [
    'name'   => getenv('SMTP_NAME') ?: 'testatozas',
    'host'   => getenv('SMTP_SERVER') ?: 'smtp.hostinger.com',
    'port'   => (int) (getenv('SMTP_PORT') ?: 587),
    'secure' => filter_var(getenv('SMTP_SECURE') ?: 'false', FILTER_VALIDATE_BOOLEAN),
    'user'   => getenv('SMTP_EMAIL') ?: 'no-reply@testatozas.in',
    'pass'   => getenv('SMTP_EMAIL_PASSWORD') ?: 'YYiPNiLmtx4@11',
];
