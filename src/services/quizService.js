import { get, ref, set, update } from "firebase/database";
import { database } from "../firebase";
import {
  quizAttemptPath,
  quizAttemptsForCoursePath,
  quizAttemptsPath,
  certificatePath,
  certificatesPath,
} from "./dbPaths";

// ─── Quiz Attempts (Practice + Final) ───

export const getQuizAttemptsForCourse = async (uid, courseId) => {
  if (!uid || !courseId) throw new Error("uid, courseId required");
  const snapshot = await get(ref(database, quizAttemptsForCoursePath(uid, courseId)));
  return snapshot.exists() ? snapshot.val() : {};
};

export const getAllQuizAttempts = async (uid) => {
  if (!uid) throw new Error("uid is required");
  const snapshot = await get(ref(database, quizAttemptsPath(uid)));
  return snapshot.exists() ? snapshot.val() : {};
};

export const saveQuizAttempt = async (uid, courseId, quizId, attemptData) => {
  if (!uid || !courseId || !quizId) throw new Error("uid, courseId, quizId required");
  await set(ref(database, quizAttemptPath(uid, courseId, quizId)), {
    quizId,
    courseId,
    ...attemptData,
    attemptedAt: new Date().toISOString(),
  });
};

export const updateQuizAttempt = async (uid, courseId, quizId, updates) => {
  if (!uid || !courseId || !quizId) throw new Error("uid, courseId, quizId required");
  await update(ref(database, quizAttemptPath(uid, courseId, quizId)), updates);
};

// ─── Convenience: Save Practice Quiz Attempt ───

export const savePracticeQuizAttempt = async (uid, courseId, videoId, attemptData) => {
  if (!uid || !courseId) throw new Error("uid, courseId required");
  const quizId = `practice_${videoId}_${Date.now()}`;
  await saveQuizAttempt(uid, courseId, quizId, {
    quizType: "practice",
    videoId,
    ...attemptData,
  });
  return quizId;
};

// ─── Convenience: Save Final Course Test Attempt ───

export const saveFinalTestAttempt = async (uid, courseId, attemptData) => {
  if (!uid || !courseId) throw new Error("uid, courseId required");
  const quizId = `final_${courseId}_${Date.now()}`;
  await saveQuizAttempt(uid, courseId, quizId, {
    quizType: "final",
    ...attemptData,
  });
  return quizId;
};

// ─── Check if Final Test Already Passed ───

export const isFinalTestPassed = async (uid, courseId) => {
  if (!uid || !courseId) return false;
  const attempts = await getQuizAttemptsForCourse(uid, courseId);
  return Object.values(attempts).some(
    (a) => a.quizType === "final" && a.passed === true
  );
};

// ─── Get Latest Final Test Result ───

export const getLatestFinalTestResult = async (uid, courseId) => {
  if (!uid || !courseId) return null;
  const attempts = await getQuizAttemptsForCourse(uid, courseId);
  const finalAttempts = Object.values(attempts)
    .filter((a) => a.quizType === "final")
    .sort(
      (a, b) =>
        new Date(b.attemptedAt || 0) - new Date(a.attemptedAt || 0)
    );
  return finalAttempts[0] || null;
};

// ─── Certificates ───

export const getCertificates = async (uid) => {
  if (!uid) throw new Error("uid is required");
  const snapshot = await get(ref(database, certificatesPath(uid)));
  return snapshot.exists() ? snapshot.val() : {};
};

export const getCertificate = async (uid, courseId) => {
  if (!uid || !courseId) throw new Error("uid, courseId required");
  const snapshot = await get(ref(database, certificatePath(uid, courseId)));
  return snapshot.exists() ? snapshot.val() : null;
};

export const saveCertificate = async (uid, courseId, certificateData) => {
  if (!uid || !courseId) throw new Error("uid, courseId required");
  await set(ref(database, certificatePath(uid, courseId)), {
    courseId,
    issuedAt: new Date().toISOString(),
    ...certificateData,
  });
};
