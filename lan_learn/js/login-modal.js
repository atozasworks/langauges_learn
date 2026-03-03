// Login modal and auth state
(function () {
    const AUTH_BASE = 'auth-backend';

    function getLoginModal() {
        return document.getElementById('login-modal');
    }

    function showLoginModal() {
        const modal = getLoginModal();
        if (modal) {
            setSendOtpState(false);
            const emailInput = document.getElementById('login-email');
            if (emailInput) emailInput.value = '';
            modal.classList.add('show');
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            clearLoginError();
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    function hideLoginModal() {
        const modal = getLoginModal();
        if (modal) {
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }
    }

    function clearLoginError() {
        const el = document.getElementById('login-error');
        if (el) el.textContent = '';
    }

    function setLoginError(msg) {
        const el = document.getElementById('login-error');
        if (el) el.textContent = msg || '';
    }

    function getGoogleAuthErrorMessage(error, reason) {
        if (error === 'google_not_configured') {
            if (reason === 'missing_client_id') {
                return 'Google login is not configured on this server (missing Client ID).';
            }
            return 'Google login is not configured on this server.';
        }

        if (error === 'google_login_failed') {
            switch (reason) {
                case 'oauth_denied':
                    return 'Google sign-in was cancelled. Please try again and allow access.';
                case 'missing_code_or_state':
                    return 'Google sign-in failed: invalid callback response.';
                case 'invalid_oauth_state':
                    return 'Google sign-in failed due to session mismatch. Please try again.';
                case 'token_request_failed':
                    return 'Google sign-in failed while requesting access token.';
                case 'missing_access_token':
                    return 'Google sign-in failed: access token was not returned.';
                case 'userinfo_request_failed':
                    return 'Google sign-in failed while fetching Google profile.';
                case 'missing_user_profile':
                    return 'Google sign-in failed: Google account email/profile is unavailable.';
                default:
                    return 'Google sign-in failed. Please try again.';
            }
        }

        return '';
    }

    function handleAuthErrorFromQuery() {
        const params = new URLSearchParams(window.location.search);
        const error = params.get('error') || '';
        const reason = params.get('reason') || '';
        const message = getGoogleAuthErrorMessage(error, reason);

        if (!message) return;

        showLoginModal();
        setLoginError(message);

        params.delete('error');
        params.delete('reason');
        const query = params.toString();
        const cleanUrl = window.location.pathname + (query ? '?' + query : '') + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
    }

    function setSendOtpState(sent) {
        const sentMsg = document.getElementById('login-otp-sent-msg');
        const otpLabel = document.getElementById('otp-label');
        const otpInput = document.getElementById('login-otp');
        const verifyBtn = document.getElementById('verify-otp-btn');
        if (sentMsg) sentMsg.style.display = sent ? 'block' : 'none';
        if (otpLabel) otpLabel.style.display = sent ? 'block' : 'none';
        if (otpInput) otpInput.style.display = sent ? 'block' : 'none';
        if (verifyBtn) verifyBtn.style.display = sent ? 'block' : 'none';
        if (otpInput) otpInput.value = '';
    }

    function updateNavLoginButton(loggedIn, userName) {
        const btn = document.getElementById('nav-login-btn');
        if (!btn) return;
        if (loggedIn) {
            const name = userName || 'Account';
            btn.innerHTML =
                '<i data-lucide="user"></i>' +
                '<span class="nav-username">' + name + '</span>' +
                '<span class="nav-logout-label"><i data-lucide="log-out"></i> Logout</span>';
            btn.setAttribute('data-logged-in', 'true');
            btn.setAttribute('title', 'Logout (' + name + ')');
        } else {
            btn.innerHTML = '<i data-lucide="log-in"></i> Login';
            btn.setAttribute('data-logged-in', 'false');
            btn.removeAttribute('title');
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    async function checkAuth() {
        try {
            const res = await fetch(AUTH_BASE + '/check-session.php', { credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (data && data.logged_in && data.user) {
                updateNavLoginButton(true, data.user.name || data.user.email);
                return true;
            }
        } catch (e) {
            console.warn('Auth check failed', e);
        }
        updateNavLoginButton(false);
        return false;
    }

    // Open modal on Login click
    document.getElementById('nav-login-btn')?.addEventListener('click', function (e) {
        e.preventDefault();
        if (this.getAttribute('data-logged-in') === 'true') {
            window.location.href = AUTH_BASE + '/logout.php';
            return;
        }
        showLoginModal();
    });

    // Close modal
    document.getElementById('login-modal-close')?.addEventListener('click', hideLoginModal);
    getLoginModal()?.addEventListener('click', function (e) {
        if (e.target === this) hideLoginModal();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && getLoginModal()?.classList.contains('show')) hideLoginModal();
    });

    // Send OTP
    document.getElementById('send-otp-btn')?.addEventListener('click', async function () {
        const emailInput = document.getElementById('login-email');
        const email = (emailInput && emailInput.value.trim()) || '';
        clearLoginError();
        if (!email) {
            setLoginError('Please enter your email address.');
            return;
        }
        const btn = this;
        btn.disabled = true;
        try {
            const res = await fetch(AUTH_BASE + '/send-otp.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: email })
            });
            const data = await res.json().catch(() => ({}));
            if (data.success) {
                setSendOtpState(true);
                setLoginError('');
            } else {
                setLoginError(data.message || 'Failed to send OTP. Please try again.');
            }
        } catch (err) {
            setLoginError('Network error. Please try again.');
        } finally {
            btn.disabled = false;
        }
    });

    // Verify OTP
    document.getElementById('verify-otp-btn')?.addEventListener('click', async function () {
        const emailInput = document.getElementById('login-email');
        const otpInput = document.getElementById('login-otp');
        const email = (emailInput && emailInput.value.trim()) || '';
        const otp = (otpInput && otpInput.value.trim()) || '';
        clearLoginError();
        if (!email || !otp) {
            setLoginError('Please enter the 6-digit code from your email.');
            return;
        }
        const btn = this;
        btn.disabled = true;
        try {
            const res = await fetch(AUTH_BASE + '/verify-otp.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: email, otp: otp })
            });
            const data = await res.json().catch(() => ({}));
            if (data.success) {
                hideLoginModal();
                updateNavLoginButton(true, data.user && (data.user.name || data.user.email));
            } else {
                setLoginError(data.message || 'Invalid or expired code. Please try again.');
            }
        } catch (err) {
            setLoginError('Network error. Please try again.');
        } finally {
            btn.disabled = false;
        }
    });

    // On load: check session and update nav button
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            handleAuthErrorFromQuery();
            checkAuth();
        });
    } else {
        handleAuthErrorFromQuery();
        checkAuth();
    }

    window.loginModal = { show: showLoginModal, hide: hideLoginModal, checkAuth: checkAuth };
})();
