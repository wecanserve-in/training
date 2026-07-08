import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import {
  canAccessRoles,
  formatRoleLabel,
  loadUserProfile,
} from "../lib/userAccess";

function RoleRoute({ children, allowedRoles }) {
  const [checking, setChecking] = useState(true);
  const [userData, setUserData] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (!currentUser) {
          setIsLoggedIn(false);
          setUserData(null);
          setChecking(false);
          return;
        }

        setIsLoggedIn(true);
        setUserData(await loadUserProfile(currentUser));
      } catch (error) {
        console.error("Role check failed:", error);
        setUserData(null);
      } finally {
        setChecking(false);
      }
    });

    return () => unsubscribe();
  }, [allowedRoles]);

  if (checking) return <h2>Checking access...</h2>;

  if (!isLoggedIn) return <Navigate to="/" replace />;

  if (!userData) {
    return (
      <h2 style={{ padding: "32px" }}>
        User profile not found. Contact admin.
      </h2>
    );
  }

  if (!canAccessRoles(userData.role, allowedRoles)) {
    return (
      <div style={{ padding: "40px" }}>
        <h2>Access Denied.</h2>
        <p>
          Your role is: <strong>{formatRoleLabel(userData.role)}</strong>
        </p>
        <p>
          Allowed roles: <strong>{allowedRoles.join(", ")}</strong>
        </p>
        <p>Use the appropriate portal for your role.</p>
      </div>
    );
  }

  return children;
}

export default RoleRoute;