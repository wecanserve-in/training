import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

const ADMIN_EMAIL = "wemedialabs@gmail.com";

function AdminRoute({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setChecking(false);
    });

    return () => unsubscribe();
  }, []);

  if (checking) return <h2>Checking admin access...</h2>;

  if (!user) return <Navigate to="/" />;

  if (user.email !== ADMIN_EMAIL) {
    return <h2>Access Denied. Super Admin only.</h2>;
  }

  return children;
}

export default AdminRoute;