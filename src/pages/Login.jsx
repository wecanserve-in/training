import { useState } from "react";
import {
  FaEye,
  FaEyeSlash,
  FaEnvelope,
  FaLock,
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
      // Remember me checked:
      // login stays active after browser restart.
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

      // Only read profile from Realtime Database.
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
          <img
            src="/Logo.webp"
            alt="Logo"
            className="brand-logo"
          />

          <div className="hero-content">
            <h1>
              Learn.
              <br />

              <span>Develop.</span>
              <br />

              <span className="accent-red">Perform.</span>
            </h1>

            <p>
              Access company training,
              certifications, and learning
              resources anytime, anywhere.
            </p>
          </div>
        </div>

        {/* RIGHT PANEL */}

        <div className="right-panel">
          <h2>Welcome Back!</h2>

          <p className="subtitle">
            Login to continue your training
            journey.
          </p>

          <form
            className="login-form"
            onSubmit={handleLogin}
          >
            <div className="field">
              <label htmlFor="login-email">
                Email Address
              </label>

              <div className="input-group">
                <FaEnvelope />

                <input
                  id="login-email"
                  type="email"
                  placeholder="Enter your email"
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
                <FaLock />

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

                Remember me
              </label>

              <button
                type="button"
                className="forgot-password"
              >
                Forgot Password?
              </button>
            </div>

            {errorMessage && (
              <div
                className="login-error"
                role="alert"
              >
                {errorMessage}
              </div>
            )}

            <button
              className="login-btn"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Signing In..."
                : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;