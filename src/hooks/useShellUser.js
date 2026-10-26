import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { loadUserProfile } from "../lib/userAccess";

/**
 * The signed-in user's profile for the app frame.
 * Redirects to the login page when signed out, and picks up
 * "profile-updated" events (e.g. a new photo) without a reload.
 */
export default function useShellUser() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        navigate("/");
        return;
      }

      try {
        setUser(await loadUserProfile(firebaseUser));
      } catch (error) {
        console.error("Failed to load profile:", error);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const handleProfileUpdated = (event) => {
      setUser((previous) => ({ ...previous, ...event.detail }));
    };

    window.addEventListener("profile-updated", handleProfileUpdated);
    return () => window.removeEventListener("profile-updated", handleProfileUpdated);
  }, []);

  const logout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return { user, logout };
}
