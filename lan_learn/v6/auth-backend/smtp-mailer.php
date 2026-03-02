<?php

function getLocalSmtpConfig(): array
{
    $localConfigFile = __DIR__ . DIRECTORY_SEPARATOR . 'smtp-config.local.php';
    if (!is_file($localConfigFile)) {
        return [];
    }

    $config = require $localConfigFile;
    return is_array($config) ? $config : [];
}

/**
 * SMTP settings loaded from environment variables.
 */
function getSmtpConfig(): array
{
    $local = getLocalSmtpConfig();

    return [
        'name' => $local['name'] ?? (getenv('SMTP_NAME') ?: 'atozas.com'),
        'server' => $local['server'] ?? (getenv('SMTP_SERVER') ?: 'mail.atozas.com'),
        'port' => (int)($local['port'] ?? (getenv('SMTP_PORT') ?: '465')),
        'secure' => isset($local['secure'])
            ? (bool)$local['secure']
            : filter_var(getenv('SMTP_SECURE') ?: 'true', FILTER_VALIDATE_BOOLEAN),
        'email' => $local['email'] ?? (getenv('SMTP_EMAIL') ?: 'no-reply@atozas.com'),
        'password' => $local['password'] ?? (getenv('SMTP_EMAIL_PASSWORD') ?: '')
    ];
}

/**
 * Sends OTP email using SMTP AUTH LOGIN over SSL.
 */
function sendOtpEmail(string $toEmail, string $otp): void
{
    $config = getSmtpConfig();

    if ($config['password'] === '') {
        throw new RuntimeException('SMTP password missing. Set SMTP_EMAIL_PASSWORD environment variable.');
    }

    $scheme = $config['secure'] ? 'ssl://' : '';
    $socket = @fsockopen($scheme . $config['server'], $config['port'], $errorNumber, $errorMessage, 20);

    if (!$socket) {
        throw new RuntimeException('SMTP connection failed: ' . $errorMessage);
    }

    smtpExpect($socket, [220]);
    smtpCommand($socket, 'EHLO ' . $config['name'], [250]);
    smtpCommand($socket, 'AUTH LOGIN', [334]);
    smtpCommand($socket, base64_encode($config['email']), [334]);
    smtpCommand($socket, base64_encode($config['password']), [235]);
    smtpCommand($socket, 'MAIL FROM:<' . $config['email'] . '>', [250]);
    smtpCommand($socket, 'RCPT TO:<' . $toEmail . '>', [250, 251]);
    smtpCommand($socket, 'DATA', [354]);

    $subject = 'Your OTP for Login';
    $body = "Your login OTP is: {$otp}.\r\nThis OTP is valid for 5 minutes.";

    $message = '';
    $message .= 'From: ' . $config['name'] . ' <' . $config['email'] . ">\r\n";
    $message .= 'To: <' . $toEmail . ">\r\n";
    $message .= 'Subject: ' . $subject . "\r\n";
    $message .= "MIME-Version: 1.0\r\n";
    $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $message .= "\r\n";
    $message .= $body . "\r\n.\r\n";

    fwrite($socket, $message);
    smtpExpect($socket, [250]);
    smtpCommand($socket, 'QUIT', [221]);

    fclose($socket);
}

function smtpCommand($socket, string $command, array $expectedCodes): void
{
    fwrite($socket, $command . "\r\n");
    smtpExpect($socket, $expectedCodes);
}

function smtpExpect($socket, array $expectedCodes): void
{
    $response = '';
    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (preg_match('/^[0-9]{3}\s/', $line)) {
            break;
        }
    }

    $code = (int)substr($response, 0, 3);
    if (!in_array($code, $expectedCodes, true)) {
        throw new RuntimeException('SMTP error: ' . trim($response));
    }
}
