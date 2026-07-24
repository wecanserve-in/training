import { useState } from "react";
import {
  FaEye,
  FaEyeSlash,
  FaEnvelope,
  FaLock,
  FaGraduationCap,
  FaShieldAlt,
  FaChartLine,
  FaUsers,
} from "react-icons/fa";

import {
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { useNavigate } from "react-router-dom";

import { auth } from "../firebase";
import {
  getRoleHomePath,
  loadUserProfile,
} from "../lib/userAccess";

import "../styles/login.css";

const normalizeEmail = (value) =>
  String(value ?? "").trim().toLowerCase();

const normalizeRole = (value) =>
  String(value ?? "").trim().toLowerCase();

const normalizeStatus = (value) =>
  String(value ?? "active").trim().toLowerCase();

const ALLOWED_ROLES = new Set([
  "superadmin",
  "admin",
  "departmentadmin",
  "user",
]);

const getSafeLoginErrorMessage = (error) => {
  const errorCode = error?.code || "";

  switch (errorCode) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Invalid email address or password.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/user-disabled":
      return "This account has been disabled. Please contact the administrator.";

    case "auth/too-many-requests":
      return "Too many failed login attempts. Please try again later.";

    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";

    case "auth/operation-not-allowed":
      return "Email and password login is currently unavailable.";

    case "auth/internal-error":
      return "An authentication error occurred. Please try again.";

    case "PERMISSION_DENIED":
    case "permission-denied":
      return "You do not have permission to access this portal.";

    default: {
      const message = String(error?.message ?? "").toLowerCase();

      if (
        message.includes("permission denied") ||
        message.includes("permission-denied")
      ) {
        return "You do not have permission to access this portal.";
      }

      if (message.includes("network")) {
        return "Network error. Please check your internet connection.";
      }

      return "Unable to sign in. Please try again.";
    }
  }
};

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] =
    useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const clearMessages = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  const safelySignOut = async () => {
    try {
      await signOut(auth);
    } catch (signOutError) {
      if (import.meta.env.DEV) {
        console.error("Sign-out error:", signOutError);
      }
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    clearMessages();

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsSubmitting(true);

    try {
      /*
       * Local persistence:
       * User remains logged in after closing the browser.
       *
       * Session persistence:
       * Login is cleared after the browser session ends.
       */
      await setPersistence(
        auth,
        rememberMe
          ? browserLocalPersistence
          : browserSessionPersistence
      );

      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          normalizedEmail,
          password
        );

      const authenticatedUser = userCredential.user;

      /*
       * No email-based Super Admin fallback.
       * The user must have a valid database profile and role.
       */
      const userProfile = await loadUserProfile(
        authenticatedUser
      );

      if (!userProfile) {
        await safelySignOut();

        setErrorMessage(
          "Your account profile was not found. Please contact the administrator."
        );

        return;
      }

      /*
       * Ensure that the loaded profile belongs to the
       * currently authenticated Firebase user.
       *
       * Profiles without a uid are still supported temporarily
       * so older accounts do not break. New profiles should
       * always contain uid.
       */
      if (
        userProfile.uid &&
        userProfile.uid !== authenticatedUser.uid
      ) {
        await safelySignOut();

        setErrorMessage(
          "Account verification failed. Please contact the administrator."
        );

        return;
      }

      const accountStatus = normalizeStatus(
        userProfile.status
      );

      if (
        accountStatus === "inactive" ||
        accountStatus === "disabled" ||
        accountStatus === "blocked" ||
        accountStatus === "suspended"
      ) {
        await safelySignOut();

        setErrorMessage(
          "Your account has been deactivated. Please contact the administrator."
        );

        return;
      }

      const normalizedRole = normalizeRole(
        userProfile.role
      );

      if (!normalizedRole) {
        await safelySignOut();

        setErrorMessage(
          "No role has been assigned to your account."
        );

        return;
      }

      if (!ALLOWED_ROLES.has(normalizedRole)) {
        await safelySignOut();

        setErrorMessage(
          "Your account has an invalid role. Please contact the administrator."
        );

        return;
      }

      /*
       * Pass the original role because getRoleHomePath()
       * may already normalize superAdmin/departmentAdmin.
       */
      const destinationPath = getRoleHomePath(
        userProfile.role
      );

      if (
        !destinationPath ||
        typeof destinationPath !== "string"
      ) {
        await safelySignOut();

        setErrorMessage(
          "Your dashboard could not be determined. Please contact the administrator."
        );

        return;
      }

      navigate(destinationPath, {
        replace: true,
      });
    } catch (error) {
      /*
       * Remove any partially authenticated session if profile
       * loading, role validation, or navigation preparation fails.
       */
      if (auth.currentUser) {
        await safelySignOut();
      }

      if (import.meta.env.DEV) {
        console.error("Login error:", error);
      }

      setErrorMessage(
        getSafeLoginErrorMessage(error)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (isResettingPassword || isSubmitting) {
      return;
    }

    clearMessages();

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      setErrorMessage(
        "Enter your email address first, then click Forgot password."
      );

      return;
    }

    setIsResettingPassword(true);

    try {
      await sendPasswordResetEmail(
        auth,
        normalizedEmail
      );

      /*
       * Use a generic success message.
       * This prevents revealing whether an email account exists.
       */
      setSuccessMessage(
        "If an account exists for this email, a password reset link has been sent."
      );
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(
          "Password-reset error:",
          error
        );
      }

      switch (error?.code) {
        case "auth/invalid-email":
          setErrorMessage(
            "Please enter a valid email address."
          );
          break;

        case "auth/too-many-requests":
          setErrorMessage(
            "Too many reset requests. Please try again later."
          );
          break;

        case "auth/network-request-failed":
          setErrorMessage(
            "Network error. Please check your internet connection."
          );
          break;

        default:
          /*
           * Generic response prevents account enumeration.
           */
          setSuccessMessage(
            "If an account exists for this email, a password reset link has been sent."
          );
      }
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        {/* LEFT PANEL */}
        <div className="left-panel">
          <div className="left-overlay" />

          <div className="left-content">
            <div className="brand-section">
              <img
                src="/zuvius-logo.png"
                alt="Company logo"
                className="brand-logo"
              />
            </div>

            <div className="hero-section">
              <h1>
                Learn.
                <br />

                <span className="highlight">
                  Develop.
                </span>

                <br />
                Perform.
              </h1>

              <p className="hero-desc">
                Your company training and
                certification hub.
              </p>

              <div className="feature-list">
                <div className="feature-item">
                  <div className="feature-icon">
                    <FaGraduationCap />
                  </div>

                  <div>
                    <strong>Courses</strong>
                    <span>
                      Access assigned training
                    </span>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon">
                    <FaShieldAlt />
                  </div>

                  <div>
                    <strong>
                      Certifications
                    </strong>
                    <span>Earn credentials</span>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon">
                    <FaChartLine />
                  </div>

                  <div>
                    <strong>Progress</strong>
                    <span>
                      Track completion
                    </span>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon">
                    <FaUsers />
                  </div>

                  <div>
                    <strong>Team</strong>
                    <span>
                      Department training
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="left-footer">
              <span>
                Secure internal learning portal
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="right-panel">
          <div className="right-content">
            <div className="form-header">
              <div className="welcome-badge">
                Welcome Back
              </div>

              <h2>Sign in</h2>

              <p>
                Enter your credentials to continue
              </p>
            </div>

            <form
              className="login-form"
              onSubmit={handleLogin}
            >
              <div className="field">
                <label htmlFor="login-email">
                  Email Address
                </label>

                <div className="input-group">
                  <FaEnvelope
                    className="input-icon"
                    aria-hidden="true"
                  />

                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      clearMessages();
                    }}
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={254}
                    disabled={
                      isSubmitting ||
                      isResettingPassword
                    }
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="login-password">
                  Password
                </label>

                <div className="input-group password-group">
                  <FaLock
                    className="input-icon"
                    aria-hidden="true"
                  />

                  <input
                    id="login-password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => {
                      setPassword(
                        event.target.value
                      );
                      clearMessages();
                    }}
                    autoComplete="current-password"
                    maxLength={128}
                    disabled={
                      isSubmitting ||
                      isResettingPassword
                    }
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword(
                        (previousValue) =>
                          !previousValue
                      )
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    aria-pressed={showPassword}
                    disabled={isSubmitting}
                  >
                    {showPassword ? (
                      <FaEyeSlash />
                    ) : (
                      <FaEye />
                    )}
                  </button>
                </div>
              </div>

              <div className="login-options">
                <label className="remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) =>
                      setRememberMe(
                        event.target.checked
                      )
                    }
                    disabled={isSubmitting}
                  />

                  <span>
                    Keep me signed in
                  </span>
                </label>

                <button
                  type="button"
                  className="forgot-password"
                  onClick={
                    handleForgotPassword
                  }
                  disabled={
                    isSubmitting ||
                    isResettingPassword
                  }
                >
                  {isResettingPassword
                    ? "Sending..."
                    : "Forgot password?"}
                </button>
              </div>

              <div
                aria-live="polite"
                aria-atomic="true"
              >
                {errorMessage && (
                  <div
                    className="login-error"
                    role="alert"
                  >
                    <span
                      className="error-dot"
                      aria-hidden="true"
                    />

                    {errorMessage}
                  </div>
                )}

                {successMessage && (
                  <div
                    className="login-success"
                    role="status"
                  >
                    {successMessage}
                  </div>
                )}
              </div>

              <button
                className="login-btn"
                type="submit"
                disabled={
                  isSubmitting ||
                  isResettingPassword
                }
              >
                {isSubmitting ? (
                  <span className="btn-loading">
                    <span
                      className="spinner"
                      aria-hidden="true"
                    />

                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="form-footer">
              <p>Internal use only</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;