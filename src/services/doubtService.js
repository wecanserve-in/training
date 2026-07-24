import {
  get,
  set,
  push,
  update,
  remove,
  ref,
  query,
  orderByChild,
  equalTo,
  onValue,
  off,
} from "firebase/database";
import { database } from "../firebase";
import {
  doubtThreadsRoot,
  doubtThreadPath,
  doubtMessagesRoot,
  doubtMessagesForThreadPath,
  doubtMessagePath,
  notificationsRoot,
  notificationsForUserPath,
} from "./dbPaths";

// ─── Create Thread ───
export const createDoubtThread = async (threadData) => {
  const threadRef = ref(database, doubtThreadsRoot);
  const newRef = push(threadRef);
  const threadId = newRef.key;

  const now = new Date().toISOString();
  const thread = {
    threadId,
    createdBy: threadData.createdBy || "",
    createdByName: threadData.createdByName || "",
    createdByRole: threadData.createdByRole || "user",
    departmentId: threadData.departmentId || "",
    departmentName: threadData.departmentName || "",
    courseId: threadData.courseId || "",
    courseTitle: threadData.courseTitle || "",
    subject: threadData.subject || "",
    status: "open",
    createdAt: now,
    updatedAt: now,
    lastMessage: threadData.subject || "",
    lastMessageBy: threadData.createdByName || "",
    lastMessageAt: now,
    unreadCount: 0,
  };

  await set(newRef, thread);
  return threadId;
};

// ─── Send Message in Thread ───
export const sendDoubtMessage = async (threadId, messageData) => {
  const msgRef = ref(database, doubtMessagesForThreadPath(threadId));
  const newMsgRef = push(msgRef);
  const messageId = newMsgRef.key;

  const now = new Date().toISOString();
  const message = {
    messageId,
    senderId: messageData.senderId || "",
    senderName: messageData.senderName || "",
    senderRole: messageData.senderRole || "user",
    departmentId: messageData.departmentId || "",
    message: messageData.message || "",
    createdAt: now,
  };

  await set(newMsgRef, message);

  await update(ref(database, `${doubtThreadsRoot}/${threadId}`), {
    lastMessage: messageData.message || "",
    lastMessageBy: messageData.senderName || "",
    lastMessageAt: now,
    updatedAt: now,
    unreadCount: (messageData.currentUnreadCount || 0) + 1,
  });

  return messageId;
};

// ─── Update Thread Status (admin only) ───
export const updateThreadStatus = async (threadId, status) => {
  await update(ref(database, `${doubtThreadsRoot}/${threadId}`), {
    status,
    updatedAt: new Date().toISOString(),
  });
};

// ─── Mark Thread Read ───
export const markThreadRead = async (threadId) => {
  await update(ref(database, `${doubtThreadsRoot}/${threadId}`), {
    unreadCount: 0,
  });
};

// ─── Delete Thread (admin only) ───
export const deleteDoubtThread = async (threadId) => {
  await remove(ref(database, doubtMessagesForThreadPath(threadId)));
  await remove(ref(database, `${doubtThreadsRoot}/${threadId}`));
};

// ─── Get Single Thread ───
export const getThread = async (threadId) => {
  const snap = await get(ref(database, `${doubtThreadsRoot}/${threadId}`));
  return snap.exists() ? { threadId, ...snap.val() } : null;
};

// ─── Get All Messages for Thread ───
export const getThreadMessages = async (threadId) => {
  const snap = await get(ref(database, doubtMessagesForThreadPath(threadId)));
  if (!snap.exists()) return [];
  return Object.entries(snap.val())
    .map(([id, msg]) => ({ messageId: id, ...msg }))
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
};

// ─── Real-time: Listen to All Threads ───
export const watchThreads = (callback) => {
  const threadsRef = ref(database, doubtThreadsRoot);
  const unsubscribe = onValue(threadsRef, (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const threads = Object.entries(snap.val())
      .map(([id, data]) => ({ threadId: id, ...data }))
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    callback(threads);
  });
  return () => off(threadsRef, "value", unsubscribe);
};

// ─── Real-time: Listen to Messages for a Thread ───
export const watchThreadMessages = (threadId, callback) => {
  const msgRef = ref(database, doubtMessagesForThreadPath(threadId));
  const unsubscribe = onValue(msgRef, (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const messages = Object.entries(snap.val())
      .map(([id, msg]) => ({ messageId: id, ...msg }))
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    callback(messages);
  });
  return () => off(msgRef, "value", unsubscribe);
};

// ─── Create Notification ───
export const createNotification = async (userId, notificationData) => {
  const notifRef = ref(database, notificationsForUserPath(userId));
  const newRef = push(notifRef);
  const now = new Date().toISOString();

  await set(newRef, {
    notificationId: newRef.key,
    type: notificationData.type || "doubt",
    threadId: notificationData.threadId || "",
    title: notificationData.title || "",
    message: notificationData.message || "",
    read: false,
    createdAt: now,
  });
};

// ─── Real-time: Watch Notifications for a User ───
export const watchNotifications = (userId, callback) => {
  const notifRef = ref(database, notificationsForUserPath(userId));
  const unsubscribe = onValue(notifRef, (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const notifications = Object.entries(snap.val())
      .map(([id, data]) => ({ notificationId: id, ...data }))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    callback(notifications);
  });
  return () => off(notifRef, "value", unsubscribe);
};

// ─── Mark Notification Read ───
export const markNotificationRead = async (userId, notificationId) => {
  await update(ref(database, `${notificationsRoot}/${userId}/${notificationId}`), {
    read: true,
  });
};

// ─── Mark All Notifications Read ───
export const markAllNotificationsRead = async (userId) => {
  const snap = await get(ref(database, notificationsForUserPath(userId)));
  if (!snap.exists()) return;

  const updates = {};
  Object.keys(snap.val()).forEach((id) => {
    updates[`${notificationsRoot}/${userId}/${id}/read`] = true;
  });
  await update(ref(database), updates);
};

// ─── Notify Relevant Admins & DeptAdmins when user creates doubt ───
export const notifyAdminsOfNewDoubt = async (thread) => {
  const usersSnap = await get(ref(database, "users"));
  if (!usersSnap.exists()) return;

  const users = Object.entries(usersSnap.val()).map(([id, u]) => ({
    id,
    ...u,
  }));

  for (const user of users) {
    const role = String(user.role || "").toLowerCase().replace(/[\s_-]/g, "");
    const isSuperAdmin = role === "superadmin";
    const isAdmin = role === "admin";
    const isDeptAdmin = role === "departmentadmin";

    if (isSuperAdmin || isAdmin) {
      await createNotification(user.id, {
        type: "doubt",
        threadId: thread.threadId,
        title: "New Doubt",
        message: `${thread.createdByName} posted: ${thread.subject}`,
      });
    }

    if (isDeptAdmin) {
      const deptId = String(user.departmentId || "").trim();
      const dept = String(user.department || "").trim().toLowerCase();
      const threadDeptId = String(thread.departmentId || "").trim();
      const threadDept = String(thread.departmentName || "").trim().toLowerCase();

      if (
        (threadDeptId && deptId && threadDeptId === deptId) ||
        (threadDept && dept && threadDept === dept)
      ) {
        await createNotification(user.id, {
          type: "doubt",
          threadId: thread.threadId,
          title: "New Doubt in Your Department",
          message: `${thread.createdByName} posted: ${thread.subject}`,
        });
      }
    }
  }
};

// ─── Notify Thread Owner when admin replies ───
export const notifyThreadOwner = async (thread, senderName, message) => {
  if (!thread.createdBy) return;
  await createNotification(thread.createdBy, {
    type: "doubt_reply",
    threadId: thread.threadId,
    title: "Reply to Your Doubt",
    message: `${senderName} replied: ${message.substring(0, 80)}${message.length > 80 ? "..." : ""}`,
  });
};

// ─── Notify Other Participants ───
export const notifyOtherParticipants = async (thread, senderId, senderName, message) => {
  const participants = new Set();

  if (thread.createdBy && thread.createdBy !== senderId) {
    participants.add(thread.createdBy);
  }

  const msgSnap = await get(ref(database, doubtMessagesForThreadPath(thread.threadId)));
  if (msgSnap.exists()) {
    Object.values(msgSnap.val()).forEach((msg) => {
      if (msg.senderId && msg.senderId !== senderId) {
        participants.add(msg.senderId);
      }
    });
  }

  for (const pid of participants) {
    await createNotification(pid, {
      type: "doubt_reply",
      threadId: thread.threadId,
      title: "New Reply in Doubt",
      message: `${senderName}: ${message.substring(0, 80)}${message.length > 80 ? "..." : ""}`,
    });
  }
};
