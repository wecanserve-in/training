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
      if (!currentUser) {
        setIsLoggedIn(false);
        setChecking(false);
        return;
      }

      setIsLoggedIn(true);

      const snap = await get(ref(database, `users/${currentUser.uid}`));

      if (snap.exists()) {
        setUserData(snap.val());
      }

      setChecking(false);
    });

    return () => unsubscribe();
  }, []);

  if (checking) return <h2>Checking access...</h2>;

  if (!isLoggedIn) return <Navigate to="/" />;

  if (!userData) {
    return <h2>User profile not found. Contact admin.</h2>;
  }

  if (!allowedRoles.includes(userData.role)) {
    return <h2>Access Denied.</h2>;
  }

  return children;
}

export default RoleRoute;