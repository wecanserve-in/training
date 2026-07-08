import { Link, Outlet, useNavigate } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useEffect, useState } from "react";
import { loadUserProfile } from "../lib/userAccess";
import "../styles/superadminlayout.css";

function AdminLayout() {
  const navigate = useNavigate();

  const [openTraining, setOpenTraining] = useState(true);
  const [openReports, setOpenReports] = useState(true);
  const [openMyLearning, setOpenMyLearning] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setCurrentUser(null);
        return;
      }

      try {
        setCurrentUser(await loadUserProfile(firebaseUser));
      } catch (error) {
        console.error("Failed to load admin profile:", error);
        setCurrentUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const closeMobileMenu = () => {
    setMobileOpen(false);
  };

  return (
    <div className="super-layout">
      <div className="mobile-topbar">
        <img src="/Logo.webp" alt="Logo" />
        <button onClick={() => setMobileOpen(true)}>☰</button>
      </div>

      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`super-sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <button className="sidebar-close" onClick={() => setMobileOpen(false)}>
          ×
        </button>

        <div className="sidebar-logo-box">
          <img src="/Logo.webp" alt="Logo" />
        </div>

        <div className="sidebar-profile">
          <div className="profile-circle">
            {(currentUser?.name || currentUser?.email || "A")
              .charAt(0)
              .toUpperCase()}
          </div>

          <h3>{currentUser?.name || currentUser?.email || "Admin"}</h3>
          <p>{currentUser?.email || "Loading..."}</p>

          <p>
            {currentUser?.designation ||
              (currentUser?.role === "admin"
                ? "Admin"
                : currentUser?.role === "superAdmin"
                  ? "Super Admin"
                  : "User")}
          </p>
        </div>

        <nav className="sidebar-menu">
          <Link to="/admin" onClick={closeMobileMenu}>
            Home
          </Link>

          <Link to="/admin/users" onClick={closeMobileMenu}>
            Users
          </Link>

          <Link to="/admin/departments" onClick={closeMobileMenu}>
            Departments
          </Link>

          <div className="sidebar-dropdown">
            <button
              type="button"
              className="dropdown-toggle"
              onClick={() => setOpenTraining(!openTraining)}
            >
              Training
            </button>

            {openTraining && (
              <div className="dropdown-submenu">
                <Link to="/admin/courses" onClick={closeMobileMenu}>
                  Courses
                </Link>

                <Link to="/admin/video-library" onClick={closeMobileMenu}>
                  Videos
                </Link>

                <Link to="/admin/assignments" onClick={closeMobileMenu}>
                  Assign Course
                </Link>
              </div>
            )}
          </div>

          <div className="sidebar-dropdown">
            <button
              type="button"
              className="dropdown-toggle"
              onClick={() => setOpenReports(!openReports)}
            >
              Reports
            </button>

            {openReports && (
              <div className="dropdown-submenu">
                <Link to="/admin/analytics" onClick={closeMobileMenu}>
                  Progress Report
                </Link>

                <Link to="/admin/assignment-analytics" onClick={closeMobileMenu}>
                  Assigned Users
                </Link>

                <Link to="/admin/results" onClick={closeMobileMenu}>
                  Test Records
                </Link>
              </div>
            )}
          </div>

          <div className="sidebar-dropdown">
            <button
              type="button"
              className="dropdown-toggle"
              onClick={() => setOpenMyLearning(!openMyLearning)}
            >
              My Courses
            </button>

            {openMyLearning && (
              <div className="dropdown-submenu">
                <Link to="/admin/assigned-courses" onClick={closeMobileMenu}>
                  Assigned Courses
                </Link>

                <Link to="/admin/my-learnings" onClick={closeMobileMenu}>
                  My Progress
                </Link>

                <Link to="/admin/my-results" onClick={closeMobileMenu}>
                  My Test Results
                </Link>

                <Link to="/admin/certificates" onClick={closeMobileMenu}>
                  My Certificates
                </Link>

                <Link to="/admin/profile" onClick={closeMobileMenu}>
                  My Profile
                </Link>
              </div>
            )}
          </div>
        </nav>

        <button className="sidebar-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="super-page">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;