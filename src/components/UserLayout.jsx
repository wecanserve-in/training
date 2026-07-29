import { useEffect, useState, useRef } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { loadUserProfile } from "../lib/userAccess";
import {
  watchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/doubtService";

import { FaBell, FaComments, FaReply, FaBookOpen, FaVideo, FaClock, FaTimesCircle, FaCheckCircle, FaAward } from "react-icons/fa";
import "../styles/userLayout.css";

function UserLayout() {
  const navigate = useNavigate();

  const notifDropdownRef = useRef(null);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userData, setUserData] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

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
      navigate("/assigned-courses");
    } else if (notif.courseId) {
      navigate(`/course/${notif.courseId}`);
    }
  };

  const handleMarkAllRead = async () => {
    if (!userData?.id) return;
    await markAllNotificationsRead(userData.id);
  };

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
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  };

  const recentNotifications = notifications.slice(0, 8);

  return (
    <div className={`learner-shell ${sidebarCollapsed ? "learner-sidebar-collapsed" : ""}`}>
      <div className="learner-mobile-topbar">
        <img src="/Logo.webp" alt="Logo" />
        <div className="learner-mobile-topbar-actions">
          <button className="learner-notif-bell-mobile" onClick={toggleNotifDropdown} type="button">
            <FaBell />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
        </div>
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

          <NavLink to="/notifications" onClick={closeMobileSidebar}>
            Notifications
            {unreadCount > 0 && <span className="doubt-nav-badge">{unreadCount}</span>}
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
        <div className="learner-topbar" ref={notifDropdownRef}>
          <div className="learner-topbar-spacer"></div>
          <button className="learner-notif-bell" onClick={toggleNotifDropdown} type="button">
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
                  navigate("/notifications");
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
    </div>
  );
}

export default UserLayout;
