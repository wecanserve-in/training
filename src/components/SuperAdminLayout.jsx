import { Link, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/superadminlayout.css";


function SuperAdminLayout() {
  const navigate = useNavigate();
  const [openLearning, setOpenLearning] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
const [userData, setUserData] = useState(null);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const closeMobileMenu = () => {
    setMobileOpen(false);
  };

  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const snapshot = await get(
          ref(database, `users/${user.uid}`)
        );

        if (snapshot.exists()) {
          setUserData(snapshot.val());
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    }
  });

  return () => unsubscribe();
}, []);

  return (
    <div className="super-layout">
      <div className="mobile-topbar">
        <img src="/Logo.webp" alt="Logo" />
        <button onClick={() => setMobileOpen(true)}>☰</button>
      </div>

      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`super-sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <button
          className="sidebar-close"
          onClick={() => setMobileOpen(false)}
        >
          ×
        </button>

        <div className="sidebar-logo-box">
          <img src="/Logo.webp" alt="Logo" />
        </div>

       <div className="sidebar-profile">
  <div className="profile-circle">
    {userData?.name
      ? userData.name
          .split(" ")
          .map((word) => word[0])
          .join("")
          .substring(0, 2)
          .toUpperCase()
      : "SA"}
  </div>

  <h3>{userData?.name || "Super Admin"}</h3>

  <p>{userData?.email || auth.currentUser?.email}</p>
</div>

        <nav className="sidebar-menu">
          <Link to="/super-admin" onClick={closeMobileMenu}>Dashboard</Link>
          <Link to="/super-admin/users" onClick={closeMobileMenu}>Users</Link>
          <Link to="/super-admin/admins" onClick={closeMobileMenu}>Admins</Link>
          <Link to="/super-admin/departments" onClick={closeMobileMenu}>Departments</Link>
          <Link to="/super-admin/analytics" onClick={closeMobileMenu}>Analytics</Link>

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
                <Link to="/super-admin/my-learnings" onClick={closeMobileMenu}>My Learnings</Link>
                <Link to="/super-admin/assigned-courses" onClick={closeMobileMenu}>Assigned Courses</Link>
                <Link to="/super-admin/my-results" onClick={closeMobileMenu}>My Results</Link>
                <Link to="/super-admin/certificates" onClick={closeMobileMenu}>Certificates</Link>
                <Link to="/super-admin/profile" onClick={closeMobileMenu}>Profile</Link>
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

export default SuperAdminLayout;