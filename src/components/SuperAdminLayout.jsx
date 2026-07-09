import { Link, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { loadUserProfile } from "../lib/userAccess";
import "../styles/superadminlayout.css";

function SuperAdminLayout() {
  const navigate = useNavigate();

  const [openLearning, setOpenLearning] = useState(false);
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          setUserData(await loadUserProfile(user));
        } catch (error) {
          console.error("Failed to load super admin profile:", error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className={`super-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <div className="mobile-topbar">
        <img src="/Logo.webp" alt="Logo" />
        <button onClick={() => setMobileOpen(true)}>☰</button>
      </div>

      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}

<button
  className={`desktop-sidebar-toggle ${sidebarCollapsed ? "is-hidden" : ""}`}
  onClick={toggleSidebar}
>
  {sidebarCollapsed ? "›" : "‹"}
</button>

<aside
  className={`super-sidebar ${
    mobileOpen ? "sidebar-open" : ""
  } ${sidebarCollapsed ? "sidebar-hidden" : ""}`}
>
        <button className="sidebar-close" onClick={() => setMobileOpen(false)}>
          ×
        </button>

    
        <div className="sidebar-logo-box">
          <img src="/Logo.webp" alt="Logo" />
        </div>

        <div className="sidebar-profile">
          <div className="profile-circle">
            {userData?.name
              ? userData.name
                  .split(" ")
                  .map((word) => word[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase()
              : "SA"}
          </div>

          <h3>{userData?.name || "Super Admin"}</h3>
          <p>{userData?.email || auth.currentUser?.email}</p>
        </div>

        <nav className="sidebar-menu">
          <Link to="/super-admin" onClick={closeMobileMenu}>
            <span>Dashboard</span>
          </Link>

          <Link to="/super-admin/users" onClick={closeMobileMenu}>
            <span>Add Users</span>
          </Link>

          <Link to="/super-admin/admins" onClick={closeMobileMenu}>
            <span>Admins</span>
          </Link>

          <Link to="/super-admin/departments" onClick={closeMobileMenu}>
            <span>Departments</span>
          </Link>

          <Link to="/super-admin/analytics" onClick={closeMobileMenu}>
            <span>Analytics</span>
          </Link>

          <div className="sidebar-dropdown">
            <button
              type="button"
              className="dropdown-toggle"
              onClick={() => setOpenLearning(!openLearning)}
            >
              <span>My Learnings</span>
            </button>

            {openLearning && (
              <div className="dropdown-submenu">
                <Link to="/super-admin/my-learnings" onClick={closeMobileMenu}>
                  My Learnings
                </Link>
                <Link to="/super-admin/assigned-courses" onClick={closeMobileMenu}>
                  Assigned Courses
                </Link>
                <Link to="/super-admin/my-results" onClick={closeMobileMenu}>
                  My Results
                </Link>
                <Link to="/super-admin/certificates" onClick={closeMobileMenu}>
                  Certificates
                </Link>
                <Link to="/super-admin/profile" onClick={closeMobileMenu}>
                  Profile
                </Link>
              </div>
            )}
          </div>
        </nav>

        <button className="sidebar-logout" onClick={handleLogout}>
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