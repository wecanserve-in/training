import { auth } from "../firebase";

// PHP endpoints live next to the site in /api (see public/api).
const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");

/**
 * Calls one of the portal's server endpoints as the signed-in user.
 * Throws an Error with the server's message when the call fails.
 */
export const apiRequest = async (endpoint, { method = "GET", body, query } = {}) => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please sign in again.");
  }

  const idToken = await user.getIdToken();
  const queryString = query ? `?${new URLSearchParams(query)}` : "";

  let response;

  try {
    response = await fetch(`${API_BASE}/${endpoint}${queryString}`, {
      method,
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Could not reach the server. Check your internet connection and try again.");
  }

  let result = {};

  try {
    result = await response.json();
  } catch {
    // Non-JSON response (e.g. hosting error page)
  }

  if (!response.ok || result.success === false) {
    const error = new Error(result.message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }

  return result;
};
