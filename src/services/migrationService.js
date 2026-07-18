import { get, ref, update } from "firebase/database";
import { database } from "../firebase";

/**
 * One-time migration utility for existing data.
 *
 * Migrates legacy data paths to the new normalized structure.
 * Supports dry-run mode that logs what would be changed without modifying data.
 *
 * Legacy paths → New paths:
 *   progress/{uid}/{videoId}           → videoProgress/{uid}/{courseId}/{videoId}
 *   completedCourses/{uid}/{courseId}  → courseProgress/{uid}/{courseId}
 *   attempts/{uid}/{attemptId}         → quizAttempts/{uid}/{courseId}/{quizId}
 *   results/{uid}/{resultId}           → quizAttempts/{uid}/{courseId}/{quizId}
 *   videoQuizAttempts/{uid}/{attemptId}→ quizAttempts/{uid}/{courseId}/{quizId}
 */

/**
 * Migrates a single user's data from legacy paths to new normalized paths.
 *
 * @param {string} uid - The user UID to migrate
 * @param {boolean} dryRun - If true, only log changes without writing
 * @returns {Promise<{migrated: number, errors: string[], log: Array<{oldPath: string, newPath: string, uid: string, courseId?: string, videoId?: string}>}>}
 */
export const migrateUserData = async (uid, dryRun = true) => {
  if (!uid) throw new Error("uid is required");

  const log = [];
  const errors = [];
  let migrated = 0;

  try {
    // ─── 1. Read all legacy data ───
    const [
      progressSnap,
      completedSnap,
      attemptsSnap,
      resultsSnap,
      videoQuizAttemptsSnap,
      courseVideosSnap,
    ] = await Promise.all([
      get(ref(database, `progress/${uid}`)),
      get(ref(database, `completedCourses/${uid}`)),
      get(ref(database, `attempts/${uid}`)),
      get(ref(database, `results/${uid}`)),
      get(ref(database, `videoQuizAttempts/${uid}`)),
      get(ref(database, "courseVideos")),
    ]);

    const progressData = progressSnap.exists() ? progressSnap.val() : {};
    const completedData = completedSnap.exists() ? completedSnap.val() : {};
    const attemptsData = attemptsSnap.exists() ? attemptsSnap.val() : {};
    const resultsData = resultsSnap.exists() ? resultsSnap.val() : {};
    const videoQuizData = videoQuizAttemptsSnap.exists() ? videoQuizAttemptsSnap.val() : {};
    const courseVideosData = courseVideosSnap.exists() ? courseVideosSnap.val() : {};

    // ─── 2. Build a videoId → courseId lookup ───
    const videoToCourseMap = {};
    Object.entries(courseVideosData).forEach(([courseId, videos]) => {
      Object.entries(videos || {}).forEach(([mappingId, videoInfo]) => {
        const actualVideoId = videoInfo.videoId || mappingId;
        videoToCourseMap[actualVideoId] = courseId;
        videoToCourseMap[mappingId] = courseId;
      });
    });

    // ─── 3. Migrate progress/{uid}/{videoId} → videoProgress/{uid}/{courseId}/{videoId} ───
    const videoProgressUpdates = {};
    Object.entries(progressData).forEach(([videoId, progress]) => {
      const courseId = progress.courseId || videoToCourseMap[videoId] || null;
      const oldPath = `progress/${uid}/${videoId}`;
      const newPath = courseId
        ? `videoProgress/${uid}/${courseId}/${videoId}`
        : `videoProgress/${uid}/_unknown/${videoId}`;

      log.push({
        oldPath,
        newPath,
        uid,
        courseId,
        videoId,
      });

      if (courseId && !dryRun) {
        videoProgressUpdates[`videoProgress/${uid}/${courseId}/${videoId}`] = {
          videoId,
          courseId,
          progressPercentage: progress.watchedPercent || 0,
          watchedSeconds: progress.watchedSeconds || {},
          duration: progress.duration || 0,
          completed: progress.completed || false,
          completedAt: progress.completedAt || null,
          lastWatchedAt: progress.updatedAt || null,
          practiceQuizCompleted: false,
        };
      }
      migrated++;
    });

    // ─── 4. Migrate completedCourses/{uid}/{courseId} → courseProgress/{uid}/{courseId} ───
    const courseProgressUpdates = {};
    Object.entries(completedData).forEach(([courseId, completed]) => {
      const oldPath = `completedCourses/${uid}/${courseId}`;
      const newPath = `courseProgress/${uid}/${courseId}`;

      log.push({
        oldPath,
        newPath,
        uid,
        courseId,
      });

      if (!dryRun) {
        courseProgressUpdates[`courseProgress/${uid}/${courseId}`] = {
          courseId,
          progressPercentage: completed.passed ? 100 : (completed.score || 0),
          completedVideos: 0,
          totalVideos: 0,
          lastAccessedAt: completed.completedAt || null,
          completed: completed.passed || completed.completed || false,
          completedAt: completed.completedAt || null,
          courseTestCompleted: completed.passed || false,
          courseTestPassed: completed.passed || false,
          score: completed.score || 0,
          totalMarks: completed.total || 0,
        };
      }
      migrated++;
    });

    // ─── 5. Migrate attempts/{uid}/{attemptId} → quizAttempts/{uid}/{courseId}/{quizId} ───
    const attemptUpdates = {};
    Object.entries(attemptsData).forEach(([attemptId, attempt]) => {
      const courseId = attempt.courseId || "unknown";
      const quizId = `final_${courseId}_${attemptId}`;
      const oldPath = `attempts/${uid}/${attemptId}`;
      const newPath = `quizAttempts/${uid}/${courseId}/${quizId}`;

      log.push({
        oldPath,
        newPath,
        uid,
        courseId,
        quizId,
      });

      if (!dryRun) {
        attemptUpdates[`quizAttempts/${uid}/${courseId}/${quizId}`] = {
          quizId,
          quizType: "final",
          courseId,
          score: attempt.score || 0,
          totalMarks: attempt.total || 0,
          percentage: attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0,
          passed: attempt.passed || false,
          attemptCount: 1,
          answers: attempt.answers || {},
          attemptedAt: attempt.submittedAt || null,
        };
      }
      migrated++;
    });

    // ─── 6. Migrate results/{uid}/{resultId} → quizAttempts (skip if already migrated from attempts) ───
    Object.entries(resultsData).forEach(([resultId, result]) => {
      const courseId = result.courseId || "unknown";
      const quizId = `final_${courseId}_${resultId}`;
      const oldPath = `results/${uid}/${resultId}`;
      const newPath = `quizAttempts/${uid}/${courseId}/${quizId}`;

      // Skip if this result was already migrated from attempts
      const alreadyMigrated = Object.values(attemptsData).some(
        (a) => a.courseId === courseId
      );

      log.push({
        oldPath,
        newPath,
        uid,
        courseId,
        quizId,
        skipped: alreadyMigrated,
      });

      if (!alreadyMigrated && !dryRun) {
        attemptUpdates[`quizAttempts/${uid}/${courseId}/${quizId}`] = {
          quizId,
          quizType: "final",
          courseId,
          score: result.score || 0,
          totalMarks: result.total || 0,
          percentage: result.total > 0 ? Math.round((result.score / result.total) * 100) : 0,
          passed: result.passed || false,
          attemptCount: 1,
          answers: result.answers || {},
          attemptedAt: result.submittedAt || result.completedAt || null,
        };
      }
      if (!alreadyMigrated) migrated++;
    });

    // ─── 7. Migrate videoQuizAttempts/{uid}/{attemptId} → quizAttempts ───
    Object.entries(videoQuizData).forEach(([attemptId, attempt]) => {
      const courseId = attempt.courseId || "unknown";
      const videoId = attempt.videoId || "unknown";
      const quizId = `practice_${videoId}_${attemptId}`;
      const oldPath = `videoQuizAttempts/${uid}/${attemptId}`;
      const newPath = `quizAttempts/${uid}/${courseId}/${quizId}`;

      log.push({
        oldPath,
        newPath,
        uid,
        courseId,
        videoId,
        quizId,
      });

      if (!dryRun) {
        attemptUpdates[`quizAttempts/${uid}/${courseId}/${quizId}`] = {
          quizId,
          quizType: "practice",
          courseId,
          videoId,
          score: attempt.correct || attempt.score || 0,
          totalMarks: attempt.total || 0,
          percentage: attempt.total > 0 ? Math.round(((attempt.correct || attempt.score || 0) / attempt.total) * 100) : 0,
          passed: (attempt.correct || 0) >= (attempt.total || 0) * 0.7,
          attemptCount: 1,
          answers: attempt.answers || {},
          attemptedAt: attempt.submittedAt || null,
        };
      }
      migrated++;
    });

    // ─── 8. Execute all writes atomically ───
    if (!dryRun) {
      const allUpdates = {
        ...videoProgressUpdates,
        ...courseProgressUpdates,
        ...attemptUpdates,
      };

      if (Object.keys(allUpdates).length > 0) {
        await update(ref(database), allUpdates);
      }
    }

    return { migrated, errors, log };
  } catch (error) {
    errors.push(`Migration failed for ${uid}: ${error.message}`);
    return { migrated, errors, log };
  }
};

/**
 * Migrates multiple users' data.
 *
 * @param {string[]} uids - Array of user UIDs to migrate
 * @param {boolean} dryRun - If true, only log changes
 * @returns {Promise<{totalMigrated: number, allErrors: string[], allLogs: Array}>}
 */
export const migrateMultipleUsers = async (uids, dryRun = true) => {
  if (!uids || !Array.isArray(uids)) throw new Error("uids array required");

  let totalMigrated = 0;
  const allErrors = [];
  const allLogs = [];

  for (const uid of uids) {
    const result = await migrateUserData(uid, dryRun);
    totalMigrated += result.migrated;
    allErrors.push(...result.errors);
    allLogs.push(...result.log);
  }

  return { totalMigrated, allErrors, allLogs };
};

/**
 * Migrates ALL users' data.
 * Use with caution — run in dry-run mode first.
 *
 * @param {boolean} dryRun
 */
export const migrateAllUsers = async (dryRun = true) => {
  const usersSnap = await get(ref(database, "users"));
  if (!usersSnap.exists()) return { totalMigrated: 0, allErrors: [], allLogs: [] };

  const uids = Object.keys(usersSnap.val());
  return migrateMultipleUsers(uids, dryRun);
};
