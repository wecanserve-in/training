import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ref, get } from "firebase/database";
import { database } from "../firebase";
import "../styles/superadmin.css";

function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    admins: 0,
    deptAdmins: 0,
    departments: 0,
    courses: 0,
    assignedCourses: 0,
    completed: 0,
    certificates: 0,
    pending: 0,
    completionRate: 0,
  });

  const [recentCourses, setRecentCourses] = useState([]);
  const [departmentRows, setDepartmentRows] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [
          usersSnap,
          coursesSnap,
          completedSnap,
          resultsSnap,
          assignmentsSnap,
          departmentsSnap,
        ] = await Promise.all([
          get(ref(database, "users")),
          get(ref(database, "courses")),
          get(ref(database, "completedCourses")),
          get(ref(database, "results")),
          get(ref(database, "userAssignments")),
          get(ref(database, "departments")),
        ]);

        const usersData = usersSnap.exists() ? usersSnap.val() : {};
        const coursesData = coursesSnap.exists() ? coursesSnap.val() : {};
        const completedData = completedSnap.exists() ? completedSnap.val() : {};
        const resultsData = resultsSnap.exists() ? resultsSnap.val() : {};
        const assignmentsData = assignmentsSnap.exists() ? assignmentsSnap.val() : {};
        const departmentsData = departmentsSnap.exists() ? departmentsSnap.val() : {};

        const usersArr = Object.entries(usersData).map(([id, user]) => ({
          id,
          uid: user.uid || id,
          ...user,
        }));

        const coursesArr = Object.entries(coursesData).map(([id, course]) => ({
          id,
          ...course,
        }));

        const normalUsers = usersArr.filter(
          (user) => !["superAdmin", "superadmin"].includes(user.role)
        );

        const totalUsers = normalUsers.length;

        const admins = usersArr.filter(
          (user) => user.role === "admin"
        ).length;

        const deptAdmins = usersArr.filter(
          (user) => user.role === "departmentAdmin" || user.role === "deptAdmin"
        ).length;

        const departmentSet = new Set();

        normalUsers.forEach((user) => {
          const deptKey = user.departmentId || user.department;
          if (deptKey) departmentSet.add(deptKey);
        });

        let assignedCourses = 0;

        Object.values(assignmentsData).forEach((userAssignments) => {
          Object.values(userAssignments || {}).forEach((assignment) => {
            if (assignment?.assigned) assignedCourses += 1;
          });
        });

        let completed = 0;

        Object.values(completedData).forEach((userCourses) => {
          completed += Object.keys(userCourses || {}).length;
        });

        let certificates = 0;

        Object.values(resultsData).forEach((userResults) => {
          Object.values(userResults || {}).forEach((result) => {
            if (result?.passed) certificates += 1;
          });
        });

        const pending = Math.max(assignedCourses - completed, 0);

        const completionRate =
          assignedCourses > 0
            ? Math.min(Math.round((completed / assignedCourses) * 100), 100)
            : 0;

        const deptMap = {};

        normalUsers.forEach((user) => {
          const deptKey = user.departmentId || user.department || "Not Assigned";

          if (!deptMap[deptKey]) {
            deptMap[deptKey] = {
              department: user.department || "Not Assigned",
              departmentId: user.departmentId || "",
              users: 0,
              assigned: 0,
              completed: 0,
            };
          }

          deptMap[deptKey].users += 1;

          const userAssignments =
            assignmentsData[user.uid] || assignmentsData[user.id] || {};

          const userCompleted =
            completedData[user.uid] || completedData[user.id] || {};

          deptMap[deptKey].assigned += Object.values(userAssignments).filter(
            (item) => item?.assigned
          ).length;

          deptMap[deptKey].completed += Object.keys(userCompleted || {}).length;
        });

        const deptRows = Object.values(deptMap)
          .map((item) => ({
            ...item,
            rate:
              item.assigned > 0
                ? Math.min(Math.round((item.completed / item.assigned) * 100), 100)
                : 0,
          }))
          .sort((a, b) => b.rate - a.rate)
          .slice(0, 5);

        const courseRows = coursesArr.slice(0, 5).map((course) => {
          let assigned = 0;
          let courseCompleted = 0;

          Object.values(assignmentsData).forEach((userAssignments) => {
            if (userAssignments?.[course.id]?.assigned) assigned += 1;
          });

          Object.values(completedData).forEach((userCourses) => {
            if (userCourses?.[course.id]) courseCompleted += 1;
          });

          const coursePending = Math.max(assigned - courseCompleted, 0);

          const progress =
            assigned > 0
              ? Math.min(Math.round((courseCompleted / assigned) * 100), 100)
              : 0;

          return {
            id: course.id,
            title: course.title || course.name || "Untitled Course",
            department: course.department || "General",
            assigned,
            completed: courseCompleted,
            pending: coursePending,
            progress,
            status: course.status || "Active",
          };
        });

        setStats({
          users: totalUsers,
          admins,
          deptAdmins,
          departments: departmentSet.size,
          courses: coursesArr.length,
          assignedCourses,
          completed,
          certificates,
          pending,
          completionRate,
        });

        setRecentCourses(courseRows);
        setDepartmentRows(deptRows);

        const alertItems = [];

        if (pending > 0) {
          alertItems.push({
            label: "Pending Courses",
            value: pending,
            type: "warning",
          });
        }

        alertItems.push({
          label: "Completion Rate",
          value: `${completionRate}%`,
          type: completionRate < 50 ? "warning" : "success",
        });

        alertItems.push({
          label: "Certificates Issued",
          value: certificates,
          type: "success",
        });

        const deptsCount = Object.keys(departmentsData).length;
        if (deptsCount > 0 && departmentSet.size < deptsCount) {
          alertItems.push({
            label: "Departments",
            value: `${departmentSet.size} active`,
            type: "success",
          });
        }

        setAlerts(alertItems);
        setLoading(false);
      } catch (error) {
        console.error("Super admin dashboard error:", error);
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="super-loading">
        <h2>Loading dashboard...</h2>
      </div>
    );
  }

  return (
    <div className="super-dashboard">
      <section className="dash-hero">
        <div className="hero-content">
          <h1>Training Overview</h1>
          <p>Manage users, courses, departments and training progress from one place.</p>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <strong>{stats.users}</strong>
                <span>Users</span>
              </div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-icon admins-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </div>
              <div>
                <strong>{stats.admins}</strong>
                <span>Admins</span>
              </div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-icon dept-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <strong>{stats.deptAdmins}</strong>
                <span>Dept Admins</span>
              </div>
            </div>
          </div>
        </div>
        <div className="hero-decoration">
          <div className="hero-circle-1"></div>
          <div className="hero-circle-2"></div>
        </div>
      </section>

      <section className="dash-stat-cards">
        <Link to="/super-admin/courses" className="stat-card stat-courses">
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Active Courses</span>
            <strong>{stats.courses}</strong>
          </div>
        </Link>

        <Link to="/super-admin/analytics" className="stat-card stat-progress">
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div className="stat-card-info">
            <span>In Progress</span>
            <strong>{stats.pending}</strong>
          </div>
        </Link>

        <Link to="/super-admin/analytics" className="stat-card stat-completed">
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Completed</span>
            <strong>{stats.completed}</strong>
          </div>
        </Link>

        <div className="stat-card stat-cert">
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Certificates</span>
            <strong>{stats.certificates}</strong>
          </div>
        </div>

        <div className="stat-card stat-rate">
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Completion Rate</span>
            <strong>{stats.completionRate}%</strong>
          </div>
        </div>
      </section>

      <section className="dash-content-row">
        <div className="dash-card courses-card">
          <div className="card-head">
            <div>
              <h2>Popular Courses</h2>
              <p>Course-wise assignment and completion status</p>
            </div>
            <Link to="/super-admin/courses">All Courses</Link>
          </div>

          <div className="course-list">
            {recentCourses.length === 0 ? (
              <p className="empty-text">No course data available yet.</p>
            ) : (
              recentCourses.map((course, i) => {
                const colors = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"];
                const letter = course.title?.charAt(0)?.toUpperCase() || "C";
                return (
                  <div className="course-row" key={course.id}>
                    <div className="course-avatar" style={{ background: colors[i % colors.length] }}>
                      {letter}
                    </div>
                    <div className="course-info">
                      <h3>{course.title}</h3>
                      <span>{course.assigned} Assigned &bull; {course.completed} Done</span>
                    </div>
                    <div className="course-progress-wrap">
                      <div className="course-progress-bar">
                        <span style={{ width: `${course.progress}%` }}></span>
                      </div>
                      <strong>{course.progress}%</strong>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

                <div className="dash-card quick-card-side">
          <div className="quick-side-header">
            <h2>Have more data to share?</h2>
            <p>Create and manage training content</p>
          </div>

          <Link to="/super-admin/courses" className="create-course-btn">
            + Add New Course
          </Link>

          <div className="quick-mini-cards">
            <div className="quick-mini">
              <strong>{stats.assignedCourses}</strong>
              <span>Assigned</span>
            </div>
            <div className="quick-mini">
              <strong>{stats.departments}</strong>
              <span>Departments</span>
            </div>
          </div>
        </div>
      </section>

      <section className="dash-gradient-cards">
        <div className="gradient-card gradient-yellow">
          <div className="gradient-card-content">
            <strong>{stats.completed}+</strong>
            <span>Completed Courses</span>
            <p>Users finishing training</p>
          </div>
          <div className="gradient-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
        </div>

        <div className="gradient-card gradient-pink">
          <div className="gradient-card-content">
            <strong>{stats.courses}+</strong>
            <span>Training Courses</span>
            <p>Available for learning</p>
          </div>
          <div className="gradient-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
      </section>

      <section className="dash-bottom-row">
        <div className="dash-card department-card">
          <div className="card-title-row">
            <h2>Top Departments</h2>
            <Link to="/super-admin/analytics">View all</Link>
          </div>

          {departmentRows.length === 0 ? (
            <p className="empty-text">No department data yet.</p>
          ) : (
            departmentRows.map((item, index) => (
              <div className="dept-row" key={item.department}>
                <div>
                  <span>{index + 1}. {item.department}</span>
                  <strong>{item.rate}%</strong>
                </div>
                <div className="dept-track">
                  <span style={{ width: `${item.rate}%` }}></span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="dash-card pass-card">
          <div className="card-title-row">
            <h2>Overall Pass %</h2>
          </div>
          <div className="pass-donut-wrap">
            <svg className="pass-donut" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#e8f5ee" strokeWidth="12" />
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke="#22c55e"
                strokeWidth="12"
                strokeDasharray={`${stats.completionRate * 3.14} ${314 - stats.completionRate * 3.14}`}
                strokeDashoffset="78.5"
                strokeLinecap="round"
              />
            </svg>
            <div className="pass-donut-center">
              <strong>{stats.completionRate}%</strong>
            </div>
          </div>
          <p>{stats.completed} of {stats.assignedCourses} completed</p>
        </div>

        <div className="dash-card alerts-card">
          <div className="card-title-row">
            <h2>System Alerts</h2>
          </div>

          {alerts.length === 0 ? (
            <p className="empty-text">No alerts.</p>
          ) : (
            alerts.map((alert) => (
              <div className={`alert-row ${alert.type}`} key={alert.label}>
                <span>{alert.label}</span>
                <strong>{alert.value}</strong>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default SuperAdminDashboard;
