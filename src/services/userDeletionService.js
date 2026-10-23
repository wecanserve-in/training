import { apiRequest } from "./apiClient";

/**
 * Deletes a user's login account and all of their data.
 *
 * Runs on the server (public/api/delete-user.php), which checks that the
 * requester is allowed to delete this user and removes everything in one step.
 *
 * @param {string} uid - The UID of the user to delete
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const deleteUserFully = async (uid) => {
  if (!uid) throw new Error("uid is required");

  return apiRequest("delete-user.php", {
    method: "POST",
    body: { uid },
  });
};
