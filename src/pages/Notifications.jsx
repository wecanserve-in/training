import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { loadUserProfile } from "../lib/userAccess";
import {
  watchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/doubtService";
import useBasePath from "../hooks/useBasePath";
import "../styles/notifications.css";

import {
  FaBell,
  FaComments,
  FaReply,
  FaCheck,
  FaArrowLeft,
  FaBookOpen,
  FaVideo,
  FaClock,
  FaTimesCircle,
  FaCheckCircle,
  FaAward,
} from "react-icons/fa";

function Notifications() {
  const navigate = useNavigate();
  const basePath = useBasePath();
  const [userData, setUserData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/");
        return;
      }
      try {
        const profile = await loadUserProfile(user);
        setUserData(profile);
      } catch (err) {
        console.error(err);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!userData?.id) return;
    const unsub = watchNotifications(userData.id, (notifs) => {
      setNotifications(notifs);
      setLoading(false);
    });
    return () => unsub();
  }, [userData?.id]);

  const handleMarkRead = async (notificationId) => {
    if (!userData?.id) return;
    await markNotificationRead(userData.id, notificationId);
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

  const getNotificationLink = (notif) => {
    if (notif.type === "course_completed") {
      return `${basePath}/assigned-courses`;
    }
    if (notif.courseId) return `${basePath}/course/${notif.courseId}`;
    return "#";
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
      year: "numeric",
    });
  };

  const unreadNotifications = notifications.filter((n) => !n.read);
  const readNotifications = notifications.filter((n) => n.read);

  if (loading) {
    return <h2 className="notif-loading">Loading notifications...</h2>;
  }

  return (
    <div className="notifications-page">
      <div className="notif-header">
        <button className="notif-back-btn" onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </button>
        <div>
          <h1>Notifications</h1>
          <p>{unreadNotifications.length} unread</p>
        </div>
        {unreadNotifications.length > 0 && (
          <button className="notif-mark-all-btn" onClick={handleMarkAllRead}>
            <FaCheck /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="notif-empty">
          <FaBell className="notif-empty-icon" />
          <h3>No notifications yet</h3>
          <p>You&apos;ll see notifications here when someone interacts with you.</p>
        </div>
      ) : (
        <>
          {unreadNotifications.length > 0 && (
            <div className="notif-section">
              <h2>New</h2>
              <div className="notif-list">
                {unreadNotifications.map((notif) => (
                  <Link
                    to={getNotificationLink(notif)}
                    className="notif-item unread"
                    key={notif.notificationId}
                    onClick={() => handleMarkRead(notif.notificationId)}
                  >
                    <div className={`notif-icon-wrapper ${notif.type}`}>
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="notif-content">
                      <h4>{notif.title}</h4>
                      <p>{notif.message}</p>
                      <span className="notif-time">{formatTime(notif.createdAt)}</span>
                    </div>
                    <div className="notif-unread-dot"></div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {readNotifications.length > 0 && (
            <div className="notif-section">
              <h2>Earlier</h2>
              <div className="notif-list">
                {readNotifications.map((notif) => (
                  <Link
                    to={getNotificationLink(notif)}
                    className="notif-item"
                    key={notif.notificationId}
                  >
                    <div className={`notif-icon-wrapper ${notif.type}`}>
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="notif-content">
                      <h4>{notif.title}</h4>
                      <p>{notif.message}</p>
                      <span className="notif-time">{formatTime(notif.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Notifications;