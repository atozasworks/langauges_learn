/**
 * auth.js – Client-side logic for login page
 */

(function () {
    'use strict';

    // ── DOM elements ────────────────────────────────────────────
    const emailInput      = document.getElementById('email-input');
    const sendOtpBtn      = document.getElementById('send-otp-btn');
    const emailSection    = document.getElementById('email-section');
    const otpSection      = document.getElementById('otp-section');
    const otpInput        = document.getElementById('otp-input');
    const verifyOtpBtn    = document.getElementById('verify-otp-btn');
    const resendBtn       = document.getElementById('resend-btn');
    const resendTimer     = document.getElementById('resend-timer');
    const otpEmailDisplay = document.getElementById('otp-email-display');
    const backToEmailBtn  = document.getElementById('back-to-email');
    const messageBox      = document.getElementById('message-box');
    const csrfToken       = document.getElementById('csrf-token').value;

    let cooldownInterval = null;
    let currentEmail = '';

    // ── Show message ────────────────────────────────────────────
    function showMessage(text, type = 'error') {
        messageBox.textContent = text;
        messageBox.className = 'message show ' + type;
        // Auto-clear success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => { messageBox.className = 'message'; }, 5000);
        }
    }

    function clearMessage() {
        messageBox.className = 'message';
    }

    // ── Loading state helpers ───────────────────────────────────
    function setLoading(btn, loading) {
        if (loading) {
            btn.classList.add('loading');
            btn.disabled = true;
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }

    // ── Cooldown timer ──────────────────────────────────────────
    function startCooldown(seconds) {
        resendBtn.disabled = true;
        let remaining = seconds;
        resendTimer.textContent = formatTime(remaining);

        clearInterval(cooldownInterval);
        cooldownInterval = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(cooldownInterval);
                resendBtn.disabled = false;
                resendTimer.textContent = '';
            } else {
                resendTimer.textContent = formatTime(remaining);
            }
        }, 1000);
    }

    function formatTime(seconds) {
        return `Resend in ${seconds}s`;
    }

    // ── Validate email ──────────────────────────────────────────
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // ── Send OTP ────────────────────────────────────────────────
    async function sendOtp(email) {
        clearMessage();

        if (!isValidEmail(email)) {
            showMessage('Please enter a valid email address.');
            emailInput.focus();
            return;
        }

        setLoading(sendOtpBtn, true);

        try {
            const res = await fetch('otp-send.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, csrf_token: csrfToken })
            });

            const data = await res.json();

            if (data.success) {
                currentEmail = email;
                otpEmailDisplay.textContent = email;
                emailSection.style.display = 'none';
                otpSection.classList.add('show');
                otpInput.value = '';
                otpInput.focus();
                showMessage('OTP sent successfully! Check your email.', 'success');
                startCooldown(data.cooldown || 60);
            } else {
                showMessage(data.message || 'Failed to send OTP.');
                if (data.cooldown) {
                    startCooldown(data.cooldown);
                }
            }
        } catch (err) {
            showMessage('Network error. Please try again.');
            console.error('Send OTP error:', err);
        } finally {
            setLoading(sendOtpBtn, false);
        }
    }

    // ── Verify OTP ──────────────────────────────────────────────
    async function verifyOtp() {
        clearMessage();

        const otp = otpInput.value.trim();
        if (!/^\d{6}$/.test(otp)) {
            showMessage('Please enter a valid 6-digit code.');
            otpInput.focus();
            return;
        }

        setLoading(verifyOtpBtn, true);

        try {
            const res = await fetch('otp-verify.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: currentEmail,
                    otp: otp,
                    csrf_token: csrfToken
                })
            });

            const data = await res.json();

            if (data.success) {
                showMessage('Login successful! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = data.redirect || 'dashboard.php';
                }, 800);
            } else {
                showMessage(data.message || 'Invalid OTP.');
            }
        } catch (err) {
            showMessage('Network error. Please try again.');
            console.error('Verify OTP error:', err);
        } finally {
            setLoading(verifyOtpBtn, false);
        }
    }

    // ── Google login callback ───────────────────────────────────
    // Called by Google Identity Services after user selects account
    window.handleGoogleCredential = async function (response) {
        clearMessage();

        const googleBtn = document.getElementById('google-login-btn');
        if (googleBtn) setLoading(googleBtn, true);

        try {
            const res = await fetch('google-login.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    credential: response.credential,
                    csrf_token: csrfToken
                })
            });

            const data = await res.json();

            if (data.success) {
                showMessage('Google login successful! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = data.redirect || 'dashboard.php';
                }, 800);
            } else {
                showMessage(data.message || 'Google login failed.');
            }
        } catch (err) {
            showMessage('Network error. Please try again.');
            console.error('Google login error:', err);
        } finally {
            if (googleBtn) setLoading(googleBtn, false);
        }
    };

    // ── Event listeners ─────────────────────────────────────────

    // Send OTP button
    sendOtpBtn.addEventListener('click', function () {
        sendOtp(emailInput.value.trim());
    });

    // Enter key on email input
    emailInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendOtp(emailInput.value.trim());
        }
    });

    // Verify OTP button
    verifyOtpBtn.addEventListener('click', function () {
        verifyOtp();
    });

    // Enter key on OTP input
    otpInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            verifyOtp();
        }
    });

    // Allow only digits in OTP input (max 6)
    otpInput.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 6);
    });

    // Resend OTP
    resendBtn.addEventListener('click', function () {
        if (currentEmail) {
            sendOtp(currentEmail);
        }
    });

    // Back to email
    backToEmailBtn.addEventListener('click', function () {
        otpSection.classList.remove('show');
        emailSection.style.display = 'block';
        clearMessage();
        emailInput.focus();
    });

})();
