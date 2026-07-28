import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { loadUserProfile } from "../lib/userAccess";
import {
  watchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/doubtService";
import FloatingDoubtButton from "./FloatingDoubtButton";
import "../styles/departmentadminlayout.css";

import { FaBell, FaComments, FaReply, FaBookOpen, FaVideo, FaClock, FaTimesCircle, FaCheckCircle, FaAward } from "react-icons/fa";

function DepartmentAdminLayout() {
  const navigate = useNavigate();
  const notifDropdownRef = useRef(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openTraining, setOpenTraining] = useState(false);
  const [openReports, setOpenReports] = useState(false);
  const [openMyLearning, setOpenMyLearning] = useState(false);
  const [profile, setProfile] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

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

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = watchNotifications(profile.id, (notifs) => {
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.read).length);
    });
    return () => unsub();
  }, [profile?.id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const toggleNotifDropdown = () => {
    setNotifOpen((prev) => !prev);
  };

  const handleNotifClick = async (notif) => {
    if (!profile?.id) return;
    if (!notif.read) {
      await markNotificationRead(profile.id, notif.notificationId);
    }
    setNotifOpen(false);
    if (notif.type === "course_completed") {
      navigate("/department-admin/assigned-courses");
    } else if (notif.courseId) {
      navigate(`/department-admin/course/${notif.courseId}`);
    }
  };

  const handleMarkAllRead = async () => {
    if (!profile?.id) return;
    await markAllNotificationsRead(profile.id);
  };

  const getNotificationIcon = (type) => {
    if (type === "doubt_reply") return <FaReply />;
    if (type === "doubt") return <FaComments />;
    if (type === "course_discussion") return <FaComments />;
    if (type === "course_assigned") return <FaBookOpen />;
    if (type === "new_video" || type === "course_updated") return <FaVideo />;
    if (type === "quiz_updated") return <FaClock />;
    if (type === "course_removed") return <FaTimesCircle />;
    if (type === "course_completed") return <FaCheckCircle />;
    if (type === "certificate_ready") return <FaAward />;
    return <FaBell />;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const recentNotifications = notifications.slice(0, 8);

  return (
    <div className={`dept-admin-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <div className="mobile-topbar">
        <img src="/Logo.webp" alt="Logo" />
        <div className="mobile-topbar-actions">
          <button className="notif-bell-mobile" onClick={toggleNotifDropdown} type="button">
            <FaBell />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>
          <button type="button" onClick={() => setSidebarOpen(true)}>☰</button>
        </div>
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
                <NavLink to="/department-admin/courses" onClick={closeSidebar}>Course Library</NavLink>
                <NavLink to="/department-admin/video-library" onClick={closeSidebar}>Video Library</NavLink>
                <NavLink to="/department-admin/assignments" onClick={closeSidebar}>Assign Course</NavLink>
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
                <NavLink to="/department-admin/test-logs" onClick={closeSidebar}>Test Logs</NavLink>
                <NavLink to="/department-admin/assigned-users" onClick={closeSidebar}>Assigned Users</NavLink>
                <NavLink to="/department-admin/all-certificates" onClick={closeSidebar}>Certifications</NavLink>
              </div>
            )}
          </div>

          <NavLink to="/department-admin/resources" onClick={closeSidebar}>
            <span>News & Resources</span>
          </NavLink>

          <NavLink to="/department-admin/notifications" onClick={closeSidebar}>
            <span>Notifications</span>
            {unreadCount > 0 && <span className="doubt-nav-badge">{unreadCount}</span>}
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
                <NavLink to="/department-admin/assigned-courses" onClick={closeSidebar}>My Courses</NavLink>
                <NavLink to="/department-admin/my-learnings" onClick={closeSidebar}>My Progress</NavLink>
                <NavLink to="/department-admin/my-results" onClick={closeSidebar}>My Results</NavLink>
                <NavLink to="/department-admin/certificates" onClick={closeSidebar}>Certificates</NavLink>
                <NavLink to="/department-admin/profile" onClick={closeSidebar}>Profile</NavLink>
              </div>
            )}
          </div>
        </nav>

        <button type="button" className="dept-sidebar-logout" onClick={handleLogout}>
          <span>Logout</span>
        </button>
      </aside>

      <main className="dept-admin-page" ref={notifDropdownRef}>
        <div className="page-topbar">
          <div className="page-topbar-spacer"></div>
          <button className="notif-bell" onClick={toggleNotifDropdown} type="button">
            <FaBell />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>

          {notifOpen && (
            <div className="notif-dropdown">
              <div className="notif-dropdown-header">
                <h3>Notifications</h3>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead}>Mark all read</button>
                )}
              </div>
              <div className="notif-dropdown-list">
                {recentNotifications.length === 0 ? (
                  <div className="notif-dropdown-empty">
                    <FaBell />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  recentNotifications.map((notif) => (
                    <div
                      className={`notif-dropdown-item ${!notif.read ? "unread" : ""}`}
                      key={notif.notificationId}
                      onClick={() => handleNotifClick(notif)}
                    >
                      <div className={`notif-dropdown-icon ${notif.type}`}>
                        {getNotificationIcon(notif.type)}
                      </div>
                      <div className="notif-dropdown-content">
                        <h4>{notif.title}</h4>
                        <p>{notif.message}</p>
                        <span>{formatTime(notif.createdAt)}</span>
                      </div>
                      {!notif.read && <div className="notif-dropdown-dot"></div>}
                    </div>
                  ))
                )}
              </div>
              <div
                className="notif-dropdown-footer"
                onClick={() => {
                  navigate("/department-admin/notifications");
                  setNotifOpen(false);
                }}
              >
                View all notifications
              </div>
            </div>
          )}
        </div>

        <Outlet />
      </main>

      <FloatingDoubtButton />
    </div>
  );
}

export default DepartmentAdminLayout;
