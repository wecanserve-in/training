import { Link, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

import { auth, database } from "../firebase";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import "../styles/superadminlayout.css";

function AdminLayout() {
  const navigate = useNavigate();
  const [openLearning, setOpenLearning] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const [currentUser, setCurrentUser] = useState(null);

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      setCurrentUser(null);
      return;
    }

    try {
      const snap = await get(ref(database, `users/${firebaseUser.uid}`));

      if (snap.exists()) {
        setCurrentUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          ...snap.val(),
        });
      } else {
        setCurrentUser({
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email,
          email: firebaseUser.email,
          role: "admin",
        });
      }
    } catch (error) {
      console.error("User profile fetch error:", error);

      setCurrentUser({
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email,
        email: firebaseUser.email,
        role: "admin",
      });
    }
  });

  return () => unsubscribe();
}, []);

  const closeMobileMenu = () => {
    setMobileOpen(false);
  };

  return (
    <div className="super-layout">
      <div className="mobile-topbar">
        <img src="/Logo.webp" alt="Logo" />
        <button onClick={() => setMobileOpen(true)}>☰</button>
      </div>

      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`super-sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <button className="sidebar-close" onClick={() => setMobileOpen(false)}>
          ×
        </button>

        <div className="sidebar-logo-box">
          <img src="/Logo.webp" alt="Logo" />
        </div>

      <div className="sidebar-profile">
  <div className="profile-circle">
    {(currentUser?.name || currentUser?.email || "A")
      .charAt(0)
      .toUpperCase()}
  </div>

  <h3>{currentUser?.name || currentUser?.email || "Admin"}</h3>

  <p>{currentUser?.email || "Loading user..."}</p>

  <p>
    {currentUser?.designation ||
      (currentUser?.role === "admin"
        ? "Admin"
        : currentUser?.role === "departmentAdmin"
        ? "Department Admin"
        : "User")}
  </p>
</div>
        <nav className="sidebar-menu">
          <Link to="/admin" onClick={closeMobileMenu}>Dashboard</Link>
          <Link to="/admin/users" onClick={closeMobileMenu}>Add Users</Link>
          <Link to="/admin/departments" onClick={closeMobileMenu}>Manage Departments</Link>
          <Link to="/admin/courses" onClick={closeMobileMenu}>Courses</Link>
          <Link to="/admin/assignments" onClick={closeMobileMenu}>Assignments</Link>
          <Link to="/admin/analytics" onClick={closeMobileMenu}>Analytics</Link>
          <Link to="/admin/results" onClick={closeMobileMenu}>Reports</Link>

          <div className="sidebar-dropdown">
            <button
              type="button"
              className="dropdown-toggle"
              onClick={() => setOpenLearning(!openLearning)}
            >
              My Learnings
            </button>

            {openLearning && (
              <div className="dropdown-submenu">
                <Link to="/admin/my-learnings" onClick={closeMobileMenu}>My Learnings</Link>
                <Link to="/admin/assigned-courses" onClick={closeMobileMenu}>Assigned Courses</Link>
                <Link to="/admin/my-results" onClick={closeMobileMenu}>My Results</Link>
                <Link to="/admin/certificates" onClick={closeMobileMenu}>Certificates</Link>
                <Link to="/admin/profile" onClick={closeMobileMenu}>Profile</Link>
              </div>
            )}
          </div>
        </nav>

        <button className="sidebar-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="super-page">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;