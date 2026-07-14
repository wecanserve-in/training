import { get, ref } from "firebase/database";
import { database } from "../firebase";

export const normalizeRole = (role) =>
    String(role ?? "")
        .trim()
        .toLowerCase();

export const formatRoleLabel = (role) => {
    const normalizedRole = normalizeRole(role);

    switch (normalizedRole) {
        case "superadmin":
            return "Super Admin";
        case "departmentadmin":
            return "Department Admin";
        case "admin":
            return "Admin";
        default:
            return role ? String(role) : "User";
    }
};

export const buildUserProfile = (firebaseUser, profileData = {}) => {
    const email = profileData.email || firebaseUser.email || "";
    const name =
        profileData.name ||
        profileData.fullName ||
        firebaseUser.displayName ||
        email ||
        "User";

    return {
        ...profileData,
        uid: firebaseUser.uid,
        email,
        name,
        role: profileData.role || firebaseUser.role || "",
        department: profileData.department || "",
        departmentId: profileData.departmentId || "",
        designation: profileData.designation || "",
    };
};

export const loadUserProfile = async (firebaseUser) => {
    if (!firebaseUser?.uid) {
        return null;
    }

    const snapshot = await get(ref(database, `users/${firebaseUser.uid}`));

    if (!snapshot.exists()) {
        return buildUserProfile(firebaseUser);
    }

    return buildUserProfile(firebaseUser, snapshot.val());
};

export const canAccessRoles = (role, allowedRoles = []) => {
    const normalizedRole = normalizeRole(role);
    const normalizedAllowedRoles = allowedRoles.map((allowedRole) =>
        normalizeRole(allowedRole)
    );

    return normalizedAllowedRoles.includes(normalizedRole);
};

export const getRoleHomePath = (role) => {
    switch (normalizeRole(role)) {
        case "superadmin":
            return "/super-admin";
        case "departmentadmin":
            return "/department-admin";
        case "admin":
            return "/admin";
        default:
            return "/dashboard";
    }
};