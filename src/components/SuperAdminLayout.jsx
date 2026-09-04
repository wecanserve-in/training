import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
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

import {
  FaBell,
  FaComments,
  FaReply,
  FaBookOpen,
  FaVideo,
  FaClock,
  FaTimesCircle,
  FaCheckCircle,
  FaAward,
} from "react-icons/fa";

import ProfileCompletionBadge from "./ProfileCompletionBadge";

function SuperAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Desktop + mobile notification refs
  const notifDropdownRef = useRef(null);
  const mobileNotifDropdownRef = useRef(null);

  const [openTraining, setOpenTraining] = useState(false);
  const [openReports, setOpenReports] = useState(false);
  const [openMyLearning, setOpenMyLearning] = useState(false);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [userData, setUserData] = useState(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

  /* =========================================================
     LOGOUT
     ========================================================= */

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  /* =========================================================
     MOBILE MENU
     ========================================================= */

  const closeMobileMenu = () => {
    setMobileOpen(false);
  };

  /* =========================================================
     SIDEBAR
     ========================================================= */

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  /* =========================================================
     USER INITIALS
     ========================================================= */

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

  /* =========================================================
     AUTH + PROFILE
     ========================================================= */

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

  /* =========================================================
     NOTIFICATIONS LISTENER
     ========================================================= */

  useEffect(() => {
    if (!userData?.id) return;

    const unsub = watchNotifications(userData.id, (notifs) => {
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.read).length);
    });

    return () => unsub();
  }, [userData?.id]);

  /* =========================================================
     PROFILE UPDATED EVENT
     ========================================================= */

  useEffect(() => {
    const handleProfileUpdated = (e) => {
      setUserData((prev) => ({
        ...prev,
        ...e.detail,
      }));
    };

    window.addEventListener("profile-updated", handleProfileUpdated);

    return () => {
      window.removeEventListener(
        "profile-updated",
        handleProfileUpdated
      );
    };
  }, []);

  /* =========================================================
     CLOSE NOTIFICATION WHEN CLICKING OUTSIDE
     IMPORTANT:
     Works for BOTH desktop and mobile.
     ========================================================= */

  useEffect(() => {
    const handleClickOutside = (e) => {
      const clickedDesktopArea =
        notifDropdownRef.current?.contains(e.target);

      const clickedMobileArea =
        mobileNotifDropdownRef.current?.contains(e.target);

      if (!clickedDesktopArea && !clickedMobileArea) {
        setNotifOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  /* =========================================================
     TOGGLE NOTIFICATIONS
     ========================================================= */

  const toggleNotifDropdown = () => {
    setNotifOpen((prev) => !prev);
  };

  /* =========================================================
     NOTIFICATION CLICK
     ========================================================= */

  const handleNotifClick = async (notif) => {
    if (!userData?.id) return;

    if (!notif.read) {
      await markNotificationRead(
        userData.id,
        notif.notificationId
      );
    }

    setNotifOpen(false);

    if (notif.type === "course_completed") {
      navigate("/super-admin/assigned-courses");
    } else if (notif.courseId) {
      navigate(`/super-admin/course/${notif.courseId}`);
    }
  };

  /* =========================================================
     MARK ALL READ
     ========================================================= */

  const handleMarkAllRead = async () => {
    if (!userData?.id) return;

    await markAllNotificationsRead(userData.id);
  };

  /* =========================================================
     NOTIFICATION ICON
     ========================================================= */

  const getNotificationIcon = (type) => {
    if (type === "doubt_reply") return <FaReply />;
    if (type === "doubt") return <FaComments />;
    if (type === "course_discussion") return <FaComments />;
    if (type === "course_assigned") return <FaBookOpen />;
    if (type === "new_video" || type === "course_updated") {
      return <FaVideo />;
    }
    if (type === "quiz_updated") return <FaClock />;
    if (type === "course_removed") return <FaTimesCircle />;
    if (type === "course_completed") return <FaCheckCircle />;
    if (type === "certificate_ready") return <FaAward />;

    return <FaBell />;
  };

  /* =========================================================
     FORMAT NOTIFICATION TIME
     ========================================================= */

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

  /* =========================================================
     NOTIFICATION DROPDOWN CONTENT
     Reusable JSX function
     ========================================================= */

  const notificationDropdown = (
    <div className="notif-dropdown-content-wrapper">
      <div className="notif-dropdown-header">
        <h3>Notifications</h3>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
          >
            Mark all read
          </button>
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
              className={`notif-dropdown-item ${
                !notif.read ? "unread" : ""
              }`}
              key={notif.notificationId}
              onClick={() => handleNotifClick(notif)}
            >
              <div
                className={`notif-dropdown-icon ${notif.type}`}
              >
                {getNotificationIcon(notif.type)}
              </div>

              <div className="notif-dropdown-content">
                <h4>{notif.title}</h4>

                <p>{notif.message}</p>

                <span>
                  {formatTime(notif.createdAt)}
                </span>
              </div>

              {!notif.read && (
                <div className="notif-dropdown-dot"></div>
              )}
            </div>
          ))
        )}
      </div>

      <div
        className="notif-dropdown-footer"
        onClick={() => {
          navigate("/super-admin/notifications");
          setNotifOpen(false);
        }}
      >
        View all notifications
      </div>
    </div>
  );

  /* =========================================================
     RETURN
     ========================================================= */

  return (
    <div
      className={`super-layout ${
        sidebarCollapsed ? "sidebar-collapsed" : ""
      }`}
    >

      {/* =====================================================
          MOBILE TOPBAR + MOBILE NOTIFICATION
          ===================================================== */}

      <div
        className="mobile-notification-wrapper"
        ref={mobileNotifDropdownRef}
      >
        <div className="mobile-topbar">

          <img
            src="/Logo.webp"
            alt="Logo"
          />

          <div className="mobile-topbar-actions">

            {/* MOBILE NOTIFICATION BUTTON */}
            <button
              className="notif-bell-mobile"
              onClick={toggleNotifDropdown}
              type="button"
              aria-label="Notifications"
            >
              <FaBell />

              {unreadCount > 0 && (
                <span className="notif-badge">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* MOBILE MENU BUTTON */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              ☰
            </button>

          </div>
        </div>

        {/* =================================================
            MOBILE NOTIFICATION POPUP

            IMPORTANT:
            This is OUTSIDE .page-topbar.
            Therefore it remains visible on mobile.
            ================================================= */}

        {notifOpen && (
          <div className="notif-dropdown mobile-notif-dropdown">
            {notificationDropdown}
          </div>
        )}
      </div>

      {/* =====================================================
          MOBILE SIDEBAR BACKDROP
          ===================================================== */}

      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={closeMobileMenu}
        />
      )}

      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <aside
        className={`super-sidebar ${
          mobileOpen ? "sidebar-open" : ""
        }`}
      >

        {/* MOBILE CLOSE */}
        <button
          type="button"
          className="sidebar-close"
          onClick={closeMobileMenu}
          aria-label="Close navigation menu"
        >
          ×
        </button>

        {/* SIDEBAR TOP */}
        <div className="sidebar-top">

          <div className="sidebar-logo-box">
            <img
              src="/Logo.webp"
              alt="Logo"
            />
          </div>

          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={toggleSidebar}
            title={
              sidebarCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>

        </div>

        {/* PROFILE */}
        <div
          className="sidebar-profile"
          onClick={() => navigate("profile")}
          style={{ cursor: "pointer" }}
        >
          <div className="profile-circle">

            {userData?.photoURL ? (
              <img
                src={userData.photoURL}
                alt={userData?.name}
                className="profile-circle-img"
              />
            ) : (
              getInitials()
            )}

          </div>

          <div className="profile-text">
            <h3>
              {userData?.name || "Super Admin"}
            </h3>

            <p>
              {userData?.email ||
                auth.currentUser?.email}
            </p>
          </div>
        </div>

        {/* =================================================
            SIDEBAR MENU
            ================================================= */}

        <nav className="sidebar-menu">

          <NavLink
            to="/super-admin"
            end
            onClick={closeMobileMenu}
          >
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/super-admin/admins"
            onClick={closeMobileMenu}
          >
            <span>Admins</span>
          </NavLink>

          <NavLink
            to="/super-admin/departments"
            onClick={closeMobileMenu}
          >
            <span>Department Admin</span>
          </NavLink>

          <NavLink
            to="/super-admin/users"
            onClick={closeMobileMenu}
          >
            <span>Users</span>
          </NavLink>

          {/* TRAINING */}
          <div className="sidebar-dropdown">

            <button
              type="button"
              className={`dropdown-toggle ${
                openTraining
                  ? "active-dropdown"
                  : ""
              }`}
              onClick={() =>
                setOpenTraining((prev) => !prev)
              }
            >
              <span>Training</span>

              <span className="dropdown-arrow">
                {openTraining ? "▾" : "›"}
              </span>
            </button>

            {openTraining && (
              <div className="dropdown-submenu">

                <NavLink
                  to="/super-admin/courses"
                  onClick={closeMobileMenu}
                >
                  Course Library
                </NavLink>

                <NavLink
                  to="/super-admin/video-library"
                  onClick={closeMobileMenu}
                >
                  Video Library
                </NavLink>

                <NavLink
                  to="/super-admin/assignments"
                  onClick={closeMobileMenu}
                >
                  Assign Course
                </NavLink>

              </div>
            )}

          </div>

          {/* REPORTS */}
          <div className="sidebar-dropdown">

            <button
              type="button"
              className={`dropdown-toggle ${
                openReports
                  ? "active-dropdown"
                  : ""
              }`}
              onClick={() =>
                setOpenReports((prev) => !prev)
              }
            >
              <span>Reports</span>

              <span className="dropdown-arrow">
                {openReports ? "▾" : "›"}
              </span>
            </button>

            {openReports && (
              <div className="dropdown-submenu">

                <NavLink
                  to="/super-admin/analytics"
                  onClick={closeMobileMenu}
                >
                  Progress Report
                </NavLink>

                <NavLink
                  to="/super-admin/assigned-users"
                  onClick={closeMobileMenu}
                >
                  Assigned Users
                </NavLink>

                <NavLink
                  to="/super-admin/results"
                  onClick={closeMobileMenu}
                >
                  Test Records
                </NavLink>

                <NavLink
                  to="/super-admin/all-certificates"
                  onClick={closeMobileMenu}
                >
                  Certifications
                </NavLink>

              </div>
            )}

          </div>

          {/* NEWS */}
          <NavLink
            to="/super-admin/resources"
            onClick={closeMobileMenu}
            className="sidebar-top-link"
          >
            News & Resources
          </NavLink>

          {/* NOTIFICATIONS */}
          <NavLink
            to="/super-admin/notifications"
            onClick={closeMobileMenu}
            className="sidebar-top-link"
          >
            <span>Notifications</span>

            {unreadCount > 0 && (
              <span className="doubt-nav-badge">
                {unreadCount}
              </span>
            )}
          </NavLink>

          {/* MY COURSES */}
          <div className="sidebar-dropdown">

            <button
              type="button"
              className={`dropdown-toggle ${
                openMyLearning
                  ? "active-dropdown"
                  : ""
              }`}
              onClick={() =>
                setOpenMyLearning((prev) => !prev)
              }
            >
              <span>My Courses</span>

              <span className="dropdown-arrow">
                {openMyLearning ? "▾" : "›"}
              </span>
            </button>

            {openMyLearning && (
              <div className="dropdown-submenu">

                <NavLink
                  to="/super-admin/assigned-courses"
                  onClick={closeMobileMenu}
                >
                  Assigned Courses
                </NavLink>

                <NavLink
                  to="/super-admin/my-learnings"
                  onClick={closeMobileMenu}
                >
                  My Progress
                </NavLink>

                <NavLink
                  to="/super-admin/my-results"
                  onClick={closeMobileMenu}
                >
                  My Test Results
                </NavLink>

                <NavLink
                  to="/super-admin/certificates"
                  onClick={closeMobileMenu}
                >
                  My Certificates
                </NavLink>

                <NavLink
                  to="/super-admin/profile"
                  onClick={closeMobileMenu}
                >
                  My Profile
                </NavLink>

              </div>
            )}

          </div>

        </nav>

        {/* LOGOUT */}
        <button
          type="button"
          className="sidebar-logout"
          onClick={handleLogout}
        >
          <span>Logout</span>
        </button>

      </aside>

      {/* =====================================================
          MAIN PAGE
          ===================================================== */}

      <main
        className="super-page"
        ref={notifDropdownRef}
      >

        {/* =================================================
            DESKTOP TOPBAR
            ================================================= */}

        <div className="page-topbar">

          <div className="page-topbar-spacer"></div>

          {/* DESKTOP NOTIFICATION BUTTON */}
          <button
            className="notif-bell"
            onClick={toggleNotifDropdown}
            type="button"
            aria-label="Notifications"
          >
            <FaBell />

            {unreadCount > 0 && (
              <span className="notif-badge">
                {unreadCount}
              </span>
            )}
          </button>

          {/* DESKTOP NOTIFICATION POPUP */}
          {notifOpen && (
            <div className="notif-dropdown">
              {notificationDropdown}
            </div>
          )}

        </div>

        {/* =================================================
            PAGE CONTENT
            ================================================= */}

        <Outlet />

        {/* PROFILE COMPLETION */}
        {!location.pathname.includes("/video/") && (
          <ProfileCompletionBadge
            profileData={userData}
            profilePath="/super-admin/profile"
          />
        )}

      </main>

    </div>
  );
}

export default SuperAdminLayout;