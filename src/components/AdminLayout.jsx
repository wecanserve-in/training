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

import "../styles/superadminlayout.css";

import { FaBell, FaComments, FaReply, FaBookOpen, FaVideo, FaClock, FaTimesCircle, FaCheckCircle, FaAward } from "react-icons/fa";
import ProfileCompletionBadge from "./ProfileCompletionBadge";

function AdminLayout() {
  const navigate = useNavigate();
  const notifDropdownRef = useRef(null);

  const [openTraining, setOpenTraining] = useState(false);
  const [openReports, setOpenReports] = useState(false);
  const [openMyLearning, setOpenMyLearning] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userData, setUserData] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

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
    return "A";
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
        console.error("Failed to load admin profile:", error);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!userData?.id) return;
    const unsub = watchNotifications(userData.id, (notifs) => {
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.read).length);
    });
    return () => unsub();
  }, [userData?.id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleNotifDropdown = () => {
    setNotifOpen((prev) => !prev);
  };

  const handleNotifClick = async (notif) => {
    if (!userData?.id) return;
    if (!notif.read) {
      await markNotificationRead(userData.id, notif.notificationId);
    }
    setNotifOpen(false);
    if (notif.type === "course_completed") {
      navigate("/admin/assigned-courses");
    } else if (notif.courseId) {
      navigate(`/admin/course/${notif.courseId}`);
    }
  };

  const handleMarkAllRead = async () => {
    if (!userData?.id) return;
    await markAllNotificationsRead(userData.id);
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
    <div className={`super-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <div className="mobile-topbar">
        <img src="/Logo.webp" alt="Logo" />
        <div className="mobile-topbar-actions">
          <button className="notif-bell-mobile" onClick={toggleNotifDropdown} type="button">
            <FaBell />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation menu">☰</button>
        </div>
      </div>

      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={closeMobileMenu} />
      )}

      <aside className={`super-sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <button type="button" className="sidebar-close" onClick={closeMobileMenu} aria-label="Close navigation menu">×</button>

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
          <div className="profile-circle">
            {userData?.photoURL ? (
              <img src={userData.photoURL} alt={userData?.name} className="profile-circle-img" />
            ) : (
              getInitials()
            )}
          </div>
          <div className="profile-text">
            <h3>{userData?.name || "Admin"}</h3>
            <p>{userData?.email || auth.currentUser?.email}</p>
          </div>
        </div>

        <nav className="sidebar-menu">
          <NavLink to="/admin" end onClick={closeMobileMenu}>
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/admin/users" onClick={closeMobileMenu}>
            <span>Users</span>
          </NavLink>

          <NavLink to="/admin/departments" onClick={closeMobileMenu}>
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
                <NavLink to="/admin/courses" onClick={closeMobileMenu}>Courses</NavLink>
                <NavLink to="/admin/video-library" onClick={closeMobileMenu}>Videos</NavLink>
                <NavLink to="/admin/assignments" onClick={closeMobileMenu}>Assign Course</NavLink>
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
                <NavLink to="/admin/analytics" onClick={closeMobileMenu}>Progress Report</NavLink>
                <NavLink to="/admin/assigned-users" onClick={closeMobileMenu}>Assigned Users</NavLink>
                <NavLink to="/admin/results" onClick={closeMobileMenu}>Test Records</NavLink>
                <NavLink to="/admin/all-certificates" onClick={closeMobileMenu}>Certifications</NavLink>
              </div>
            )}
          </div>

          <NavLink to="/admin/resources" onClick={closeMobileMenu} className="sidebar-top-link">
            News & Resources
          </NavLink>

          <NavLink to="/admin/notifications" onClick={closeMobileMenu} className="sidebar-top-link">
            <span>Notifications</span>
            {unreadCount > 0 && <span className="doubt-nav-badge">{unreadCount}</span>}
          </NavLink>

          <div className="sidebar-dropdown">
            <button
              type="button"
              className={`dropdown-toggle ${openMyLearning ? "active-dropdown" : ""}`}
              onClick={() => setOpenMyLearning((prev) => !prev)}
            >
              <span>My Courses</span>
              <span className="dropdown-arrow">{openMyLearning ? "▾" : "›"}</span>
            </button>
            {openMyLearning && (
              <div className="dropdown-submenu">
                <NavLink to="/admin/assigned-courses" onClick={closeMobileMenu}>Assigned Courses</NavLink>
                <NavLink to="/admin/my-learnings" onClick={closeMobileMenu}>My Progress</NavLink>
                <NavLink to="/admin/my-results" onClick={closeMobileMenu}>My Test Results</NavLink>
                <NavLink to="/admin/certificates" onClick={closeMobileMenu}>My Certificates</NavLink>
                <NavLink to="/admin/profile" onClick={closeMobileMenu}>My Profile</NavLink>
              </div>
            )}
          </div>
        </nav>

        <button type="button" className="sidebar-logout" onClick={handleLogout}>
          <span>Logout</span>
        </button>
      </aside>

      <main className="super-page" ref={notifDropdownRef}>
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
                  navigate("/admin/notifications");
                  setNotifOpen(false);
                }}
              >
                View all notifications
              </div>
            </div>
          )}
        </div>

        <Outlet />
        <ProfileCompletionBadge profileData={userData} profilePath="/admin/profile" />
      </main>
    </div>
  );
}

export default AdminLayout;
