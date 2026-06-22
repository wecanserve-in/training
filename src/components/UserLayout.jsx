import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

function UserLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <div className="learner-shell">
      <aside className="learner-side-nav">
        <div className="learner-brand">
          <img src="/Logo.webp" alt="Logo" />
          <div>
            <h2>Zuvius</h2>
            <p>Learner Portal</p>
          </div>
        </div>

        <nav className="learner-nav-menu">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/assigned-courses">My Courses</NavLink>
          <NavLink to="/my-results">My Results</NavLink>
          <NavLink to="/certificates">Certificates</NavLink>
          <NavLink to="/my-learnings">My Learnings</NavLink>
          <NavLink to="/profile">Profile</NavLink>
        </nav>

        <button className="learner-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="learner-main-area">
        <Outlet />
      </main>
    </div>
  );
}

export default UserLayout;