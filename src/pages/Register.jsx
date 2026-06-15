import { useState } from "react";
import {
  FaEye,
  FaEyeSlash,
  FaEnvelope,
  FaLock,
  FaUser,
  FaBuilding,
} from "react-icons/fa";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { ref, set } from "firebase/database";
import { auth, database } from "../firebase";
import { Link, useNavigate } from "react-router-dom";
import "../styles/register.css";

function Register() {
  const navigate = useNavigate();

  const departments = ["Sales", "Marketing", "HR", "Production", "Accounts"];

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!department) {
      alert("Please select department");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await updateProfile(userCredential.user, {
        displayName: name.trim(),
      });

      await set(ref(database, "users/" + userCredential.user.uid), {
        name: name.trim(),
        email: email.trim(),
        department,
        createdAt: new Date().toISOString(),
      });

      navigate("/dashboard");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="register-page">
      <div className="register-box">
        <div className="register-panel">
          <div className="brand-area">
            <img
              src="/Logo.webp"
              alt="Zuvius Lifesciences"
              className="brand-logo"
            />
          </div>

          <h1>
            Create <span>Account</span>
          </h1>

          <p>Start your training journey with Zuvius Lifesciences.</p>

          <div className="login-box-link">
            <span>Already have an account?</span>
            <Link to="/">Login</Link>
          </div>
        </div>

        <div className="form-panel">
          <h2>Sign Up</h2>
          <div className="title-line"></div>

          <form
            onSubmit={handleRegister}
            className="register-form"
            autoComplete="off"
          >
            <input type="text" name="fake-user" style={{ display: "none" }} />
            <input
              type="password"
              name="fake-pass"
              style={{ display: "none" }}
            />

            <div className="input-group">
              <FaUser />
              <input
                type="text"
                name="zuvius_full_name"
                autoComplete="off"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <FaBuilding />
              <select
                name="zuvius_department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <FaEnvelope />
              <input
                type="email"
                name="zuvius_register_email"
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
                name="zuvius_new_password"
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

            <div className="input-group password-group">
              <FaLock />
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="zuvius_confirm_password"
                autoComplete="new-password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <span
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>

            <button type="submit">Create Account</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Register;