import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/departmentadmin.css";

function DepartmentAdminDashboard() {
  const [currentUser, setCurrentUser] = useState(null);

  const [stats, setStats] = useState({
    department: "",
    members: 0,
    courses: 0,
    completed: 0,
    certificates: 0,
    pending: 0,
    completionRate: 0,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) return;

      const userSnap = await get(ref(database, `users/${loggedUser.uid}`));

      if (!userSnap.exists()) return;

      const userData = {
        id: loggedUser.uid,
        ...userSnap.val(),
      };

      setCurrentUser(userData);

      const departmentName = userData.department;

      const usersSnap = await get(ref(database, "users"));
      const coursesSnap = await get(ref(database, "courses"));
      const completedSnap = await get(ref(database, "completedCourses"));
      const resultsSnap = await get(ref(database, "results"));

      let departmentMembers = [];

      if (usersSnap.exists()) {
        departmentMembers = Object.entries(usersSnap.val())
          .map(([id, user]) => ({ id, ...user }))
          .filter((user) => user.department === departmentName);
      }

      let departmentCourses = [];

      if (coursesSnap.exists()) {
        departmentCourses = Object.entries(coursesSnap.val())
          .map(([id, course]) => ({ id, ...course }))
          .filter((course) => course.department === departmentName);
      }

      let completed = 0;
      let certificates = 0;

      const completedData = completedSnap.exists() ? completedSnap.val() : {};
      const resultData = resultsSnap.exists() ? resultsSnap.val() : {};

      departmentMembers.forEach((member) => {
        if (completedData[member.id]) {
          completed += Object.keys(completedData[member.id]).length;
        }

        if (resultData[member.id]) {
          certificates += Object.values(resultData[member.id]).filter(
            (result) => result.passed
          ).length;
        }
      });

      const totalPossible = departmentMembers.length * departmentCourses.length;

      const completionRate =
        totalPossible > 0
          ? Math.round((completed / totalPossible) * 100)
          : 0;

      setStats({
        department: departmentName || "Your Department",
        members: departmentMembers.length,
        courses: departmentCourses.length,
        completed,
        certificates,
        pending: Math.max(totalPossible - completed, 0),
        completionRate,
      });
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      <div className="dept-admin-hero">
        <div>
          <span>Department Control Center</span>
          <h1>{stats.department} Dashboard</h1>
          <p>
            Manage department members, courses, assignments and training
            performance.
          </p>
        </div>

        <img src="/Logo.webp" alt="Logo" />
      </div>

      <div className="dept-admin-kpis">
        <div>
          <span>Members</span>
          <h2>{stats.members}</h2>
        </div>

        <div>
          <span>Courses</span>
          <h2>{stats.courses}</h2>
        </div>

        <div>
          <span>Completed</span>
          <h2>{stats.completed}</h2>
        </div>

        <div>
          <span>Pending</span>
          <h2>{stats.pending}</h2>
        </div>

        <div>
          <span>Certificates</span>
          <h2>{stats.certificates}</h2>
        </div>

        <div className="primary">
          <span>Completion</span>
          <h2>{stats.completionRate}%</h2>
        </div>
      </div>

      <div className="dept-admin-main-grid">
        <div className="dept-admin-card">
          <div className="dept-card-head">
            <span>Quick Actions</span>
            <h2>Department Operations</h2>
          </div>

          <div className="dept-action-grid">
            <Link to="/department-admin/members">
              <h3>Manage Members</h3>
              <p>Add, edit and manage users only from your department.</p>
              <strong>Open →</strong>
            </Link>

            <Link to="/department-admin/courses">
              <h3>Create Course</h3>
              <p>Create training modules only for your department.</p>
              <strong>Create →</strong>
            </Link>

            <Link to="/department-admin/assignments">
              <h3>Assign Training</h3>
              <p>Filter by role, zone, state, city and select users.</p>
              <strong>Assign →</strong>
            </Link>

            <Link to="/department-admin/analytics">
              <h3>Department Analytics</h3>
              <p>Track completion, pending trainings and certificates.</p>
              <strong>View →</strong>
            </Link>
          </div>
        </div>

        <div className="dept-admin-card progress-card">
          <div className="dept-card-head">
            <span>Progress</span>
            <h2>Training Completion</h2>
          </div>

          <div
            className="dept-progress-ring"
            style={{
              background: `conic-gradient(#006ee6 ${stats.completionRate}%, #e5eefc 0)`,
            }}
          >
            <div>{stats.completionRate}%</div>
          </div>

          <p>Overall training progress for {stats.department}.</p>
        </div>
      </div>

      <div className="dept-admin-bottom-grid">
        <div className="dept-admin-card">
          <h2>Recommended Workflow</h2>

          <div className="dept-workflow">
            <div>
              <strong>01</strong>
              <p>Manage Members</p>
            </div>

            <div>
              <strong>02</strong>
              <p>Create Course</p>
            </div>

            <div>
              <strong>03</strong>
              <p>Assign Training</p>
            </div>

            <div>
              <strong>04</strong>
              <p>Track Reports</p>
            </div>
          </div>
        </div>

        <div className="dept-admin-card">
          <h2>Access Scope</h2>

          <div className="scope-box">
            <p>
              You can only view and manage users, courses, assignments and
              reports linked to:
            </p>

            <strong>{stats.department}</strong>
          </div>
        </div>
      </div>
    </>
  );
}

export default DepartmentAdminDashboard;