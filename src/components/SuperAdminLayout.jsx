import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { loadUserProfile } from "../lib/userAccess";
import "../styles/superadminlayout.css";

function SuperAdminLayout() {
  const navigate = useNavigate();

  const [openTraining, setOpenTraining] = useState(false);
  const [openReports, setOpenReports] = useState(false);
  const [openMyLearning, setOpenMyLearning] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userData, setUserData] = useState(null);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const closeMobileMenu = () => {
    setMobileOpen(false);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const getInitials = () => {
    if (userData?.name) {
      return userData.name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
    }

    return "SA";
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserData(null);
        navigate("/");
        return;
      }

      try {
        setUserData(await loadUserProfile(user));
      } catch (error) {
        console.error("Failed to load super admin profile:", error);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  return (
    <div className={`super-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <div className="mobile-topbar">
        <img src="/Logo.webp" alt="Logo" />
        <button type="button" onClick={() => setMobileOpen(true)}>
          ☰
        </button>
      </div>

      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={closeMobileMenu} />
      )}

      <aside className={`super-sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <button type="button" className="sidebar-close" onClick={closeMobileMenu}>
          ×
        </button>

        <div className="sidebar-top">
          <div className="sidebar-logo-box">
            <img src="/Logo.webp" alt="Logo" />
          </div>

          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>

        <div className="sidebar-profile">
          <div className="profile-circle">{getInitials()}</div>

          <div className="profile-text">
            <h3>{userData?.name || "Super Admin"}</h3>
            <p>{userData?.email || auth.currentUser?.email}</p>
          </div>
        </div>

        <nav className="sidebar-menu">
          <NavLink to="/super-admin" end onClick={closeMobileMenu}>
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/super-admin/users" onClick={closeMobileMenu}>
            <span>Users</span>
          </NavLink>

          <NavLink to="/super-admin/admins" onClick={closeMobileMenu}>
            <span>Admins</span>
          </NavLink>

          <NavLink to="/super-admin/departments" onClick={closeMobileMenu}>
            <span>Departments</span>
          </NavLink>

          <div className="sidebar-dropdown">
            <button
              type="button"
              className={`dropdown-toggle ${openTraining ? "active-dropdown" : ""}`}
              onClick={() => setOpenTraining((prev) => !prev)}
            >
              <span>Training</span>
              <span className="dropdown-arrow">{openTraining ? "▾" : "›"}</span>
            </button>

            {openTraining && (
              <div className="dropdown-submenu">
                <NavLink to="/super-admin/courses" onClick={closeMobileMenu}>
                  Course Library
                </NavLink>

                <NavLink to="/super-admin/video-library" onClick={closeMobileMenu}>
                  Video Library
                </NavLink>

                <NavLink to="/super-admin/assignments" onClick={closeMobileMenu}>
                  Assign Course
                </NavLink>
              </div>
            )}
          </div>

          <div className="sidebar-dropdown">
            <button
              type="button"
              className={`dropdown-toggle ${openReports ? "active-dropdown" : ""}`}
              onClick={() => setOpenReports((prev) => !prev)}
            >
              <span>Reports</span>
              <span className="dropdown-arrow">{openReports ? "▾" : "›"}</span>
            </button>

            {openReports && (
              <div className="dropdown-submenu">
                <NavLink to="/super-admin/analytics" onClick={closeMobileMenu}>
                  Progress Report
                </NavLink>

                <NavLink
                  to="/super-admin/assigned-users"
                  onClick={closeMobileMenu}
                >
                  Assigned Users
                </NavLink>

                <NavLink to="/super-admin/results" onClick={closeMobileMenu}>
                  Test Records
                </NavLink>
              </div>
            )}
          </div>

          <div className="sidebar-dropdown">
            <button
              type="button"
              className={`dropdown-toggle ${
                openMyLearning ? "active-dropdown" : ""
              }`}
              onClick={() => setOpenMyLearning((prev) => !prev)}
            >
              <span>My Courses</span>
              <span className="dropdown-arrow">
                {openMyLearning ? "▾" : "›"}
              </span>
            </button>

            {openMyLearning && (
              <div className="dropdown-submenu">
                <NavLink to="/super-admin/assigned-courses" onClick={closeMobileMenu}>
                  Assigned Courses
                </NavLink>

                <NavLink to="/super-admin/my-learnings" onClick={closeMobileMenu}>
                  My Progress
                </NavLink>

                <NavLink to="/super-admin/my-results" onClick={closeMobileMenu}>
                  My Test Results
                </NavLink>

                <NavLink to="/super-admin/certificates" onClick={closeMobileMenu}>
                  My Certificates
                </NavLink>

                <NavLink to="/super-admin/profile" onClick={closeMobileMenu}>
                  My Profile
                </NavLink>
              </div>
            )}
          </div>
        </nav>

        <button type="button" className="sidebar-logout" onClick={handleLogout}>
          <span>Logout</span>
        </button>
      </aside>

      <main className="super-page">
        <Outlet />
      </main>
    </div>
  );
}

export default SuperAdminLayout;