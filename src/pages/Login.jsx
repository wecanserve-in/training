import { useState } from "react";
import {
  FaEye,
  FaEyeSlash,
  FaEnvelope,
  FaLock,
} from "react-icons/fa";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { getRoleHomePath, loadUserProfile } from "../lib/userAccess";
import "../styles/login.css";

import { ref, set } from "firebase/database";
import { database } from "../firebase";

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
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    const user = userCredential.user;
    const loginEmail = String(user.email || "").toLowerCase();

    if (loginEmail === "wemedialabs@gmail.com") {
      await set(ref(database, `users/${user.uid}`), {
        uid: user.uid,
        name: "We Media Labs",
        email: user.email,
        role: "superAdmin",
        status: "active",
        createdAt: new Date().toISOString(),
      });

      navigate("/super-admin", { replace: true });
      return;
    }

    const userData = await loadUserProfile(user);

    if (!userData) {
      setErrorMessage("Unable to load your profile. Contact administrator.");
      return;
    }

    navigate(getRoleHomePath(userData.role), {
      replace: true,
    });
  } catch (error) {
    console.error(error);
    setErrorMessage("Invalid email or password.");
  } finally {
    setIsSubmitting(false);
  }
};

  return (
    <div className="login-page">
      <div className="login-box">

        {/* LEFT */}

        <div className="left-panel">

          <img
            src="/Logo.webp"
            alt="Logo"
            className="brand-logo"
          />

          <div className="hero-content">

            <h1>
              Learn.<br />
              <span>Develop.</span><br />
            Perform.
            </h1>

            <p>
              Access company training, certifications, and learning resources anytime, anywhere.
            </p>

          </div>

        </div>

        {/* RIGHT */}

        <div className="right-panel">

          <h2>Welcome Back!</h2>

          <p className="subtitle">
            Login to continue your training journey.
          </p>

          <form
            className="login-form"
            onSubmit={handleLogin}
            autoComplete="off"
          >

            <input
              type="text"
              autoComplete="username"
              style={{ display: "none" }}
            />

            <input
              type="password"
              autoComplete="new-password"
              style={{ display: "none" }}
            />

            <div className="field">

              <label>Email Address</label>

              <div className="input-group">
                <FaEnvelope />

                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  required
                />
              </div>

            </div>

            <div className="field">

              <label>Password</label>

              <div className="input-group password-group">

                <FaLock />

                <input
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
                  required
                />

               <span
  className="password-toggle"
  onClick={() => setShowPassword(!showPassword)}
  role="button"
  tabIndex={0}
>
                  {showPassword ? (
                    <FaEyeSlash />
                  ) : (
                    <FaEye />
                  )}
                </span>

              </div>

            </div>

            <div className="login-options">

              <label className="remember">

                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={() =>
                    setRememberMe(!rememberMe)
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
              <div className="login-error">
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