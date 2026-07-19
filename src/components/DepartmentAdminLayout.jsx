import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { loadUserProfile } from "../lib/userAccess";
import "../styles/departmentadminlayout.css";

function DepartmentAdminLayout() {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openTraining, setOpenTraining] = useState(false);
  const [openReports, setOpenReports] = useState(false);
  const [openMyLearning, setOpenMyLearning] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) {
        navigate("/");
        return;
      }

      try {
        setProfile(await loadUserProfile(loggedUser));
      } catch (error) {
        console.error("Failed to load department admin profile:", error);
        setProfile(null);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const closeSidebar = () => setSidebarOpen(false);
  const toggleCollapse = () => setSidebarCollapsed((prev) => !prev);

  const getInitials = () => {
    const name = profile?.name || profile?.email || "DA";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className={`dept-admin-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <div className="mobile-topbar">
        <img src="/Logo.webp" alt="Logo" />
        <button type="button" onClick={() => setSidebarOpen(true)}>☰</button>
      </div>

      {sidebarOpen && <div className="dept-sidebar-backdrop" onClick={closeSidebar} />}

      <aside className={`dept-sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <button type="button" className="dept-sidebar-close" onClick={closeSidebar}>×</button>

        <div className="dept-sidebar-top">
          <div className="dept-sidebar-logo-box">
            <img src="/Logo.webp" alt="Logo" />
          </div>
          <button
            type="button"
            className="dept-sidebar-collapse-btn"
            onClick={toggleCollapse}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>

        <div className="dept-sidebar-profile">
          <div className="dept-profile-circle">{getInitials()}</div>
          <div className="dept-profile-text">
            <h3>{profile?.name || "Department Admin"}</h3>
            <p>{profile?.department || profile?.departmentType || "Dept Admin"}</p>
          </div>
        </div>

        <nav className="dept-sidebar-menu">
          <NavLink to="/department-admin" end onClick={closeSidebar}>
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/department-admin/members" onClick={closeSidebar}>
            <span>Members</span>
          </NavLink>

          <div className="dept-sidebar-dropdown">
            <button
              type="button"
              className={`dept-dropdown-toggle ${openTraining ? "active-dropdown" : ""}`}
              onClick={() => setOpenTraining((prev) => !prev)}
            >
              <span>Training</span>
              <span className="dept-dropdown-arrow">{openTraining ? "▾" : "›"}</span>
            </button>

            {openTraining && (
              <div className="dept-dropdown-submenu">
                <NavLink to="/department-admin/courses" onClick={closeSidebar}>
                  Course Library
                </NavLink>
                <NavLink to="/department-admin/video-library" onClick={closeSidebar}>
                  Video Library
                </NavLink>
                <NavLink to="/department-admin/assignments" onClick={closeSidebar}>
                  Assign Course
                </NavLink>
              </div>
            )}
          </div>

          <div className="dept-sidebar-dropdown">
            <button
              type="button"
              className={`dept-dropdown-toggle ${openReports ? "active-dropdown" : ""}`}
              onClick={() => setOpenReports((prev) => !prev)}
            >
              <span>Reports</span>
              <span className="dept-dropdown-arrow">{openReports ? "▾" : "›"}</span>
            </button>

            {openReports && (
              <div className="dept-dropdown-submenu">
                <NavLink to="/department-admin/analytics" onClick={closeSidebar}>
                  Training Analytics
                </NavLink>
                <NavLink to="/department-admin/assigned-users" onClick={closeSidebar}>
                  Assigned Users
                </NavLink>
              </div>
            )}
          </div>

          <NavLink to="/department-admin/resources" onClick={closeSidebar}>
            <span>News & Resources</span>
          </NavLink>

          <div className="dept-sidebar-dropdown">
            <button
              type="button"
              className={`dept-dropdown-toggle ${openMyLearning ? "active-dropdown" : ""}`}
              onClick={() => setOpenMyLearning((prev) => !prev)}
            >
              <span>My Learning</span>
              <span className="dept-dropdown-arrow">{openMyLearning ? "▾" : "›"}</span>
            </button>

            {openMyLearning && (
              <div className="dept-dropdown-submenu">
                <NavLink to="/department-admin/assigned-courses" onClick={closeSidebar}>
                  My Courses
                </NavLink>
                <NavLink to="/department-admin/my-learnings" onClick={closeSidebar}>
                  My Progress
                </NavLink>
                <NavLink to="/department-admin/my-results" onClick={closeSidebar}>
                  My Results
                </NavLink>
                <NavLink to="/department-admin/certificates" onClick={closeSidebar}>
                  Certificates
                </NavLink>
                <NavLink to="/department-admin/profile" onClick={closeSidebar}>
                  Profile
                </NavLink>
              </div>
            )}
          </div>
        </nav>

        <button type="button" className="dept-sidebar-logout" onClick={handleLogout}>
          <span>Logout</span>
        </button>
      </aside>

      <main className="dept-admin-page">
        <Outlet />
      </main>
    </div>
  );
}

export default DepartmentAdminLayout;
