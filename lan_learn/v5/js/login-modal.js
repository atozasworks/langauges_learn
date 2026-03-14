(() => {
  const loginForm = document.getElementById("loginForm");
  const loginNameInput = document.getElementById("loginName");
  const googleOption = document.getElementById("googleOption");
  const otpEmail = document.getElementById("otpEmail");
  const sendOtpBtn = document.getElementById("sendOtpBtn");
  const otpDigits = Array.from(document.querySelectorAll(".otp-digit"));
  const modeHint = document.getElementById("modeHint");
  const formError = document.getElementById("formError");
  const formSuccess = document.getElementById("formSuccess");
  const modal = document.getElementById("loginModal");
  const closeButton = document.querySelector(".modal-close");

  // Navbar elements
  const navLoginBtn = document.getElementById("nav-login");
  const navUserInfo = document.getElementById("nav-user-info");
  const navUserName = document.getElementById("nav-user-name");
  const navLogoutBtn = document.getElementById("nav-logout-btn");

  if (!loginForm || !googleOption || !otpEmail || otpDigits.length === 0 || !modeHint || !formError || !formSuccess || !modal) {
    return;
  }

  let loginMode = null;
  let googleTokenClient = null;
  let googleProfile = null;
  let otpRequestedForEmail = "";

  const googleClientId =
    googleOption.getAttribute("data-client-id") ||
    "517209799545-dtdrnpunls3uvte15oirf9rg5qrnlo1n.apps.googleusercontent.com";

  // ─── Check if user is already logged in (sessionStorage) ───
  const savedUser = sessionStorage.getItem("loggedInUser");
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      showLoggedInState(user.name, user.email);
    } catch (_) {}
  }

  // ─── OTP digit input handling ───
  otpDigits.forEach((digit, index) => {
    digit.addEventListener("input", () => {
      digit.value = digit.value.replace(/\D/g, "").slice(0, 1);
      if (digit.value && index < otpDigits.length - 1) {
        otpDigits[index + 1].focus();
      }
    });

    digit.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !digit.value && index > 0) {
        otpDigits[index - 1].focus();
      }
    });

    digit.addEventListener("focus", () => setLoginMode("otp"));
  });

  otpEmail.addEventListener("focus", () => setLoginMode("otp"));
  otpEmail.addEventListener("input", () => {
    otpRequestedForEmail = "";
  });

  // ─── Google button click ───
  googleOption.addEventListener("click", async () => {
    setLoginMode("google");
    // Disable name field — Google provides the name automatically
    if (loginNameInput) {
      loginNameInput.disabled = true;
      loginNameInput.value = "";
      loginNameInput.placeholder = "Name will be fetched from Google";
    }
    await startGooglePopupLogin();
  });

  // ─── Send OTP button ───
  sendOtpBtn?.addEventListener("click", async () => {
    setLoginMode("otp");
    formError.textContent = "";
    formSuccess.textContent = "";

    const email = otpEmail.value.trim();
    if (!email) {
      formError.textContent = "Enter your Gmail before requesting OTP.";
      return;
    }

    const name = loginNameInput ? loginNameInput.value.trim() : "";
    if (!name) {
      formError.textContent = "Enter your name before requesting OTP.";
      loginNameInput?.focus();
      return;
    }

    sendOtpBtn.disabled = true;
    sendOtpBtn.textContent = "Sending...";

    try {
      const response = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        formError.textContent = payload.message || "Failed to send OTP.";
        return;
      }

      otpRequestedForEmail = email;
      formSuccess.textContent = payload.message || "OTP sent successfully.";
    } catch (error) {
      formError.textContent = "Server error while sending OTP.";
    } finally {
      sendOtpBtn.disabled = false;
      sendOtpBtn.textContent = "Send OTP";
    }
  });

  // ─── Close modal helpers ───
  function closeModal() {
    modal.classList.remove("show");
    document.body.classList.remove("modal-open");
  }

  closeButton?.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("show")) closeModal();
  });

  // ─── Logout button — show confirmation popup ───
  const logoutYesBtn = document.getElementById("logout-yes-btn");
  const logoutNoBtn = document.getElementById("logout-no-btn");

  navLogoutBtn?.addEventListener("click", () => {
    Utils.showPopup('logout-popup');
  });

  logoutYesBtn?.addEventListener("click", () => {
    Utils.hidePopup('logout-popup');
    sessionStorage.removeItem("loggedInUser");
    showLoggedOutState();
    // Notify other modules (e.g. LearnHome) about logout
    window.dispatchEvent(new CustomEvent('userLogout'));
  });

  logoutNoBtn?.addEventListener("click", () => {
    Utils.hidePopup('logout-popup');
  });

  // ─── Show logged-in state in navbar ───
  function showLoggedInState(name, email) {
    if (navLoginBtn) navLoginBtn.style.display = "none";
    if (navUserInfo) {
      navUserInfo.style.display = "flex";
      navUserName.textContent = name || email || "User";
    }
  }

  // ─── Show logged-out state in navbar ───
  function showLoggedOutState() {
    if (navLoginBtn) navLoginBtn.style.display = "";
    if (navUserInfo) navUserInfo.style.display = "none";
    if (navUserName) navUserName.textContent = "";
    // Reset form
    loginMode = null;
    googleProfile = null;
    otpRequestedForEmail = "";
    loginForm.reset();
    if (loginNameInput) {
      loginNameInput.disabled = false;
      loginNameInput.placeholder = "Enter your name";
    }
    setLoginMode(null);
  }

  // ─── Handle successful login ───
  function onLoginSuccess(name, email) {
    const userData = { name, email };
    sessionStorage.setItem("loggedInUser", JSON.stringify(userData));
    showLoggedInState(name, email);

    // Notify other modules (e.g. LearnHome) about login
    window.dispatchEvent(new CustomEvent('userLogin', { detail: { name, email } }));

    // Show success briefly, then close modal
    formSuccess.textContent = `Welcome, ${name}!`;
    setTimeout(() => {
      closeModal();
      // Reset form for next time
      formError.textContent = "";
      formSuccess.textContent = "";
    }, 1200);
  }

  // ─── Mode toggle ───
  function setLoginMode(mode) {
    loginMode = mode;
    formError.textContent = "";
    formSuccess.textContent = "";

    if (mode === "google") {
      loginForm.classList.remove("mode-otp");
      loginForm.classList.add("mode-google");
      googleOption.setAttribute("aria-pressed", "true");
      googleOption.setAttribute("aria-disabled", "false");

      otpEmail.disabled = true;
      otpDigits.forEach((digit) => {
        digit.disabled = true;
        digit.value = "";
      });

      otpEmail.value = "";
      otpRequestedForEmail = "";
      // Disable name for Google — auto-fetched
      if (loginNameInput) {
        loginNameInput.disabled = true;
        loginNameInput.value = "";
        loginNameInput.placeholder = "Name will be fetched from Google";
      }
      modeHint.textContent = "Google login selected. OTP fields are disabled.";
      return;
    }

    if (mode === "otp") {
      loginForm.classList.remove("mode-google");
      loginForm.classList.add("mode-otp");
      googleOption.setAttribute("aria-pressed", "false");
      googleOption.setAttribute("aria-disabled", "true");

      otpEmail.disabled = false;
      otpDigits.forEach((digit) => {
        digit.disabled = false;
      });

      // Enable name for OTP — user must type it
      if (loginNameInput) {
        loginNameInput.disabled = false;
        loginNameInput.placeholder = "Enter your name";
      }
      modeHint.textContent = "OTP login selected. Google option is inactive.";
      return;
    }

    // Reset
    loginForm.classList.remove("mode-google", "mode-otp");
    googleOption.setAttribute("aria-pressed", "false");
    googleOption.setAttribute("aria-disabled", "false");
    otpEmail.disabled = false;
    otpDigits.forEach((digit) => {
      digit.disabled = false;
    });
    if (loginNameInput) {
      loginNameInput.disabled = false;
      loginNameInput.placeholder = "Enter your name";
    }
    modeHint.textContent = "Select one login method to continue.";
  }

  // ─── Google OAuth ───
  function ensureGoogleTokenClient() {
    if (googleTokenClient) return googleTokenClient;
    if (!window.google?.accounts?.oauth2) return null;

    googleTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: "openid email profile",
      callback: () => {}
    });

    return googleTokenClient;
  }

  async function fetchGoogleUserProfile(accessToken) {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error("Failed to fetch Google account profile.");
    return response.json();
  }

  async function saveGoogleLoginToDatabase(accessToken) {
    const response = await fetch("/api/save-google-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken })
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "Failed to save Google login.");
    }
    return payload;
  }

  async function startGooglePopupLogin() {
    formError.textContent = "";
    formSuccess.textContent = "";

    const tokenClient = ensureGoogleTokenClient();
    if (!tokenClient) {
      formError.textContent = "Google login not ready. Refresh and try again.";
      return;
    }

    googleOption.disabled = true;
    formSuccess.textContent = "Opening Google account popup...";

    try {
      const tokenResponse = await new Promise((resolve, reject) => {
        tokenClient.callback = (response) => {
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response);
        };
        tokenClient.requestAccessToken({ prompt: "consent" });
      });

      const profile = await fetchGoogleUserProfile(tokenResponse.access_token);
      await saveGoogleLoginToDatabase(tokenResponse.access_token);
      googleProfile = profile;

      // Auto-fetch name from Google profile
      const displayName = profile.name || profile.email;
      if (loginNameInput) {
        loginNameInput.value = displayName;
      }
      onLoginSuccess(displayName, profile.email);
    } catch (error) {
      formError.textContent = "Google login failed. Please try again.";
    } finally {
      googleOption.disabled = false;
    }
  }

  // ─── Form submit (OTP verify) ───
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.textContent = "";
    formSuccess.textContent = "";

    if (!loginMode) {
      formError.textContent = "Please select Google or OTP login before continuing.";
      return;
    }

    if (loginMode === "google") {
      if (googleProfile?.email) {
        const displayName = googleProfile.name || googleProfile.email;
        onLoginSuccess(displayName, googleProfile.email);
        return;
      }
      await startGooglePopupLogin();
      return;
    }

    // OTP mode — name is required
    const name = loginNameInput ? loginNameInput.value.trim() : "";
    if (!name) {
      formError.textContent = "Please enter your name.";
      loginNameInput?.focus();
      return;
    }

    const otp = otpDigits.map((digit) => digit.value.trim()).join("");
    const email = otpEmail.value.trim();

    if (!email || otp.length !== 4) {
      formError.textContent = "Enter your Gmail and complete all 4 OTP digits.";
      return;
    }

    if (otpRequestedForEmail !== email) {
      formError.textContent = "Please click Send OTP for this email first.";
      return;
    }

    try {
      const response = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp })
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        formError.textContent = payload.message || "OTP verification failed.";
        return;
      }

      // OTP verified — login success
      onLoginSuccess(name, email);
    } catch (error) {
      formError.textContent = "Server error while verifying OTP. Please try again.";
    }
  });
})();
