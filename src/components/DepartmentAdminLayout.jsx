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
  const [openLearning, setOpenLearning] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) return;

      try {
        setProfile(await loadUserProfile(loggedUser));
      } catch (error) {
        console.error("Failed to load department admin profile:", error);
        setProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const initials = useMemo(() => {
    const name = profile?.name || profile?.email || "Department Admin";
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
    { label: "Assigned Users", path: "/department-admin/members" },
    { label: "Assign Course", path: "/department-admin/assignments" },
    // { label: "Reports", path: "/department-admin/analytics" },
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

  return (
    <div className="department-admin-layout">
      <button className="dept-mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
        ☰
      </button>

      {sidebarOpen && <div className="dept-sidebar-overlay" onClick={closeSidebar}></div>}

      <aside className={`dept-admin-sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <button className="dept-sidebar-close" onClick={closeSidebar}>
          ×
        </button>

        <div className="dept-sidebar-logo-box">
          <img src="/Logo.webp" alt="Logo" />
        </div>

        <div className="dept-sidebar-profile">
          <div className="dept-profile-circle">{initials}</div>
          <h3>{profile?.name || "Department Admin"}</h3>
          <p>{profile?.department || profile?.departmentType || "Department Training Lead"}</p>
          {profile?.email && <small>{profile.email}</small>}
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
              My Learnings
              <span>{openLearning ? "▴" : "▾"}</span>
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