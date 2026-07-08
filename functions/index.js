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

    await admin.auth().deleteUser(uid);
    await admin.database().ref(`users/${uid}`).remove();

    return res.json({
      success: true,
      message: "User deleted successfully.",
    });
  } catch (error) {
    console.error("deleteUser failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete user.",
    });
  }
});