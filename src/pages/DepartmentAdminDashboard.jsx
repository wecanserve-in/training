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
  <div className="dept-dashboard-page">
    <div className="dept-dashboard-header">
      <div>
        <h1>Dashboard</h1>
        <h2>Welcome back, {currentUser?.name || "Department Admin"}</h2>
        <p>Here is what is happening with your training programs.</p>
      </div>

      <div className="dept-header-actions">
        <button>Export Report</button>
      </div>
    </div>

    <div className="dept-kpi-grid">
      <div className="dept-kpi-card">
        <span>Total Courses</span>
        <h3>{stats.courses}</h3>
        <p>Department courses</p>
      </div>

      <div className="dept-kpi-card">
        <span>Assigned Learners</span>
        <h3>{stats.members}</h3>
        <p>Active department users</p>
      </div>

      <div className="dept-kpi-card">
        <span>Completed</span>
        <h3>{stats.completed}</h3>
        <p>Total completed trainings</p>
      </div>

      <div className="dept-kpi-card">
        <span>Pending</span>
        <h3>{stats.pending}</h3>
        <p>Pending completions</p>
      </div>

      <div className="dept-kpi-card">
        <span>Completion Rate</span>
        <h3>{stats.completionRate}%</h3>
        <p>Overall progress</p>
      </div>
    </div>

    <div className="dept-main-layout">
      <div className="dept-large-card">
        <div className="dept-section-head">
          <h2>Course Progress Overview</h2>
          <Link to="/department-admin/analytics">View All</Link>
        </div>

        <div className="dept-table">
          <div className="dept-table-head">
            <span>Course Name</span>
            <span>Assigned</span>
            <span>Completed</span>
            <span>Pending</span>
            <span>Completion</span>
          </div>

          <div className="dept-table-row">
            <strong>Product Knowledge</strong>
            <span>{stats.members}</span>
            <span>{stats.completed}</span>
            <span>{stats.pending}</span>
            <div className="dept-progress-line">
              <b>{stats.completionRate}%</b>
              <div><span style={{ width: `${stats.completionRate}%` }}></span></div>
            </div>
          </div>
        </div>

        <Link to="/department-admin/courses" className="dept-outline-btn">
          View All Courses
        </Link>
      </div>

      <div className="dept-side-column">
        <div className="dept-small-card">
          <div className="dept-section-head">
            <h2>Quick Actions</h2>
          </div>

          <div className="dept-quick-actions">
            <Link to="/department-admin/courses/create">Create Course</Link>
            <Link to="/department-admin/assignments">Assign Course</Link>
            <Link to="/department-admin/members">Manage Learners</Link>
            <Link to="/department-admin/analytics">View Reports</Link>
          </div>
        </div>

        <div className="dept-small-card">
          <h2>Access Scope</h2>
          <p>You can manage only users, courses and reports linked to:</p>
          <strong>{stats.department}</strong>
        </div>
      </div>
    </div>
  </div>
);
}

export default DepartmentAdminDashboard;