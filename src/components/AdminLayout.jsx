import { Link, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

function AdminLayout() {
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
          <div className="profile-circle">AD</div>
          <h3>Admin</h3>
          <p>Training Operations</p>
        </div>

        <nav className="sidebar-menu">
          <Link to="/admin">Dashboard</Link>
          <Link to="/admin/users">Users</Link>
          <Link to="/admin/departments">Departments</Link>
          <Link to="/admin/courses">Courses</Link>
          <Link to="/admin/assignments">Assignments</Link>
          <Link to="/admin/analytics">Analytics</Link>
          <Link to="/admin/results">Reports</Link>
          <Link to="/dashboard">My Learnings</Link>
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