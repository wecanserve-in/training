import { get, ref } from "firebase/database";
import { database } from "../firebase";

/**
 * Converts role values into one consistent format.
 *
 * Examples:
 * "superAdmin"       -> "superadmin"
 * "Super Admin"      -> "superadmin"
 * "departmentAdmin"  -> "departmentadmin"
 */
export const normalizeRole = (role) =>
  String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");

/**
 * Displays a readable role name in the UI.
 */
export const formatRoleLabel = (role) => {
  const normalizedRole = normalizeRole(role);

  switch (normalizedRole) {
    case "superadmin":
      return "Super Admin";

    case "departmentadmin":
      return "Department Admin";

    case "admin":
      return "Admin";

    case "user":
      return "User";

    default:
      return role ? String(role) : "User";
  }
};

/**
 * Combines Firebase Authentication user data
 * with the user's Realtime Database profile.
 */
export const buildUserProfile = (
  firebaseUser,
  profileData = {}
) => {
  if (!firebaseUser) {
    return null;
  }

  const email =
    profileData.email ||
    firebaseUser.email ||
    "";

  const name =
    profileData.name ||
    profileData.fullName ||
    firebaseUser.displayName ||
    email ||
    "User";

  const role = normalizeRole(
    profileData.role ||
    firebaseUser.role ||
    "user"
  );

  return {
    ...profileData,

    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    email,
    name,
    role,

    status:
      profileData.status || "active",

    department:
      profileData.department || "",

    departmentId:
      profileData.departmentId || "",

    designation:
      profileData.designation || "",
  };
};

/**
 * Loads the logged-in user's profile from:
 *
 * users/{firebaseAuthUid}
 *
 * The role always comes from the database. (There used to be a hard-coded
 * "emergency" super admin email here; anyone could sign up with it.)
 */
export const loadUserProfile = async (
  firebaseUser
) => {
  if (!firebaseUser?.uid) {
    return null;
  }

  try {
    const snapshot = await get(
      ref(database, `users/${firebaseUser.uid}`)
    );

    if (!snapshot.exists()) {
      return buildUserProfile(firebaseUser, {
        email: firebaseUser.email || "",
        role: "user",
        status: "active",
      });
    }

    return buildUserProfile(
      firebaseUser,
      snapshot.val()
    );
  } catch (error) {
    console.error("Unable to load user profile:", {
      uid: firebaseUser.uid,
      code: error?.code,
      message: error?.message,
    });

    throw error;
  }
};

/**
 * Checks whether a role is included
 * in the list of allowed roles.
 */
export const canAccessRoles = (
  role,
  allowedRoles = []
) => {
  const normalizedRole =
    normalizeRole(role);

  const normalizedAllowedRoles =
    allowedRoles.map((allowedRole) =>
      normalizeRole(allowedRole)
    );

  return normalizedAllowedRoles.includes(
    normalizedRole
  );
};

/**
 * Returns the correct dashboard route
 * according to the user's role.
 */
export const getRoleHomePath = (role) => {
  switch (normalizeRole(role)) {
    case "superadmin":
      return "/super-admin";

    case "departmentadmin":
      return "/department-admin";

    case "admin":
      return "/admin";

    case "user":
    default:
      return "/dashboard";
  }
};

/**
 * Optional helper for checking whether
 * the current user is a Super Admin.
 */
export const isSuperAdmin = (role) =>
  normalizeRole(role) === "superadmin";

/**
 * Optional helper for checking whether
 * the current user is an Admin.
 */
export const isAdmin = (role) =>
  normalizeRole(role) === "admin";

/**
 * Optional helper for checking whether
 * the current user is a Department Admin.
 */
export const isDepartmentAdmin = (
  role
) =>
  normalizeRole(role) ===
  "departmentadmin";