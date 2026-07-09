import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { loadUserProfile } from "../lib/userAccess";
import "../styles/userLayout.css";

function UserLayout() {
  const navigate = useNavigate();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarHidden, setDesktopSidebarHidden] = useState(false);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (!currentUser) {
          setUserData(null);
          return;
        }

        const profile = await loadUserProfile(currentUser);
        setUserData(profile);
      } catch (error) {
        console.error("Failed to load user profile:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false);
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
    <div
      className={`learner-shell ${
        desktopSidebarHidden ? "learner-sidebar-collapsed" : ""
      }`}
    >
      <button
        className={`learner-desktop-sidebar-toggle ${
          desktopSidebarHidden ? "is-hidden" : ""
        }`}
        onClick={() => setDesktopSidebarHidden((prev) => !prev)}
        type="button"
        aria-label="Toggle sidebar"
      >
        {desktopSidebarHidden ? "›" : "‹"}
      </button>

      <div className="learner-mobile-topbar">
        <img src="/Logo.webp" alt="Zuvius Logo" />

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
        } ${desktopSidebarHidden ? "sidebar-hidden" : ""}`}
      >
        <button
          className="learner-sidebar-close"
          onClick={closeMobileSidebar}
          type="button"
          aria-label="Close menu"
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