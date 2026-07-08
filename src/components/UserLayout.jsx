import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { loadUserProfile } from "../lib/userAccess";
import "../styles/userLayout.css";

function UserLayout() {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = auth.currentUser;

        if (!currentUser) return;

        setUserData(await loadUserProfile(currentUser));
      } catch (error) {
        console.error("Failed to load user profile:", error);
      }
    };

    loadUser();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const displayName =
    userData?.name ||
    userData?.fullName ||
    auth.currentUser?.displayName ||
    "User";

  const displayEmail =
    userData?.email ||
    auth.currentUser?.email ||
    "";

  return (
    <div className="learner-shell">
      <button
        className="learner-mobile-menu-btn"
        onClick={() => setSidebarOpen(true)}
        type="button"
      >
        ☰
      </button>

      {sidebarOpen && (
        <div
          className="learner-sidebar-overlay"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`learner-side-nav ${sidebarOpen ? "sidebar-open" : ""
          }`}
      >
        <button
          className="learner-sidebar-close"
          onClick={closeSidebar}
          type="button"
        >
          ×
        </button>

        <div className="learner-logo-box">
          <img src="/Logo.webp" alt="Zuvius Logo" />
        </div>

        <div className="learner-sidebar-profile">
          <div className="learner-profile-circle">
            {displayName?.charAt(0)?.toUpperCase()}
          </div>

          <h3>{displayName}</h3>

          <p>{displayEmail}</p>
        </div>

        <nav className="learner-nav-menu">
          <NavLink to="/dashboard" onClick={closeSidebar}>
            Dashboard
          </NavLink>

          <NavLink to="/assigned-courses" onClick={closeSidebar}>
            My Courses
          </NavLink>

          <NavLink to="/my-results" onClick={closeSidebar}>
            My Results
          </NavLink>

          <NavLink to="/certificates" onClick={closeSidebar}>
            Certificates
          </NavLink>

          <NavLink to="/my-learnings" onClick={closeSidebar}>
            My Learnings
          </NavLink>

          <NavLink to="/profile" onClick={closeSidebar}>
            Profile
          </NavLink>
        </nav>

        <button
          className="learner-logout"
          onClick={handleLogout}
        >
          Logout
        </button>
      </aside>

      <main className="learner-main-area">
        <Outlet />
      </main>
    </div>
  );
}

export default UserLayout;