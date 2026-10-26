import { useEffect, useState } from "react";
import {
  markAllNotificationsRead,
  markNotificationRead,
  watchNotifications,
} from "../services/doubtService";

/** Live notifications for one user, newest first. */
export default function useNotificationsFeed(uid) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!uid) {
      setNotifications([]);
      return undefined;
    }

    return watchNotifications(uid, setNotifications);
  }, [uid]);

  return {
    notifications,
    unreadCount: notifications.filter((item) => !item.read).length,
    markRead: (notificationId) =>
      uid ? markNotificationRead(uid, notificationId) : Promise.resolve(),
    markAllRead: () => (uid ? markAllNotificationsRead(uid) : Promise.resolve()),
  };
}
