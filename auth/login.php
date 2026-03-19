<?php
/**
 * login.php – Login page with Email OTP + Google Sign-In
 *
 * If already logged in, redirect to dashboard.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/google-config.php';

startSecureSession();

// Allow Google Identity Services popup to communicate with this page
header('Cross-Origin-Opener-Policy: same-origin-allow-popups');

// Redirect if already logged in
if (!empty($_SESSION['user_id'])) {
    header('Location: /spokenenglish/AtoZ_Services/lan_learn/index.php');
    exit;
}

// Generate CSRF token for this session
$csrfToken = getCSRFToken();
$googleClientId = GOOGLE_CLIENT_ID;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login – <?php echo htmlspecialchars(SITE_NAME); ?></title>
    <link rel="stylesheet" href="assets/auth.css">
</head>
<body class="auth-page">

<div class="auth-container">
    <div class="auth-card">

        <!-- Header -->
        <div class="auth-header">
            <h1><?php echo htmlspecialchars(SITE_NAME); ?></h1>
            <p>Sign in to continue</p>
        </div>

        <!-- Messages -->
        <div id="message-box" class="message"></div>

        <!-- Hidden CSRF token -->
        <input type="hidden" id="csrf-token" value="<?php echo htmlspecialchars($csrfToken); ?>">

        <!-- ════════════ Google Sign-In ════════════ -->
        <div id="google-section">
            <!-- Google Identity Services renders into this div -->
            <div id="g_id_onload"
                 data-client_id="<?php echo htmlspecialchars($googleClientId); ?>"
                 data-callback="handleGoogleCredential"
                 data-auto_prompt="false">
            </div>

            <!-- Custom Google button using GIS renderButton -->
            <div id="google-btn-container" style="display:flex;justify-content:center;">
                <div class="g_id_signin"
                     data-type="standard"
                     data-shape="rectangular"
                     data-theme="outline"
                     data-text="continue_with"
                     data-size="large"
                     data-logo_alignment="left"
                     data-width="356">
                </div>
            </div>
        </div>

        <!-- Divider -->
        <div class="auth-divider">
            <span>or sign in with email</span>
        </div>

        <!-- ════════════ Email OTP Section ════════════ -->

        <!-- Step 1: Enter email -->
        <div id="email-section">
            <div class="form-group">
                <label for="email-input">Email address</label>
                <input type="email"
                       id="email-input"
                       placeholder="you@example.com"
                       autocomplete="email"
                       required>
            </div>
            <button type="button" id="send-otp-btn" class="btn btn-primary">
                <span class="spinner"></span>
                <span class="btn-text">Send OTP</span>
            </button>
        </div>

        <!-- Step 2: Enter OTP (hidden initially) -->
        <div id="otp-section" class="otp-section">
            <p class="otp-info">
                We sent a 6-digit code to <strong id="otp-email-display"></strong>
            </p>

            <div class="form-group">
                <label for="otp-input">Enter OTP</label>
                <div class="otp-input-group">
                    <input type="text"
                           id="otp-input"
                           placeholder="000000"
                           maxlength="6"
                           inputmode="numeric"
                           pattern="\d{6}"
                           autocomplete="one-time-code"
                           required>
                </div>
            </div>

            <button type="button" id="verify-otp-btn" class="btn btn-primary">
                <span class="spinner"></span>
                <span class="btn-text">Verify & Sign In</span>
            </button>

            <div class="resend-row">
                <button type="button" id="resend-btn" class="btn-link" disabled>Resend OTP</button>
                <span id="resend-timer" class="resend-timer"></span>
            </div>

            <div class="back-link">
                <button type="button" id="back-to-email" class="btn-link">← Use a different email</button>
            </div>
        </div>

    </div>
</div>

<!-- Google Identity Services library -->
<script src="https://accounts.google.com/gsi/client" async defer></script>

<!-- Auth JS -->
<script src="assets/auth.js"></script>

</body>
</html>
