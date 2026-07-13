import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { loadUserProfile } from "../lib/userAccess";
import "../styles/departmentadminlayout.css";

function DepartmentAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openLearning, setOpenLearning] = useState(false);
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

  const initials = useMemo(() => {
    const name = profile?.name || profile?.email || "DA";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [profile]);

  const menuItems = [
    { label: "Dashboard", path: "/department-admin" },
    { label: "Course Library", path: "/department-admin/courses" },
    { label: "Video Library", path: "/department-admin/video-library" },
    { label: "Assigned Users", path: "/department-admin/assigned-users" },
    { label: "Assign Course", path: "/department-admin/assignments" },
  ];

  const learningItems = [
    { label: "My Learnings", path: "/department-admin/my-learnings" },
    { label: "My Courses", path: "/department-admin/assigned-courses" },
    { label: "My Results", path: "/department-admin/my-results" },
    { label: "Certificates", path: "/department-admin/certificates" },
    { label: "Profile", path: "/department-admin/profile" },
  ];

  const isActive = (path) => {
    if (path === "/department-admin") {
      return location.pathname === "/department-admin";
    }
    return location.pathname === path;
  };

  const closeSidebar = () => setSidebarOpen(false);
  const toggleCollapse = () => setSidebarCollapsed((prev) => !prev);

  return (
    <div className={`department-admin-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <div className="mobile-topbar">
        <img src="/Logo.webp" alt="Logo" />
        <button type="button" onClick={() => setSidebarOpen(true)}>☰</button>
      </div>

      {sidebarOpen && <div className="dept-sidebar-overlay" onClick={closeSidebar} />}

      <aside className={`dept-admin-sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <button className="dept-sidebar-close" onClick={closeSidebar}>×</button>

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
          <div className="dept-profile-circle">{initials}</div>
          <div className="dept-sidebar-profile-text">
            <h3>{profile?.name || "Department Admin"}</h3>
            <p>{profile?.department || profile?.departmentType || "Dept Admin"}</p>
          </div>
        </div>

        <nav className="dept-sidebar-menu">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={closeSidebar}
              className={isActive(item.path) ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}

          <div className="dept-sidebar-dropdown">
            <button
              type="button"
              className={`dept-dropdown-toggle ${openLearning ? "active" : ""}`}
              onClick={() => setOpenLearning(!openLearning)}
            >
              <span>My Learnings</span>
              <span className="dept-dropdown-arrow">{openLearning ? "▴" : "▾"}</span>
            </button>

            {openLearning && (
              <div className="dept-dropdown-submenu">
                {learningItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={closeSidebar}
                    className={isActive(item.path) ? "active" : ""}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <button className="dept-sidebar-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="dept-admin-page">
        <Outlet />
      </main>
    </div>
  );
}

export default DepartmentAdminLayout;
