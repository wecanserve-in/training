const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

const normalizeRole = (role) => String(role || "").trim().toLowerCase();

const sendCorsHeaders = (res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
};

const getRequester = async (req) => {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new Error("Missing authorization token");
  }

  const decodedToken = await admin.auth().verifyIdToken(match[1]);
  const snapshot = await admin
    .database()
    .ref(`users/${decodedToken.uid}`)
    .once("value");
  const profile = snapshot.val() || {};

  return {
    uid: decodedToken.uid,
    role: normalizeRole(profile.role || decodedToken.role),
  };
};

/**
 * Complete user deletion.
 *
 * Removes ALL user data from Realtime Database using an atomic
 * multi-path update, then deletes the Firebase Authentication account.
 *
 * This ensures either ALL data is removed or NONE is.
 */
exports.deleteUser = onRequest(async (req, res) => {
  try {
    sendCorsHeaders(res);

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Method not allowed",
      });
    }

    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: "UID is required",
      });
    }

    const requester = await getRequester(req);

    if (requester.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Only super admins can delete users.",
      });
    }

    if (requester.uid === uid) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account.",
      });
    }

    const db = admin.database();

    // ─── Step 1: Atomic multi-path deletion of ALL user data ───
    const updates = {};

    // Primary user profile
    updates[`users/${uid}`] = null;

    // Course assignments
    updates[`userAssignments/${uid}`] = null;

    // Course progress (new normalized path)
    updates[`courseProgress/${uid}`] = null;

    // Video progress (new normalized path)
    updates[`videoProgress/${uid}`] = null;

    // Quiz attempts (new normalized path)
    updates[`quizAttempts/${uid}`] = null;

    // Certificates
    updates[`certificates/${uid}`] = null;

    // Learning activity
    updates[`learningActivity/${uid}`] = null;

    // Legacy paths
    updates[`progress/${uid}`] = null;
    updates[`completedCourses/${uid}`] = null;
    updates[`attempts/${uid}`] = null;
    updates[`results/${uid}`] = null;
    updates[`videoQuizAttempts/${uid}`] = null;

    await db.ref().update(updates);

    // ─── Step 2: Delete Firebase Auth account ───
    await admin.auth().deleteUser(uid);

    return res.json({
      success: true,
      message: "User and all associated data deleted successfully.",
      pathsRemoved: Object.keys(updates).length,
    });
  } catch (error) {
    console.error("deleteUser failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete user.",
    });
  }
});
