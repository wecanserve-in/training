import {
  get,
  push,
  set,
  update,
  ref,
  onValue,
  off,
} from "firebase/database";
import { database } from "../firebase";

export const GENERAL_DISCUSSION_CHANNEL = "_general";

const discussionChannelPath = (courseId, channelId) =>
  `courseDiscussions/${courseId}/channels/${channelId}`;

const discussionMessagesPath = (courseId, channelId) =>
  `${discussionChannelPath(courseId, channelId)}/messages`;

const notificationsForUserPath = (userId) => `notifications/${userId}`;

export const sendCourseDiscussionMessage = async ({
  courseId,
  channelId = GENERAL_DISCUSSION_CHANNEL,
  videoId = null,
  videoTitle = "",
  senderId,
  senderName,
  senderRole = "user",
  message,
}) => {
  if (!courseId || !senderId || !message?.trim()) {
    throw new Error("Course, sender and message are required.");
  }

  const safeChannelId = channelId || GENERAL_DISCUSSION_CHANNEL;
  const messageRef = push(
    ref(database, discussionMessagesPath(courseId, safeChannelId))
  );
  const now = new Date().toISOString();

  const messageRecord = {
    messageId: messageRef.key,
    courseId,
    channelId: safeChannelId,
    videoId:
      safeChannelId === GENERAL_DISCUSSION_CHANNEL ? null : videoId || safeChannelId,
    videoTitle:
      safeChannelId === GENERAL_DISCUSSION_CHANNEL ? "" : videoTitle || "",
    senderId,
    senderName: senderName || "User",
    senderRole,
    message: message.trim(),
    createdAt: now,
  };

  await set(messageRef, messageRecord);

  await update(ref(database, discussionChannelPath(courseId, safeChannelId)), {
    channelId: safeChannelId,
    courseId,
    videoId: messageRecord.videoId,
    videoTitle: messageRecord.videoTitle,
    lastMessage: messageRecord.message,
    lastMessageBy: messageRecord.senderName,
    updatedAt: now,
  });

  return messageRecord;
};

export const getCourseDiscussionMessages = async (
  courseId,
  channelId = GENERAL_DISCUSSION_CHANNEL
) => {
  const snapshot = await get(
    ref(database, discussionMessagesPath(courseId, channelId))
  );

  if (!snapshot.exists()) return [];

  return Object.entries(snapshot.val())
    .map(([messageId, value]) => ({ messageId, ...value }))
    .sort(
      (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    );
};

export const watchCourseDiscussionMessages = (
  courseId,
  channelId = GENERAL_DISCUSSION_CHANNEL,
  callback
) => {
  const messagesRef = ref(
    database,
    discussionMessagesPath(courseId, channelId)
  );

  const listener = onValue(
    messagesRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }

      const messages = Object.entries(snapshot.val())
        .map(([messageId, value]) => ({ messageId, ...value }))
        .sort(
          (a, b) =>
            new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        );

      callback(messages);
    },
    (error) => {
      console.error("Discussion listener failed:", error);
      callback([]);
    }
  );

  return () => off(messagesRef, "value", listener);
};

export const createNotification = async (userId, notificationData) => {
  const notificationRef = push(
    ref(database, notificationsForUserPath(userId))
  );
  const now = new Date().toISOString();

  await set(notificationRef, {
    notificationId: notificationRef.key,
    type: notificationData.type || "course_discussion",
    courseId: notificationData.courseId || "",
    courseTitle: notificationData.courseTitle || "",
    channelId: notificationData.channelId || GENERAL_DISCUSSION_CHANNEL,
    videoId: notificationData.videoId || "",
    title: notificationData.title || "Course discussion",
    message: notificationData.message || "",
    read: false,
    createdAt: now,
  });
};

export const notifyCourseDiscussionParticipants = async ({
  courseId,
  courseTitle,
  channelId,
  videoId,
  videoTitle,
  senderId,
  senderName,
  message,
}) => {
  const usersSnapshot = await get(ref(database, "users"));
  if (!usersSnapshot.exists()) return;

  const users = Object.entries(usersSnapshot.val()).map(([id, value]) => ({
    id,
    ...(value || {}),
  }));

  const shortMessage =
    message.length > 80 ? `${message.substring(0, 80)}...` : message;

  await Promise.all(
    users.map(async (user) => {
      if (user.id === senderId) return;

      const role = String(user.role || "")
        .toLowerCase()
        .replace(/[\s_-]/g, "");

      const canSeeEveryCourse = [
        "superadmin",
        "admin",
        "departmentadmin",
      ].includes(role);

      let assignedToCourse = false;
      if (!canSeeEveryCourse) {
        const assignmentSnapshot = await get(
          ref(database, `userAssignments/${user.id}/${courseId}`)
        );
        assignedToCourse = assignmentSnapshot.exists();
      }

      if (!canSeeEveryCourse && !assignedToCourse) return;

      await createNotification(user.id, {
        type: "course_discussion",
        courseId,
        channelId,
        videoId: videoId || "",
        title:
          channelId === GENERAL_DISCUSSION_CHANNEL
            ? `New message in ${courseTitle || "course"}`
            : `New message: ${videoTitle || "video discussion"}`,
        message: `${senderName}: ${shortMessage}`,
      });
    })
  );
};

export const watchNotifications = (userId, callback) => {
  const notificationRef = ref(database, notificationsForUserPath(userId));
  const listener = onValue(notificationRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }

    callback(
      Object.entries(snapshot.val())
        .map(([notificationId, value]) => ({ notificationId, ...value }))
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        )
    );
  });

  return () => off(notificationRef, "value", listener);
};

export const markNotificationRead = async (userId, notificationId) => {
  await update(ref(database, `notifications/${userId}/${notificationId}`), {
    read: true,
  });
};

export const markAllNotificationsRead = async (userId) => {
  const snapshot = await get(ref(database, notificationsForUserPath(userId)));
  if (!snapshot.exists()) return;

  const updates = {};
  Object.keys(snapshot.val()).forEach((notificationId) => {
    updates[`notifications/${userId}/${notificationId}/read`] = true;
  });

  await update(ref(database), updates);
};
