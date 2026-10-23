import { get, ref, update } from "firebase/database";
import { database } from "../firebase";

/**
 * Deletes a course for everyone.
 *
 * Removes the course, its video mapping, its quiz and every user's assignment
 * to it in one atomic update. Learners' past results and certificates are kept
 * as history.
 */
export const deleteCourseEverywhere = async (courseId) => {
  if (!courseId) throw new Error("courseId is required");

  const assignmentsSnapshot = await get(ref(database, "userAssignments"));
  const assignments = assignmentsSnapshot.exists() ? assignmentsSnapshot.val() : {};

  const updates = {
    [`courses/${courseId}`]: null,
    [`courseVideos/${courseId}`]: null,
    [`courseContentUpdates/${courseId}`]: null,
    [`courseQuizzes/${courseId}`]: null,
    [`questions/${courseId}`]: null,
  };

  Object.entries(assignments || {}).forEach(([uid, userCourses]) => {
    if (userCourses && typeof userCourses === "object" && userCourses[courseId]) {
      updates[`userAssignments/${uid}/${courseId}`] = null;
    }
  });

  await update(ref(database), updates);
};
