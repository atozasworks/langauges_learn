(() => {
  const modal = document.getElementById("loginModal");
  const closeButton = document.querySelector("#loginModal .modal-close");

  const navLoginBtn = document.getElementById("nav-login");
  const navUserInfo = document.getElementById("nav-user-info");
  const navUserName = document.getElementById("nav-user-name");
  const navLogoutBtn = document.getElementById("nav-logout-btn");

  const logoutYesBtn = document.getElementById("logout-yes-btn");
  const logoutNoBtn = document.getElementById("logout-no-btn");

  if (!modal || !navLoginBtn || !navUserInfo || !navUserName || !navLogoutBtn) {
    return;
  }

  function readLoggedInUser() {
    try {
      const raw = sessionStorage.getItem("loggedInUser");
      if (!raw) {
        return null;
      }

      const user = JSON.parse(raw);
      if (!user || !user.email) {
        return null;
      }

      return user;
    } catch (_) {
      return null;
    }
  }

  function showLoggedInState(user) {
    navLoginBtn.style.display = "none";
    navUserInfo.style.display = "flex";
    navUserName.textContent = user.name || user.email || "User";
  }

  function showLoggedOutState() {
    navLoginBtn.style.display = "";
    navUserInfo.style.display = "none";
    navUserName.textContent = "";
  }

  function syncNavbarFromSession() {
    const user = readLoggedInUser();
    if (user) {
      showLoggedInState(user);
      return;
    }

    showLoggedOutState();
  }

  function openModal() {
    modal.classList.add("show");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    modal.classList.remove("show");
    document.body.classList.remove("modal-open");
  }

  function requestLogout() {
    navLogoutBtn.disabled = true;
    window.dispatchEvent(new CustomEvent("auth:logout-request"));
  }

  navLoginBtn.addEventListener("click", (event) => {
    event.preventDefault();
    openModal();
  });

  closeButton?.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("show")) {
      closeModal();
    }
  });

  navLogoutBtn.addEventListener("click", () => {
    if (typeof Utils !== "undefined" && Utils.showPopup) {
      Utils.showPopup("logout-popup");
      return;
    }

    requestLogout();
  });

  logoutYesBtn?.addEventListener("click", () => {
    if (typeof Utils !== "undefined" && Utils.hidePopup) {
      Utils.hidePopup("logout-popup");
    }

    requestLogout();
  });

  logoutNoBtn?.addEventListener("click", () => {
    if (typeof Utils !== "undefined" && Utils.hidePopup) {
      Utils.hidePopup("logout-popup");
    }
  });

  window.addEventListener("auth:logout-complete", () => {
    navLogoutBtn.disabled = false;
    sessionStorage.removeItem("loggedInUser");
    showLoggedOutState();
    closeModal();
    window.dispatchEvent(new CustomEvent("userLogout"));
  });

  window.addEventListener("auth:session-expired", () => {
    sessionStorage.removeItem("loggedInUser");
    showLoggedOutState();
    window.dispatchEvent(new CustomEvent("auth:logout-request"));
    window.dispatchEvent(new CustomEvent("userLogout"));
  });

  window.addEventListener("auth:login-success", closeModal);

  window.addEventListener("userLogin", (event) => {
    const detail = event.detail || {};

    if (detail.email) {
      sessionStorage.setItem(
        "loggedInUser",
        JSON.stringify({
          name: detail.name || detail.email,
          email: detail.email,
          provider: detail.provider || "email",
        })
      );
    }

    syncNavbarFromSession();
  });

  window.addEventListener("userLogout", () => {
    sessionStorage.removeItem("loggedInUser");
    showLoggedOutState();
  });

  syncNavbarFromSession();
})();
