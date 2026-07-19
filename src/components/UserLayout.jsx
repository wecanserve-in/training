import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { loadUserProfile } from "../lib/userAccess";
import "../styles/userLayout.css";

function UserLayout() {
  const navigate = useNavigate();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (!currentUser) {
          setUserData(null);
          navigate("/");
          return;
        }

        const profile = await loadUserProfile(currentUser);
        setUserData(profile);
      } catch (error) {
        console.error("Failed to load user profile:", error);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false);
  };

  const toggleCollapse = () => {
    setSidebarCollapsed((prev) => !prev);
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

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className={`learner-shell ${sidebarCollapsed ? "learner-sidebar-collapsed" : ""}`}>
      <div className="learner-mobile-topbar">
        <img src="/Logo.webp" alt="Logo" />
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open menu"
        >
          ☰
        </button>
      </div>

      {mobileSidebarOpen && (
        <div
          className="learner-sidebar-backdrop"
          onClick={closeMobileSidebar}
        />
      )}

      <aside
        className={`learner-side-nav ${
          mobileSidebarOpen ? "sidebar-open" : ""
        }`}
      >
        <button
          className="learner-sidebar-close"
          onClick={closeMobileSidebar}
          type="button"
          aria-label="Close menu"
        >
          ×
        </button>

        <div className="learner-sidebar-top">
          <div className="learner-logo-box">
            <img src="/Logo.webp" alt="Logo" />
          </div>
          <button
            type="button"
            className="learner-sidebar-collapse-btn"
            onClick={toggleCollapse}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>

        <div className="learner-sidebar-profile">
          <div className="learner-profile-circle">{initials}</div>
          <div className="learner-sidebar-profile-text">
            <h3>{displayName}</h3>
            <p>{displayEmail}</p>
          </div>
        </div>

        <nav className="learner-nav-menu">
          <NavLink to="/dashboard" onClick={closeMobileSidebar}>
            Dashboard
          </NavLink>

          <NavLink to="/assigned-courses" onClick={closeMobileSidebar}>
            My Courses
          </NavLink>

          <NavLink to="/my-results" onClick={closeMobileSidebar}>
            My Results
          </NavLink>

          <NavLink to="/certificates" onClick={closeMobileSidebar}>
            Certificates
          </NavLink>

             <NavLink to="/resources" onClick={closeMobileSidebar}>
            News & Resources
          </NavLink>

          <NavLink to="/my-learnings" onClick={closeMobileSidebar}>
            My Learnings
          </NavLink>

       

          <NavLink to="/profile" onClick={closeMobileSidebar}>
            Profile
          </NavLink>
        </nav>

        <button
          className="learner-logout"
          onClick={handleLogout}
          type="button"
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
