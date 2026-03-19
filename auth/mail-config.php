<?php
/**
 * mail-config.php – PHPMailer SMTP settings
 *
 * INSTRUCTIONS:
 *   1. Install PHPMailer via Composer:
 *        cd C:\xampp\htdocs\AtoZ_Services\auth
 *        composer require phpmailer/phpmailer
 *
 *   2. Or download manually from https://github.com/PHPMailer/PHPMailer
 *      and place in auth/vendor/phpmailer/phpmailer/src/
 *
 *   3. Fill in your SMTP credentials below.
 *      For Gmail: use an App Password (not your main password).
 *      Go to https://myaccount.google.com/apppasswords to generate one.
 */

define('SMTP_HOST', 'mail.atozas.com');
define('SMTP_PORT', 465);                      // 465 for SSL
define('SMTP_USERNAME', 'no-reply@atozas.com');
define('SMTP_PASSWORD', 'YYiPNiLm]tx4');
define('SMTP_ENCRYPTION', 'ssl');              // SSL for port 465
define('MAIL_FROM_EMAIL', 'no-reply@atozas.com');
define('MAIL_FROM_NAME', 'AtozasDelivery');
