import { Link, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

function SuperAdminLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <div className="super-layout">
      <aside className="super-sidebar">
        <div className="sidebar-logo-box">
          <img src="/Logo.webp" alt="Logo" />
        </div>

        <div className="sidebar-profile">
          <div className="profile-circle">SA</div>
          <h3>Super Admin</h3>
          <p>wemedialabs@gmail.com</p>
        </div>

        <nav className="sidebar-menu">
          <Link to="/super-admin">Dashboard</Link>
          <Link to="/super-admin/users">Users</Link>
          <Link to="/super-admin/admins">Admins</Link>
          <Link to="/super-admin/departments">Departments</Link>
          <Link to="/super-admin/assignments">Assignments</Link>
          <Link to="/super-admin/analytics">Analytics</Link>
          <Link to="/super-admin/reports">Reports</Link>
          <Link to="/dashboard">My Learnings</Link>
        </nav>

        <button
          className="sidebar-logout"
          onClick={handleLogout}
        >
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