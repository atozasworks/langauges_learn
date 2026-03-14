// Login modal and auth state
(function () {
    const API_BASE = '/api';
    const GOOGLE_CLIENT_ID = '444024521791-26vj3nj553l540pjhofsgnk9tv2du5gh.apps.googleusercontent.com';
    let googleTokenClient = null;

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

    function getSavedUser() {
        try {
            const raw = sessionStorage.getItem('loggedInUser');
            if (!raw) return null;
            const user = JSON.parse(raw);
            if (user && user.email) return user;
            return null;
        } catch (_) {
            return null;
        }
    }

    function saveUser(user) {
        sessionStorage.setItem('loggedInUser', JSON.stringify(user));
    }

    function clearUser() {
        sessionStorage.removeItem('loggedInUser');
    }

    async function fetchGoogleProfile(accessToken) {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch Google profile.');
        return response.json();
    }

    async function saveGoogleLogin(accessToken) {
        const response = await fetch(`${API_BASE}/save-google-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to save Google login.');
        }
        return data;
    }

    function ensureGoogleTokenClient() {
        if (googleTokenClient) return googleTokenClient;
        if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
            return null;
        }
        googleTokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'openid email profile',
            callback: () => {}
        });
        return googleTokenClient;
    }

    function onLoginSuccess(user) {
        saveUser(user);
        hideLoginModal();
        updateNavLoginButton(true, user.name || user.email);
    }

    async function checkAuth() {
        const user = getSavedUser();
        if (user) {
            updateNavLoginButton(true, user.name || user.email);
            return true;
        }
        updateNavLoginButton(false);
        return false;
    }

    // Open modal on Login click
    document.getElementById('nav-login-btn')?.addEventListener('click', function (e) {
        e.preventDefault();
        if (this.getAttribute('data-logged-in') === 'true') {
            clearUser();
            updateNavLoginButton(false);
            return;
        }
        showLoginModal();
    });

    // Google sign-in
    document.getElementById('login-google-btn')?.addEventListener('click', async function (e) {
        e.preventDefault();
        clearLoginError();

        const tokenClient = ensureGoogleTokenClient();
        if (!tokenClient) {
            setLoginError('Google login is not ready. Refresh and try again.');
            return;
        }

        const btn = this;
        btn.disabled = true;
        try {
            const tokenResponse = await new Promise((resolve, reject) => {
                tokenClient.callback = (response) => {
                    if (response.error) {
                        reject(new Error(response.error));
                        return;
                    }
                    resolve(response);
                };
                tokenClient.requestAccessToken({ prompt: 'consent' });
            });

            const profile = await fetchGoogleProfile(tokenResponse.access_token);
            await saveGoogleLogin(tokenResponse.access_token);

            const user = {
                name: profile.name || profile.email,
                email: profile.email
            };
            onLoginSuccess(user);
        } catch (err) {
            setLoginError('Google login failed. Please try again.');
        } finally {
            btn.disabled = false;
        }
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
            const res = await fetch(`${API_BASE}/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            setLoginError('Please enter the 4-digit code from your email.');
            return;
        }
        const btn = this;
        btn.disabled = true;
        try {
            const res = await fetch(`${API_BASE}/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, otp: otp })
            });
            const data = await res.json().catch(() => ({}));
            if (data.success) {
                const user = {
                    name: email.split('@')[0],
                    email: email
                };
                onLoginSuccess(user);
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
        document.addEventListener('DOMContentLoaded', checkAuth);
    } else {
        checkAuth();
    }

    window.loginModal = { show: showLoginModal, hide: hideLoginModal, checkAuth: checkAuth };
})();
