<?php
declare(strict_types=1);

require __DIR__ . '/auth/bootstrap.php';

if (current_user()) {
    redirect_to('/index.php');
}

$error = (string) ($_GET['error'] ?? '');
$message = '';
if ($error === 'google_state') {
    $message = 'Google login session expired. Please try again.';
} elseif ($error === 'google_failed') {
    $message = 'Google login failed. Verify client credentials and redirect URI.';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login | GTongue Learn</title>
    <link rel="stylesheet" href="styles/auth.css">
</head>
<body>
<main class="auth-shell">
    <section class="auth-card">
        <h1>Welcome to GTongue Learn</h1>
        <p class="subtitle">Continue with Google or login using email OTP.</p>

        <?php if ($message): ?>
            <div class="notice error"><?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>

        <a class="google-btn" href="<?php echo htmlspecialchars(app_base_url() . '/auth/google-login.php', ENT_QUOTES, 'UTF-8'); ?>">
            Continue with Google
        </a>

        <div class="divider"><span>or</span></div>

        <form id="otp-request-form" class="stack" autocomplete="off">
            <label for="email">Email address</label>
            <input type="email" id="email" name="email" placeholder="you@example.com" required>
            <button type="submit">Send OTP</button>
        </form>

        <form id="otp-verify-form" class="stack hidden" autocomplete="off">
            <label for="otp">Enter 6 digit OTP</label>
            <input type="text" id="otp" name="otp" inputmode="numeric" maxlength="6" pattern="\d{6}" required>
            <button type="submit">Verify and Continue</button>
        </form>

        <div id="status" class="notice hidden"></div>
    </section>
</main>

<script>
const baseUrl = <?php echo json_encode(app_base_url(), JSON_UNESCAPED_SLASHES); ?>;
const requestForm = document.getElementById('otp-request-form');
const verifyForm = document.getElementById('otp-verify-form');
const statusBox = document.getElementById('status');
const emailInput = document.getElementById('email');
const otpInput = document.getElementById('otp');

function showStatus(message, isError = false) {
    statusBox.textContent = message;
    statusBox.classList.remove('hidden', 'error', 'ok');
    statusBox.classList.add(isError ? 'error' : 'ok');
}

requestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData();
    form.append('email', emailInput.value.trim());

    const res = await fetch(baseUrl + '/auth/send-otp.php', { method: 'POST', body: form });
    const data = await res.json();

    if (!res.ok || !data.ok) {
        showStatus(data.message || 'Unable to send OTP.', true);
        return;
    }

    verifyForm.classList.remove('hidden');
    showStatus(data.message || 'OTP sent.');
    otpInput.focus();
});

verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData();
    form.append('email', emailInput.value.trim());
    form.append('otp', otpInput.value.trim());

    const res = await fetch(baseUrl + '/auth/verify-otp.php', { method: 'POST', body: form });
    const data = await res.json();

    if (!res.ok || !data.ok) {
        showStatus(data.message || 'OTP verification failed.', true);
        return;
    }

    window.location.href = data.redirect || (baseUrl + '/index.php');
});
</script>
</body>
</html>