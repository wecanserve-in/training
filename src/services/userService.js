import { get, ref, update, set, remove } from "firebase/database";
import { database } from "../firebase";
import { userPath, usersRoot } from "./dbPaths";

export const getUserProfile = async (uid) => {
  if (!uid) throw new Error("uid is required");
  const snapshot = await get(ref(database, userPath(uid)));
  return snapshot.exists() ? { uid, ...snapshot.val() } : null;
};

export const getAllUsers = async () => {
  const snapshot = await get(ref(database, usersRoot));
  if (!snapshot.exists()) return [];
  return Object.entries(snapshot.val()).map(([uid, data]) => ({ uid, ...data }));
};

export const updateUserProfile = async (uid, updates) => {
  if (!uid) throw new Error("uid is required");
  if (!updates || Object.keys(updates).length === 0) return;
  await update(ref(database, userPath(uid)), {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
};

export const createUserProfile = async (uid, profileData) => {
  if (!uid) throw new Error("uid is required");
  await set(ref(database, userPath(uid)), {
    uid,
    ...profileData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
};

export const deleteUserProfile = async (uid) => {
  if (!uid) throw new Error("uid is required");
  await remove(ref(database, userPath(uid)));
};
