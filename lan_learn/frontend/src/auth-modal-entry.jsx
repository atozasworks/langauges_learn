import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AuthProvider,
  EmailOtpLogin,
  GoogleLoginButton,
  useAuth,
} from "atozas-react-auth-kit";
import "atozas-react-auth-kit/styles.css";
import "./auth-modal.css";

function parseErrorMessage(error, fallback) {
  if (!error) {
    return fallback;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    if (error.response?.data?.error) {
      return String(error.response.data.error);
    }

    if (error.message) {
      return String(error.message);
    }
  }

  return fallback;
}

function saveLegacySession(user) {
  if (!user?.email) {
    return;
  }

  const payload = {
    name: user.name || user.email,
    email: user.email,
    provider: user.provider || "email",
  };

  sessionStorage.setItem("loggedInUser", JSON.stringify(payload));
}

function clearLegacySession() {
  sessionStorage.removeItem("loggedInUser");
}

function LegacySessionBridge() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const previousEmailRef = useRef(null);

  useEffect(() => {
    const handleLogoutRequest = async () => {
      try {
        await logout();
      } finally {
        window.dispatchEvent(new CustomEvent("auth:logout-complete"));
      }
    };

    window.addEventListener("auth:logout-request", handleLogoutRequest);
    return () => window.removeEventListener("auth:logout-request", handleLogoutRequest);
  }, [logout]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (isAuthenticated && user?.email) {
      saveLegacySession(user);

      if (previousEmailRef.current !== user.email) {
        previousEmailRef.current = user.email;
        window.dispatchEvent(
          new CustomEvent("userLogin", {
            detail: {
              name: user.name || user.email,
              email: user.email,
              provider: user.provider || "email",
            },
          })
        );
      }

      return;
    }

    if (previousEmailRef.current) {
      previousEmailRef.current = null;
      clearLegacySession();
      window.dispatchEvent(new CustomEvent("userLogout"));
    }
  }, [isAuthenticated, isLoading, user]);

  return null;
}

function AuthShell({ googleEnabled }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleAuthSuccess = useCallback(() => {
    setErrorMessage("");
    setNotice("Login successful. Redirecting to your learning space...");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("auth:login-success"));
    }, 350);
  }, []);

  const handleAuthError = useCallback((error) => {
    setNotice("");
    setErrorMessage(parseErrorMessage(error, "Authentication failed. Please try again."));
  }, []);

  const handleSignOut = useCallback(async () => {
    setNotice("");
    setErrorMessage("");

    try {
      await logout();
    } finally {
      window.dispatchEvent(new CustomEvent("auth:logout-complete"));
    }
  }, [logout]);

  if (isLoading) {
    return (
      <div className="authkit-loading">
        <div className="authkit-spinner" aria-hidden="true" />
        <p>Checking your secure session...</p>
      </div>
    );
  }

  if (isAuthenticated && user?.email) {
    return (
      <div className="authkit-shell">
        <div className="authkit-header">
          <h3>Signed In</h3>
          <p>Your secure session is active.</p>
        </div>

        <div className="authkit-user-card">
          <p className="authkit-user-name">{user.name || user.email}</p>
          <p className="authkit-user-email">{user.email}</p>
        </div>

        <button type="button" className="authkit-signout-btn" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="authkit-shell">
      <div className="authkit-header">
        <h3>Secure Sign In</h3>
        <p>Continue with Google or email OTP. No passwords required.</p>
      </div>

      {googleEnabled ? (
        <GoogleLoginButton onSuccess={handleAuthSuccess} onError={handleAuthError} />
      ) : (
        <div className="authkit-warning">Google sign-in is unavailable. Configure `GOOGLE_CLIENT_ID` on the backend.</div>
      )}

      <div className="authkit-divider">or</div>

      <EmailOtpLogin onSuccess={handleAuthSuccess} onError={handleAuthError} />

      {notice ? <p className="authkit-notice">{notice}</p> : null}
      {errorMessage ? <p className="authkit-error">{errorMessage}</p> : null}
    </div>
  );
}

function AuthBootstrap() {
  const [state, setState] = useState({
    isLoading: true,
    error: "",
    apiUrl: "/api/auth",
    googleClientId: "",
  });

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch("/api/auth/config", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload.success === false) {
          throw new Error(payload.message || "Failed to load auth configuration");
        }

        setState({
          isLoading: false,
          error: "",
          apiUrl: payload.apiUrl || "/api/auth",
          googleClientId: payload.googleClientId || "",
        });
      } catch (error) {
        setState({
          isLoading: false,
          error: parseErrorMessage(error, "Unable to initialize authentication."),
          apiUrl: "/api/auth",
          googleClientId: "",
        });
      }
    };

    loadConfig();
  }, []);

  if (state.isLoading) {
    return (
      <div className="authkit-loading">
        <div className="authkit-spinner" aria-hidden="true" />
        <p>Preparing secure login...</p>
      </div>
    );
  }

  if (state.error) {
    return <div className="authkit-error-block">{state.error}</div>;
  }

  return (
    <AuthProvider
      apiUrl={state.apiUrl}
      googleClientId={state.googleClientId || "missing-google-client-id"}
      enableLocalStorage={true}
      onAuthError={() => {
        window.dispatchEvent(new CustomEvent("auth:session-expired"));
      }}
    >
      <LegacySessionBridge />
      <AuthShell googleEnabled={Boolean(state.googleClientId)} />
    </AuthProvider>
  );
}

function mountAuthModal() {
  const mountNode = document.getElementById("react-auth-root");
  if (!mountNode) {
    return;
  }

  const root = createRoot(mountNode);
  root.render(<AuthBootstrap />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountAuthModal, { once: true });
} else {
  mountAuthModal();
}
