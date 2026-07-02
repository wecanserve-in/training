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

      console.log("UID:", user.uid);
      console.log("Email:", user.email);

      const snap = await get(ref(database, `users/${user.uid}`));

      if (!snap.exists()) {
        alert("User profile not found. Contact admin.");
        return;
      }

      const userData = snap.val();

      console.log("USER DATA:", userData);

      switch (userData.role) {
        case "superAdmin":
          navigate("/super-admin");
          break;

        case "admin":
          navigate("/admin");
          break;

        case "departmentAdmin":
          navigate("/department-admin");
          break;

        default:
          navigate("/dashboard");
      }
    } catch (error) {
      console.error(error);
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

          <form
            onSubmit={handleLogin}
            className="login-form"
            autoComplete="off"
          >
            <input
              type="text"
              name="fake-user"
              style={{ display: "none" }}
            />
            <input
              type="password"
              name="fake-pass"
              style={{ display: "none" }}
            />

            <div className="input-group">
              <FaEnvelope />
              <input
                type="email"
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

            <div className="forgot-password">
              Forgot Password?
            </div>

            <button type="submit">Login</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;