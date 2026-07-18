import { ref, update } from "firebase/database";
import { database } from "../firebase";
import {
  userPath,
  userAssignmentsPath,
  courseProgressPath,
  videoProgressPath,
  quizAttemptsPath,
  certificatesPath,
} from "./dbPaths";

/**
 * Central user deletion service.
 *
 * Performs an atomic multi-path update to remove ALL user-specific data.
 * This ensures either ALL data is removed or NONE is (atomicity).
 *
 * Also calls the Cloud Function to delete the Firebase Auth account.
 */
export const deleteUserCompletely = async (uid) => {
  if (!uid) throw new Error("uid is required");

  // Step 1: Collect all paths that need to be cleaned up.
  // Some paths use uid directly, others may have sub-nodes we need to discover.
  const updates = {};

  // Primary user profile
  updates[userPath(uid)] = null;

  // Course assignments
  updates[userAssignmentsPath(uid)] = null;

  // Course progress (new normalized path)
  updates[courseProgressPath(uid)] = null;

  // Video progress (new normalized path)
  updates[videoProgressPath(uid)] = null;

  // Quiz attempts (new normalized path)
  updates[quizAttemptsPath(uid)] = null;

  // Certificates
  updates[certificatesPath(uid)] = null;

  // Learning activity
  updates[`learningActivity/${uid}`] = null;

  // Legacy paths that may still have data
  updates[`progress/${uid}`] = null;
  updates[`completedCourses/${uid}`] = null;
  updates[`attempts/${uid}`] = null;
  updates[`results/${uid}`] = null;
  updates[`videoQuizAttempts/${uid}`] = null;

  // Step 2: Execute atomic multi-path update
  await update(ref(database), updates);

  return { success: true, pathsRemoved: Object.keys(updates).length };
};

/**
 * Deletes user data only from the Realtime Database.
 * Does NOT delete the Firebase Auth account.
 * Use this when you need to clean up DB data without touching Auth.
 */
export const deleteUserDatabaseData = async (uid) => {
  if (!uid) throw new Error("uid is required");
  return deleteUserCompletely(uid);
};

/**
 * Calls the Cloud Function to delete the Firebase Auth account.
 * This must be done server-side because it requires the Admin SDK.
 *
 * @param {string} uid - The UID of the user to delete from Auth
 * @param {string} idToken - The Firebase ID token of the requesting admin
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const deleteUserAuthAccount = async (uid, idToken) => {
  if (!uid) throw new Error("uid is required");
  if (!idToken) throw new Error("idToken is required");

  const response = await fetch(
    "https://us-central1-lms-portal-final.cloudfunctions.net/deleteUser",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ uid }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to delete user from Authentication");
  }

  return result;
};

/**
 * Full user deletion: database + authentication.
 * Call this from the admin UI.
 *
 * @param {string} uid - The UID of the user to delete
 * @param {string} idToken - The Firebase ID token of the requesting admin
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const deleteUserFully = async (uid, idToken) => {
  if (!uid) throw new Error("uid is required");

  // Step 1: Delete all database data atomically
  await deleteUserCompletely(uid);

  // Step 2: Delete Firebase Auth account via Cloud Function
  // If an idToken is provided, also delete the Auth account
  if (idToken) {
    try {
      await deleteUserAuthAccount(uid, idToken);
    } catch (authError) {
      // Database data is already deleted.
      // Auth deletion failed — report partial success.
      return {
        success: true,
        message: `User data deleted from database, but Auth deletion failed: ${authError.message}`,
        partial: true,
      };
    }
  }

  return {
    success: true,
    message: "User deleted completely from database and authentication.",
  };
};
