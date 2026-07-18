import { get, ref, set, update, runTransaction } from "firebase/database";
import { database } from "../firebase";
import {
  videoProgressForVideoPath,
  videoProgressForCoursePath,
  videoProgressPath,
  courseProgressForCoursePath,
  courseProgressPath,
  learningActivityVideoPath,
} from "./dbPaths";

// ─── Video Progress ───

export const getVideoProgress = async (uid, courseId, videoId) => {
  if (!uid || !courseId || !videoId) throw new Error("uid, courseId, videoId required");
  const snapshot = await get(ref(database, videoProgressForVideoPath(uid, courseId, videoId)));
  return snapshot.exists() ? snapshot.val() : null;
};

export const getVideoProgressForCourse = async (uid, courseId) => {
  if (!uid || !courseId) throw new Error("uid, courseId required");
  const snapshot = await get(ref(database, videoProgressForCoursePath(uid, courseId)));
  if (!snapshot.exists()) return {};
  return snapshot.val();
};

export const getAllVideoProgress = async (uid) => {
  if (!uid) throw new Error("uid is required");
  const snapshot = await get(ref(database, videoProgressPath(uid)));
  return snapshot.exists() ? snapshot.val() : {};
};

export const saveVideoProgress = async (uid, courseId, videoId, progressData) => {
  if (!uid || !courseId || !videoId) throw new Error("uid, courseId, videoId required");
  await set(ref(database, videoProgressForVideoPath(uid, courseId, videoId)), {
    videoId,
    courseId,
    ...progressData,
    lastWatchedAt: new Date().toISOString(),
  });
};

export const updateVideoProgress = async (uid, courseId, videoId, updates) => {
  if (!uid || !courseId || !videoId) throw new Error("uid, courseId, videoId required");
  await update(ref(database, videoProgressForVideoPath(uid, courseId, videoId)), {
    ...updates,
    lastWatchedAt: new Date().toISOString(),
  });
};

// ─── Course Progress ───

export const getCourseProgress = async (uid, courseId) => {
  if (!uid || !courseId) throw new Error("uid, courseId required");
  const snapshot = await get(ref(database, courseProgressForCoursePath(uid, courseId)));
  return snapshot.exists() ? snapshot.val() : null;
};

export const getAllCourseProgress = async (uid) => {
  if (!uid) throw new Error("uid is required");
  const snapshot = await get(ref(database, courseProgressPath(uid)));
  return snapshot.exists() ? snapshot.val() : {};
};

export const saveCourseProgress = async (uid, courseId, progressData) => {
  if (!uid || !courseId) throw new Error("uid, courseId required");
  await set(ref(database, courseProgressForCoursePath(uid, courseId)), {
    courseId,
    ...progressData,
    lastAccessedAt: new Date().toISOString(),
  });
};

export const updateCourseProgress = async (uid, courseId, updates) => {
  if (!uid || !courseId) throw new Error("uid, courseId required");
  await update(ref(database, courseProgressForCoursePath(uid, courseId)), {
    ...updates,
    lastAccessedAt: new Date().toISOString(),
  });
};

// ─── Learning Activity ───

export const incrementLearningSeconds = async (uid, dayKey, videoId, seconds) => {
  if (!uid || !dayKey || !videoId) throw new Error("uid, dayKey, videoId required");
  await runTransaction(
    ref(database, learningActivityVideoPath(uid, dayKey, videoId) + "/seconds"),
    (current) => Number(current || 0) + seconds
  );
};

export const updateLearningActivityMetadata = async (uid, dayKey, videoId, metadata) => {
  if (!uid || !dayKey || !videoId) throw new Error("uid, dayKey, videoId required");
  await update(ref(database, learningActivityVideoPath(uid, dayKey, videoId)), metadata);
};

export const getLearningActivity = async (uid) => {
  if (!uid) throw new Error("uid is required");
  const snapshot = await get(ref(database, `learningActivity/${uid}`));
  return snapshot.exists() ? snapshot.val() : {};
};

// ─── Legacy Path Helpers (for migration reads) ───

export const getLegacyProgress = async (uid) => {
  if (!uid) throw new Error("uid is required");
  const { get: fbGet, ref: fbRef } = await import("firebase/database");
  const snapshot = await fbGet(fbRef(database, `progress/${uid}`));
  return snapshot.exists() ? snapshot.val() : {};
};

export const getLegacyCompletedCourses = async (uid) => {
  if (!uid) throw new Error("uid is required");
  const { get: fbGet, ref: fbRef } = await import("firebase/database");
  const snapshot = await fbGet(fbRef(database, `completedCourses/${uid}`));
  return snapshot.exists() ? snapshot.val() : {};
};

export const getLegacyAttempts = async (uid) => {
  if (!uid) throw new Error("uid is required");
  const { get: fbGet, ref: fbRef } = await import("firebase/database");
  const snapshot = await fbGet(fbRef(database, `attempts/${uid}`));
  return snapshot.exists() ? snapshot.val() : {};
};

export const getLegacyResults = async (uid) => {
  if (!uid) throw new Error("uid is required");
  const { get: fbGet, ref: fbRef } = await import("firebase/database");
  const snapshot = await fbGet(fbRef(database, `results/${uid}`));
  return snapshot.exists() ? snapshot.val() : {};
};

export const getLegacyVideoQuizAttempts = async (uid) => {
  if (!uid) throw new Error("uid is required");
  const { get: fbGet, ref: fbRef } = await import("firebase/database");
  const snapshot = await fbGet(fbRef(database, `videoQuizAttempts/${uid}`));
  return snapshot.exists() ? snapshot.val() : {};
};

// ─── Recalculate Course Progress from Video Progress ───

export const recalculateCourseProgress = async (uid, courseId, totalVideoCount) => {
  if (!uid || !courseId) throw new Error("uid, courseId required");

  const videoProgressData = await getVideoProgressForCourse(uid, courseId);
  const videoIds = Object.keys(videoProgressData);
  const completedCount = videoIds.filter((vid) => videoProgressData[vid]?.completed).length;
  const totalWatchedPercent = videoIds.reduce(
    (sum, vid) => sum + Number(videoProgressData[vid]?.progressPercentage || videoProgressData[vid]?.watchedPercent || 0),
    0
  );

  const effectiveTotal = totalVideoCount || videoIds.length || 1;
  const progressPercentage = Math.round(totalWatchedPercent / effectiveTotal);
  const completed = completedCount >= effectiveTotal && effectiveTotal > 0;

  await saveCourseProgress(uid, courseId, {
    progressPercentage,
    completedVideos: completedCount,
    totalVideos: effectiveTotal,
    completed,
    ...(completed && { completedAt: new Date().toISOString() }),
  });

  return { progressPercentage, completedVideos: completedCount, totalVideos: effectiveTotal, completed };
};
