import { get, ref, set, remove, update, onValue } from "firebase/database";
import { database } from "../firebase";
import {
  userAssignmentPath,
  userAssignmentsPath,
  userAssignmentsRoot,
} from "./dbPaths";

export const getUserAssignments = async (uid) => {
  if (!uid) throw new Error("uid is required");
  const snapshot = await get(ref(database, userAssignmentsPath(uid)));
  if (!snapshot.exists()) return {};
  return snapshot.val();
};

export const getAllAssignments = async () => {
  const snapshot = await get(ref(database, userAssignmentsRoot));
  return snapshot.exists() ? snapshot.val() : {};
};

export const assignCourseToUser = async (uid, courseId, assignmentData) => {
  if (!uid) throw new Error("uid is required");
  if (!courseId) throw new Error("courseId is required");
  await set(ref(database, userAssignmentPath(uid, courseId)), {
    courseId,
    assigned: true,
    assignedAt: new Date().toISOString(),
    status: "active",
    ...assignmentData,
  });
};

export const unassignCourseFromUser = async (uid, courseId) => {
  if (!uid) throw new Error("uid is required");
  if (!courseId) throw new Error("courseId is required");
  await remove(ref(database, userAssignmentPath(uid, courseId)));
};

export const updateAssignment = async (uid, courseId, updates) => {
  if (!uid) throw new Error("uid is required");
  if (!courseId) throw new Error("courseId is required");
  await update(ref(database, userAssignmentPath(uid, courseId)), updates);
};

export const watchUserAssignments = (uid, callback) => {
  if (!uid) return () => {};
  const dbRef = ref(database, userAssignmentsPath(uid));
  return onValue(dbRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : {});
  });
};

export const watchAllAssignments = (callback) => {
  const dbRef = ref(database, userAssignmentsRoot);
  return onValue(dbRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : {});
  });
};
