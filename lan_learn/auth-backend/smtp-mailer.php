<?php
/**
 * SMTP mailer for sending OTP emails (raw sockets, no PHPMailer dependency).
 * Uses stream_socket_client with SSL context for reliable TLS/SSL connections.
 */

$smtpConfig = require __DIR__ . '/smtp-config.php';

/**
 * Send an email via SMTP.
 *
 * @param string $to      Recipient email
 * @param string $subject Subject
 * @param string $body    Plain text body
 * @return array { success: bool, message: string }
 */
function smtp_send(string $to, string $subject, string $body): array {
    global $smtpConfig;
    $host     = $smtpConfig['host'];
    $port     = (int) $smtpConfig['port'];
    $secure   = (bool) $smtpConfig['secure'];
    $user     = $smtpConfig['user'];
    $pass     = $smtpConfig['pass'];
    $fromName = $smtpConfig['name'] ?? 'GTongue Learn';

    if (empty($pass)) {
        return ['success' => false, 'message' => 'SMTP password not configured'];
    }

    // SSL context: disable peer verification (required for Windows/XAMPP localhost dev)
    $ctx = stream_context_create([
        'ssl' => [
            'verify_peer'       => false,
            'verify_peer_name'  => false,
            'allow_self_signed' => true,
            'crypto_method'     => STREAM_CRYPTO_METHOD_TLS_CLIENT,
        ],
    ]);

    // Port 465 = direct SSL; Port 587 = plain TCP then STARTTLS upgrade
    $useStartTls = (!$secure && $port === 587) || ($port === 587);
    $target = ($secure && $port === 465 ? 'ssl://' : 'tcp://') . $host . ':' . $port;

    $sock = @stream_socket_client($target, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
    if (!$sock) {
        $phpErr = error_get_last();
        $detail = $errstr ?: ($phpErr['message'] ?? 'unknown error');
        return ['success' => false, 'message' => 'Could not connect to SMTP server: ' . $detail];
    }
    stream_set_timeout($sock, 15);

    // Read full multi-line SMTP response; returns last status line
    $readResponse = function () use ($sock): string {
        $last = '';
        while ($line = fgets($sock, 512)) {
            $last = $line;
            if (strlen($line) >= 4 && $line[3] === ' ') break;
        }
        return $last;
    };

    $send = function (string $cmd) use ($sock): void {
        fwrite($sock, $cmd . "\r\n");
    };

    $code = fn(string $r): int => (int) substr(trim($r), 0, 3);

    $ehloHost = $_SERVER['SERVER_NAME'] ?? 'localhost';

    // Handshake
    $banner = $readResponse();
    if ($code($banner) !== 220) {
        fclose($sock);
        return ['success' => false, 'message' => 'SMTP banner error: ' . trim($banner)];
    }

    $send('EHLO ' . $ehloHost);
    $ehlo = $readResponse();
    if ($code($ehlo) !== 250) {
        $send('HELO ' . $ehloHost);
        $readResponse();
    }

    // STARTTLS upgrade for port 587
    if ($useStartTls) {
        $send('STARTTLS');
        $tlsResp = $readResponse();
        if ($code($tlsResp) !== 220) {
            fclose($sock);
            return ['success' => false, 'message' => 'STARTTLS not accepted: ' . trim($tlsResp)];
        }
        if (!stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            fclose($sock);
            return ['success' => false, 'message' => 'TLS handshake failed — check PHP openssl extension'];
        }
        // Re-introduce after TLS upgrade
        $send('EHLO ' . $ehloHost);
        $readResponse();
    }

    // AUTH LOGIN
    $send('AUTH LOGIN');
    $r = $readResponse();
    if ($code($r) !== 334) {
        fclose($sock);
        return ['success' => false, 'message' => 'AUTH LOGIN rejected: ' . trim($r)];
    }

    $send(base64_encode($user));
    $readResponse();

    $send(base64_encode($pass));
    $authResp = $readResponse();
    if ($code($authResp) !== 235) {
        fclose($sock);
        return ['success' => false, 'message' => 'SMTP authentication failed — check email/password in smtp-config.local.php'];
    }

    // Send message
    $send('MAIL FROM:<' . $user . '>');
    $readResponse();

    $send('RCPT TO:<' . $to . '>');
    $rcptResp = $readResponse();
    if ($code($rcptResp) !== 250) {
        fclose($sock);
        return ['success' => false, 'message' => 'Recipient rejected: ' . trim($rcptResp)];
    }

    $send('DATA');
    $readResponse();

    $msg  = "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <{$user}>\r\n";
    $msg .= "To: {$to}\r\n";
    $msg .= "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
    $msg .= "MIME-Version: 1.0\r\n";
    $msg .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $msg .= "Content-Transfer-Encoding: base64\r\n";
    $msg .= "\r\n";
    $msg .= chunk_split(base64_encode($body));

    $send($msg);
    $send('.');
    $dataResp = $readResponse();

    $send('QUIT');
    fclose($sock);

    if ($code($dataResp) !== 250) {
        return ['success' => false, 'message' => 'Message rejected by server: ' . trim($dataResp)];
    }
    return ['success' => true, 'message' => 'OK'];
}
