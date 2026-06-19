import { useState } from "react";
import { FaEye, FaEyeSlash, FaEnvelope, FaLock } from "react-icons/fa";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const user = userCredential.user;
      const userSnap = await get(ref(database, `users/${user.uid}`));

      if (!userSnap.exists()) {
        alert("User profile not found. Please contact admin.");
        return;
      }

      const userData = userSnap.val();

      if (userData.role === "superAdmin") {
        navigate("/super-admin");
      } else if (userData.role === "admin") {
        navigate("/admin");
      } else if (userData.role === "departmentAdmin") {
        navigate("/department-admin");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-panel">
          <div className="brand-area">
            <img
              src="/Logo.webp"
              alt="Zuvius Lifesciences"
              className="brand-logo"
            />
          </div>

          <h1>
            Welcome <span>Back!</span>
          </h1>

          <p>Log in to continue your training journey.</p>
        </div>

        <div className="form-panel">
          <h2>Login</h2>
          <div className="title-line"></div>

          <form onSubmit={handleLogin} className="login-form" autoComplete="off">
            <input type="text" name="fake-user" style={{ display: "none" }} />
            <input type="password" name="fake-pass" style={{ display: "none" }} />

            <div className="input-group">
              <FaEnvelope />
              <input
                type="email"
                name="zuvius_login_email"
                autoComplete="off"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="input-group password-group">
              <FaLock />
              <input
                type={showPassword ? "text" : "password"}
                name="zuvius_login_password"
                autoComplete="new-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <span
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>

            <div className="forgot-password">Forgot Password?</div>

            <button type="submit">Login</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;