import { Link, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

function DepartmentAdminLayout() {
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
          <div className="profile-circle">DA</div>
          <h3>Department Admin</h3>
          <p>Department Training Lead</p>
        </div>

        <nav className="sidebar-menu">
          <Link to="/department-admin">Dashboard</Link>
          <Link to="/department-admin/members">Members</Link>
          <Link to="/department-admin/courses">Courses</Link>
          <Link to="/department-admin/assignments">Assign Training</Link>
          <Link to="/department-admin/analytics">Analytics</Link>
          <Link to="/department-admin/reports">Reports</Link>
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

export default DepartmentAdminLayout;