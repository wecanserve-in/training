import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ref, get } from "firebase/database";
import { database } from "../firebase";
import "../styles/superadmin.css";

function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    admins: 0,
    departments: 0,
    courses: 0,
    completed: 0,
    certificates: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const usersSnap = await get(ref(database, "users"));
      const coursesSnap = await get(ref(database, "courses"));
      const completedSnap = await get(ref(database, "completedCourses"));
      const resultsSnap = await get(ref(database, "results"));

      let users = 0;
      let admins = 0;
      const departmentsSet = new Set();

      if (usersSnap.exists()) {
        const userData = usersSnap.val();
        users = Object.keys(userData).length;

        Object.values(userData).forEach((user) => {
          if (user.role === "admin") admins += 1;
          if (user.department) departmentsSet.add(user.department);
        });
      }

      const courses = coursesSnap.exists()
        ? Object.keys(coursesSnap.val()).length
        : 0;

      let completed = 0;
      if (completedSnap.exists()) {
        Object.values(completedSnap.val()).forEach((userCourses) => {
          completed += Object.keys(userCourses).length;
        });
      }

      let certificates = 0;
      if (resultsSnap.exists()) {
        Object.values(resultsSnap.val()).forEach((userResults) => {
          Object.values(userResults).forEach((result) => {
            if (result.passed) certificates += 1;
          });
        });
      }

      setStats({
        users,
        admins,
        departments: departmentsSet.size,
        courses,
        completed,
        certificates,
      });
    };

    fetchStats();
  }, []);

  const totalPossibleCompletions = stats.users * stats.courses;

  const completionRate =
    totalPossibleCompletions > 0
      ? Math.min(
          Math.round((stats.completed / totalPossibleCompletions) * 100),
          100
        )
      : 0;

  const certificateRate =
    stats.completed > 0
      ? Math.min(Math.round((stats.certificates / stats.completed) * 100), 100)
      : 0;

  const adminCoverage =
    stats.departments > 0
      ? Math.min(Math.round((stats.admins / stats.departments) * 100), 100)
      : 0;

  return (
    <>
      <div className="super-topbar">
        <div className="super-brand">
          <div>
            <h1>Super Admin Dashboard</h1>
            <p>Overall company training control and analytics</p>
          </div>
        </div>

        <img src="/Logo.webp" alt="Logo" className="topbar-logo" />
      </div>

      <div className="super-kpi-grid">
        <div className="super-kpi">
          <span>Total Users</span>
          <h2>{stats.users}</h2>
        </div>

        <div className="super-kpi">
          <span>Admins</span>
          <h2>{stats.admins}</h2>
        </div>

        <div className="super-kpi">
          <span>Departments</span>
          <h2>{stats.departments}</h2>
        </div>

        <div className="super-kpi">
          <span>Courses</span>
          <h2>{stats.courses}</h2>
        </div>

        <div className="super-kpi">
          <span>Completed</span>
          <h2>{stats.completed}</h2>
        </div>

        <div className="super-kpi">
          <span>Certificates</span>
          <h2>{stats.certificates}</h2>
        </div>
      </div>

      <div className="super-main-grid">
        <div className="super-panel analytics-panel">
          <div className="panel-head">
            <span>Overall Analytics</span>
            <h2>Training Snapshot</h2>
          </div>

          <div className="analytics-mini-grid">
            <div className="snapshot-box">
              <strong>Zone Wise</strong>
              <p>Track training by zone</p>
              <div className="snapshot-percent">{completionRate}%</div>
              <div className="snapshot-progress">
                <span style={{ width: `${completionRate}%` }}></span>
              </div>
            </div>

            <div className="snapshot-box">
              <strong>State Wise</strong>
              <p>Check state-level progress</p>
              <div className="snapshot-percent">{certificateRate}%</div>
              <div className="snapshot-progress">
                <span style={{ width: `${certificateRate}%` }}></span>
              </div>
            </div>

            <div className="snapshot-box">
              <strong>City / Area Wise</strong>
              <p>Monitor local performance</p>
              <div className="snapshot-percent">{completionRate}%</div>
              <div className="snapshot-progress">
                <span style={{ width: `${completionRate}%` }}></span>
              </div>
            </div>

            <div className="snapshot-box">
              <strong>End User Wise</strong>
              <p>View user-wise reports</p>
              <div className="snapshot-percent">{adminCoverage}%</div>
              <div className="snapshot-progress">
                <span style={{ width: `${adminCoverage}%` }}></span>
              </div>
            </div>
          </div>
        </div>

        <div className="super-panel quick-panel">
          <div className="panel-head">
            <span>Quick Actions</span>
            <h2>Manage Portal</h2>
          </div>

          <div className="quick-actions">
            <Link to="/super-admin/users">Users</Link>
            <Link to="/super-admin/admins">Manage Admins</Link>
            <Link to="/super-admin/departments">Departments</Link>
            <Link to="/super-admin/analytics">View Reports</Link>
          </div>

          <div className="mini-graph-card">
            <div className="mini-graph-head">
              <div>
                <h3>Monthly Training Progress</h3>
                <p>Completion trend overview</p>
              </div>
              <span>{completionRate}%</span>
            </div>

            <div className="line-graph">
              <svg viewBox="0 0 320 150" preserveAspectRatio="none">
                <polyline
                  points="0,118 45,102 90,108 135,76 180,88 225,54 270,66 320,38"
                  fill="none"
                  stroke="#006ee6"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points="0,130 45,116 90,120 135,96 180,106 225,82 270,90 320,68"
                  fill="none"
                  stroke="#071d49"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.35"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="super-bottom-grid">
        <div className="super-panel">
          <h3>Important Checks</h3>

          <div className="check-row">
            <span>Admins Assigned</span>
            <strong>{stats.admins}</strong>
          </div>

          <div className="check-row">
            <span>Courses Available</span>
            <strong>{stats.courses}</strong>
          </div>

          <div className="check-row">
            <span>Certificates Generated</span>
            <strong>{stats.certificates}</strong>
          </div>
        </div>

        <div className="super-panel">
          <h3>System Flow</h3>

          <div className="flow-line">
            Super Admin → Admin → Department Admin → User
          </div>

          <p className="flow-note">
            Admin creates users and departments. Department Admin creates
            courses, assigns training and tracks completion.
          </p>
        </div>
      </div>
    </>
  );
}

export default SuperAdminDashboard;