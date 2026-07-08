import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ref, get } from "firebase/database";
import { database } from "../firebase";
import "../styles/superadmin.css";

function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    activeUsers: 0,
    admins: 0,
    departments: 0,
    courses: 0,
    assignedCourses: 0,
    completed: 0,
    certificates: 0,
    pending: 0,
    completionRate: 0,
    certificateRate: 0,
  });

  const [recentTrainings, setRecentTrainings] = useState([]);
  const [departmentRows, setDepartmentRows] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      const usersSnap = await get(ref(database, "users"));
      const coursesSnap = await get(ref(database, "courses"));
      const completedSnap = await get(ref(database, "completedCourses"));
      const resultsSnap = await get(ref(database, "results"));
      const assignmentsSnap = await get(ref(database, "userAssignments"));

      const usersData = usersSnap.exists() ? usersSnap.val() : {};
      const coursesData = coursesSnap.exists() ? coursesSnap.val() : {};
      const completedData = completedSnap.exists() ? completedSnap.val() : {};
      const resultsData = resultsSnap.exists() ? resultsSnap.val() : {};
      const assignmentsData = assignmentsSnap.exists() ? assignmentsSnap.val() : {};

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
      const activeUsers = normalUsers.filter((user) => user.status !== "inactive").length;
      const admins = usersArr.filter((user) => user.role === "admin").length;
      const departmentAdmins = usersArr.filter((user) => user.role === "departmentAdmin").length;

      const departmentSet = new Set();
      usersArr.forEach((user) => {
        if (user.department) departmentSet.add(user.department);
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

      const certificateRate =
        completed > 0 ? Math.min(Math.round((certificates / completed) * 100), 100) : 0;

      const deptMap = {};

      usersArr.forEach((user) => {
        const dept = user.department || "Not Assigned";

        if (!deptMap[dept]) {
          deptMap[dept] = {
            department: dept,
            users: 0,
            assigned: 0,
            completed: 0,
          };
        }

        deptMap[dept].users += 1;

        const userAssignments = assignmentsData[user.uid] || assignmentsData[user.id] || {};
        const userCompleted = completedData[user.uid] || completedData[user.id] || {};

        deptMap[dept].assigned += Object.values(userAssignments).filter(
          (item) => item?.assigned
        ).length;

        deptMap[dept].completed += Object.keys(userCompleted || {}).length;
      });

      const deptRows = Object.values(deptMap)
        .map((item) => ({
          ...item,
          rate:
            item.assigned > 0
              ? Math.min(Math.round((item.completed / item.assigned) * 100), 100)
              : 0,
        }))
        .filter((item) => item.assigned > 0)
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 5);

      const trainingRows = coursesArr.slice(0, 5).map((course) => {
        let enrolled = 0;
        let courseCompleted = 0;

        Object.entries(assignmentsData).forEach(([, userAssignments]) => {
          if (userAssignments?.[course.id]?.assigned) enrolled += 1;
        });

        Object.values(completedData).forEach((userCourses) => {
          if (userCourses?.[course.id]) courseCompleted += 1;
        });

        const progress =
          enrolled > 0 ? Math.min(Math.round((courseCompleted / enrolled) * 100), 100) : 0;

        return {
          id: course.id,
          title: course.title || course.name || "Untitled Course",
          department: course.department || "General",
          enrolled,
          completed: courseCompleted,
          progress,
          status: course.status || "Active",
        };
      });

      setStats({
        users: totalUsers,
        activeUsers,
        admins,
        departments: departmentSet.size,
        courses: coursesArr.length,
        assignedCourses,
        completed,
        certificates,
        pending,
        completionRate,
        certificateRate,
      });

      setRecentTrainings(trainingRows);
      setDepartmentRows(deptRows);

      setAlerts([
        {
          label: "Pending Courses",
          value: pending,
          type: "warning",
        },
        {
          label: "Department Admins",
          value: departmentAdmins,
          type: "info",
        },
        {
          label: "Certificates Issued",
          value: certificates,
          type: "success",
        },
      ]);

      setActivity([
        `${totalUsers} total users`,
        `${coursesArr.length} active courses`,
        `${assignedCourses} assigned courses`,
        `${completed} completed courses`,
        `${certificates} certificates generated`,
      ]);
    };

    fetchStats();
  }, []);

  return (
    <div className="super-dashboard">
      <section className="dash-header">
        <div>
          <h1>Welcome back, Super Admin!</h1>
          <p>Here’s what’s happening with your training portal.</p>
        </div>

        <div className="date-pill">Training Overview</div>
      </section>

      <section className="metric-grid">
        <MetricCard title="Total Users" value={stats.users} color="blue" />
        <MetricCard title="Active Users" value={stats.activeUsers} color="green" />
        <MetricCard title="Total Courses" value={stats.courses} color="purple" />
        <MetricCard title="Completed Courses" value={stats.completed} color="teal" />
        <MetricCard title="Certificates Issued" value={stats.certificates} color="orange" />
        <MetricCard title="Pending Courses" value={stats.pending} color="red" />
      </section>

      <section className="dashboard-main-grid">
        <div className="dash-card chart-card">
          <div className="card-head">
            <div>
              <h2>Training Progress Overview</h2>
              <p>Completed vs pending course progress</p>
            </div>
          </div>

          <div className="line-chart">
            <svg viewBox="0 0 640 260" preserveAspectRatio="none">
              <polyline
                points="20,210 120,180 220,145 320,125 420,105 520,85 620,55"
                fill="none"
                stroke="#34a853"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points="20,225 120,205 220,190 320,175 420,165 520,145 620,120"
                fill="none"
                stroke="#4285f4"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="chart-legend">
            <span className="green-dot">Completed</span>
            <span className="blue-dot">Pending</span>
          </div>
        </div>

        <div className="dash-card circle-card">
          <h2>Course Completion Rate</h2>

          <div className="circle-progress">
            <div>{stats.completionRate}%</div>
          </div>

          <p>{stats.completed} of {stats.assignedCourses} assigned courses completed</p>
        </div>

        <div className="dash-card department-card">
          <h2>Top Departments</h2>

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

          <Link to="/super-admin/analytics" className="view-link">
            View full analytics
          </Link>
        </div>
      </section>

      <section className="dashboard-lower-grid">
        <div className="dash-card table-card">
          <div className="card-head">
            <div>
              <h2>Recent Courses</h2>
              <p>Course-wise assignment and completion overview</p>
            </div>
          </div>

          <div className="training-table-wrap">
            <table className="training-table">
              <thead>
                <tr>
                  <th>Course Name</th>
                  <th>Department</th>
                  <th>Assigned</th>
                  <th>Completed</th>
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {recentTrainings.length === 0 ? (
                  <tr>
                    <td colSpan="6">No courses available yet.</td>
                  </tr>
                ) : (
                  recentTrainings.map((course) => (
                    <tr key={course.id}>
                      <td>{course.title}</td>
                      <td>{course.department}</td>
                      <td>{course.enrolled}</td>
                      <td>{course.completed}</td>
                      <td>
                        <div className="mini-progress">
                          <span style={{ width: `${course.progress}%` }}></span>
                        </div>
                        <b>{course.progress}%</b>
                      </td>
                      <td>
                        <em>{course.status}</em>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Link to="/super-admin/analytics" className="table-link">
            View all courses
          </Link>
        </div>

        <div className="side-stack">
          <div className="dash-card small-card">
            <div className="card-title-row">
              <h2>System Alerts</h2>
              <Link to="/super-admin/analytics">View all</Link>
            </div>

            {alerts.map((alert) => (
              <div className={`alert-row ${alert.type}`} key={alert.label}>
                <span>{alert.label}</span>
                <strong>{alert.value}</strong>
              </div>
            ))}
          </div>

          <div className="dash-card small-card">
            <div className="card-title-row">
              <h2>Recent Activity</h2>
              <Link to="/super-admin/analytics">View all</Link>
            </div>

            {activity.map((item) => (
              <div className="activity-row" key={item}>
                <span></span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ title, value, color }) {
  return (
    <div className={`metric-card ${color}`}>
      <p>{title}</p>
      <h2>{value}</h2>
    </div>
  );
}

export default SuperAdminDashboard;