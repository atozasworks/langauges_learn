(function () {
  const AUTH_STATE_KEY = 'gtongue_auth_user';
  const authApiMeta = document.querySelector('meta[name="auth-api-base"]');
  const resolvedBase =
    window.AUTH_API_BASE ||
    authApiMeta?.content ||
    `${window.location.protocol}//${window.location.hostname}:4000`;
  const AUTH_API_BASE = String(resolvedBase).replace(/\/$/, '');

  const state = {
    email: '',
    user: null,
  };

  const elements = {
    openBtn: document.getElementById('open-login-panel-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    closeBtn: document.getElementById('close-login-panel-btn'),
    overlay: document.getElementById('auth-panel-overlay'),
    panel: document.getElementById('auth-panel'),
    emailInput: document.getElementById('auth-email'),
    otpInput: document.getElementById('auth-otp'),
    sendOtpBtn: document.getElementById('send-otp-btn'),
    verifyOtpBtn: document.getElementById('verify-otp-btn'),
    status: document.getElementById('auth-status'),
    googleBtnContainer: document.getElementById('google-signin-btn'),
    googleClientIdMeta: document.querySelector('meta[name="google-signin-client_id"]'),
  };

  function saveAuthState(user) {
    try {
      if (user) {
        localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(AUTH_STATE_KEY);
      }
    } catch (error) {
      // no-op for storage access errors
    }
  }

  function loadAuthState() {
    try {
      const raw = localStorage.getItem(AUTH_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function updateAuthButtons() {
    const isLoggedIn = Boolean(state.user);
    if (elements.openBtn) {
      elements.openBtn.hidden = isLoggedIn;
    }
    if (elements.logoutBtn) {
      elements.logoutBtn.hidden = !isLoggedIn;
    }
  }

  function setLoggedIn(user) {
    state.user = user || null;
    saveAuthState(state.user);
    updateAuthButtons();
  }

  function logout() {
    setLoggedIn(null);
    state.email = '';
    if (elements.emailInput) {
      elements.emailInput.value = '';
    }
    if (elements.otpInput) {
      elements.otpInput.value = '';
    }
    setStatus('You have been logged out.', 'success');
    closePanel();
  }

  function setStatus(message, type) {
    if (!elements.status) return;
    elements.status.textContent = message || '';
    elements.status.classList.remove('success', 'error');
    if (type) {
      elements.status.classList.add(type);
    }
  }

  function openPanel() {
    if (!elements.panel || !elements.overlay) return;
    elements.panel.classList.add('show');
    elements.overlay.classList.add('show');
    elements.panel.setAttribute('aria-hidden', 'false');
  }

  function closePanel() {
    if (!elements.panel || !elements.overlay) return;
    elements.panel.classList.remove('show');
    elements.overlay.classList.remove('show');
    elements.panel.setAttribute('aria-hidden', 'true');
  }

  async function postJson(path, body) {
    let response;

    try {
      response = await fetch(`${AUTH_API_BASE}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new Error(
        `Cannot reach auth server at ${AUTH_API_BASE}. Start backend and check port/CORS.`
      );
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').toLowerCase());
  }

  async function sendOtp() {
    const email = (elements.emailInput?.value || '').trim().toLowerCase();

    if (!isValidEmail(email)) {
      setStatus('Please enter a valid email.', 'error');
      return;
    }

    state.email = email;
    setStatus('Sending OTP...', '');

    if (elements.sendOtpBtn) {
      elements.sendOtpBtn.disabled = true;
    }

    try {
      await postJson('/auth/send-otp', { email });
      setStatus(`OTP sent to ${email}.`, 'success');
    } catch (error) {
      setStatus(error.message || 'Could not send OTP.', 'error');
    } finally {
      if (elements.sendOtpBtn) {
        elements.sendOtpBtn.disabled = false;
      }
    }
  }

  async function verifyOtp() {
    const email = state.email || (elements.emailInput?.value || '').trim().toLowerCase();
    const otp = (elements.otpInput?.value || '').trim();

    if (!isValidEmail(email)) {
      setStatus('Email is required before OTP verification.', 'error');
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setStatus('Please enter a valid 6-digit OTP.', 'error');
      return;
    }

    setStatus('Verifying OTP...', '');

    if (elements.verifyOtpBtn) {
      elements.verifyOtpBtn.disabled = true;
    }

    try {
      const result = await postJson('/auth/verify-otp', { email, otp });
      setLoggedIn(result.user);
      setStatus(`Login success: ${result.user.email}`, 'success');
      closePanel();
    } catch (error) {
      setStatus(error.message || 'OTP verification failed.', 'error');
    } finally {
      if (elements.verifyOtpBtn) {
        elements.verifyOtpBtn.disabled = false;
      }
    }
  }

  async function handleGoogleCredential(response) {
    try {
      setStatus('Verifying Google login...', '');
      const result = await postJson('/auth/google-login', {
        credential: response.credential,
      });
      setLoggedIn(result.user);
      setStatus(`Google login success: ${result.user.email}`, 'success');
      closePanel();
    } catch (error) {
      setStatus(error.message || 'Google login failed.', 'error');
    }
  }

  function initGoogleLogin() {
    if (!window.google || !elements.googleBtnContainer) {
      return;
    }

    const clientId = (elements.googleClientIdMeta?.content || '').trim();
    if (!clientId || clientId.indexOf('your_google_web_client_id') >= 0) {
      setStatus('Google Client ID is not configured in index.html meta tag.', 'error');
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredential,
      ux_mode: 'popup',
    });

    window.google.accounts.id.renderButton(elements.googleBtnContainer, {
      theme: 'outline',
      size: 'large',
      type: 'standard',
      shape: 'rectangular',
      text: 'continue_with',
      width: 280,
    });
  }

  function bindEvents() {
    elements.openBtn?.addEventListener('click', openPanel);
    elements.closeBtn?.addEventListener('click', closePanel);
    elements.logoutBtn?.addEventListener('click', logout);
    elements.overlay?.addEventListener('click', closePanel);
    elements.sendOtpBtn?.addEventListener('click', sendOtp);
    elements.verifyOtpBtn?.addEventListener('click', verifyOtp);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closePanel();
      }
    });
  }

  function init() {
    state.user = loadAuthState();
    updateAuthButtons();

    bindEvents();

    // Google script may load after DOMContentLoaded.
    const waitForGoogle = setInterval(function () {
      if (window.google) {
        clearInterval(waitForGoogle);
        initGoogleLogin();
      }
    }, 250);

    setTimeout(function () {
      clearInterval(waitForGoogle);
      if (!window.google) {
        setStatus('Google script did not load. Check internet or CSP settings.', 'error');
      }
    }, 10_000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
