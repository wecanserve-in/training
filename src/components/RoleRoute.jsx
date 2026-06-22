import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";

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

        const snap = await get(ref(database, `users/${currentUser.uid}`));

        if (snap.exists()) {
          const data = snap.val();

          console.log("CURRENT USER DATA:", data);
          console.log("CURRENT ROLE:", data.role);
          console.log("ALLOWED ROLES:", allowedRoles);

          setUserData(data);
        } else {
          console.log("USER PROFILE NOT FOUND");
          setUserData(null);
        }
      } catch (error) {
        console.error("ROLE CHECK ERROR:", error);
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
    return <h2>User profile not found. Contact admin.</h2>;
  }

  const userRole = String(userData.role || "").trim();

  const normalizedUserRole = userRole.toLowerCase();

  const normalizedAllowedRoles = allowedRoles.map((role) =>
    String(role).trim().toLowerCase()
  );

  if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
    return (
      <div style={{ padding: "40px" }}>
        <h2>Access Denied.</h2>
        <p>
          Your role is: <strong>{userRole || "No role found"}</strong>
        </p>
        <p>
          Allowed roles: <strong>{allowedRoles.join(", ")}</strong>
        </p>
      </div>
    );
  }

  return children;
}

export default RoleRoute;