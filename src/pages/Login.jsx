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
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import {
  getRoleHomePath,
  loadUserProfile,
} from "../lib/userAccess";

import "../styles/login.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await setPersistence(
        auth,
        rememberMe
          ? browserLocalPersistence
          : browserSessionPersistence
      );

      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      const user = userCredential.user;

      const userData = await loadUserProfile(user);

      if (!userData) {
        await signOut(auth);

        setErrorMessage(
          "Your user profile was not found. Please contact the administrator."
        );

        return;
      }

      if (userData.status === "inactive") {
        await signOut(auth);

        setErrorMessage(
          "Your account has been deactivated. Please contact the administrator."
        );

        return;
      }

      if (!userData.role) {
        await signOut(auth);

        setErrorMessage(
          "No role has been assigned to your account."
        );

        return;
      }

      navigate(getRoleHomePath(userData.role), {
        replace: true,
      });
    } catch (error) {
      console.error("Login error:", error);

      switch (error.code) {
        case "auth/invalid-credential":
        case "auth/user-not-found":
        case "auth/wrong-password":
          setErrorMessage(
            "Invalid email address or password."
          );
          break;

        case "auth/invalid-email":
          setErrorMessage(
            "Please enter a valid email address."
          );
          break;

        case "auth/too-many-requests":
          setErrorMessage(
            "Too many failed attempts. Please try again later."
          );
          break;

        case "auth/network-request-failed":
          setErrorMessage(
            "Network error. Please check your internet connection."
          );
          break;

        case "PERMISSION_DENIED":
          setErrorMessage(
            "Database permission denied. Please check Firebase rules."
          );
          break;

        default:
          if (
            error.message
              ?.toLowerCase()
              .includes("permission denied")
          ) {
            setErrorMessage(
              "Database permission denied. Please check Firebase rules."
            );
          } else {
            setErrorMessage(
              "Unable to sign in. Please try again."
            );
          }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        {/* LEFT PANEL */}
        <div className="left-panel">
          <div className="left-overlay"></div>

          <div className="left-content">
            <div className="brand-section">
              <img
                src="/Logo.webp"
                alt="Logo"
                className="brand-logo"
              />
            </div>

            <div className="hero-section">
              <h1>
                Learn.
                <br />
                <span className="highlight">Develop.</span>
                <br />
                Perform.
              </h1>

              <p className="hero-desc">
                Your company training and certification hub.
              </p>

              <div className="feature-list">
                <div className="feature-item">
                  <div className="feature-icon">
                    <FaGraduationCap />
                  </div>
                  <div>
                    <strong>Courses</strong>
                    <span>Access assigned training</span>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon">
                    <FaShieldAlt />
                  </div>
                  <div>
                    <strong>Certifications</strong>
                    <span>Earn credentials</span>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon">
                    <FaChartLine />
                  </div>
                  <div>
                    <strong>Progress</strong>
                    <span>Track completion</span>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon">
                    <FaUsers />
                  </div>
                  <div>
                    <strong>Team</strong>
                    <span>Department training</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="left-footer">
              <span>Trusted by 10,000+ professionals</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="right-panel">
          <div className="right-content">
            <div className="form-header">
              <div className="welcome-badge">Welcome Back</div>
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
                  <FaEnvelope className="input-icon" />

                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="login-password">
                  Password
                </label>

                <div className="input-group password-group">
                  <FaLock className="input-icon" />

                  <input
                    id="login-password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword(
                        (previous) => !previous
                      )
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
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
                    onChange={(e) =>
                      setRememberMe(
                        e.target.checked
                      )
                    }
                  />

                  <span>Keep me signed in</span>
                </label>

                <button
                  type="button"
                  className="forgot-password"
                >
                  Forgot password?
                </button>
              </div>

              {errorMessage && (
                <div
                  className="login-error"
                  role="alert"
                >
                  <span className="error-dot"></span>
                  {errorMessage}
                </div>
              )}

              <button
                className="login-btn"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="btn-loading">
                    <span className="spinner"></span>
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="form-footer">
              <p>
                Internal use only
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
