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
    assignedCourses: 0,
    completed: 0,
    certificates: 0,
    pending: 0,
    completionRate: 0,
  });

  const [recentCourses, setRecentCourses] = useState([]);
  const [departmentRows, setDepartmentRows] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [
          usersSnap,
          coursesSnap,
          completedSnap,
          resultsSnap,
          assignmentsSnap,
        ] = await Promise.all([
          get(ref(database, "users")),
          get(ref(database, "courses")),
          get(ref(database, "completedCourses")),
          get(ref(database, "results")),
          get(ref(database, "userAssignments")),
        ]);

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

        const admins = usersArr.filter(
          (user) => user.role === "admin" || user.role === "departmentAdmin"
        ).length;

        const departmentSet = new Set();

        normalUsers.forEach((user) => {
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

        const deptMap = {};

        normalUsers.forEach((user) => {
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

          const userAssignments =
            assignmentsData[user.uid] || assignmentsData[user.id] || {};

          const userCompleted =
            completedData[user.uid] || completedData[user.id] || {};

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
          .sort((a, b) => b.rate - a.rate)
          .slice(0, 4);

        const courseRows = coursesArr.slice(0, 2).map((course) => {
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

        setAlerts([
          {
            label: "Pending Courses",
            value: pending,
            type: "warning",
          },
          {
            label: "Completion Rate",
            value: `${completionRate}%`,
            type: completionRate < 50 ? "warning" : "success",
          },
          {
            label: "Certificates Issued",
            value: certificates,
            type: "success",
          },
        ]);

        setActivity([
          `${totalUsers} users registered`,
          `${coursesArr.length} courses available`,
          `${assignedCourses} courses assigned`,
          `${completed} courses completed`,
          `${certificates} certificates issued`,
        ]);
      } catch (error) {
        console.error("Super admin dashboard error:", error);
      }
    };

    fetchStats();
  }, []);

  const maxChartValue = Math.max(
    ...recentCourses.map((course) =>
      Math.max(course.assigned, course.completed, course.pending)
    ),
    1
  );

  return (
    <div className="super-dashboard">
      <section className="dash-header">
        <div>
          <h1>Super Admin Dashboard</h1>
          <p>Manage users, courses, departments and training progress from one place.</p>

          <div className="header-actions">
            <Link to="/super-admin/users">Manage Users</Link>
            <Link to="/super-admin/courses">Manage Courses</Link>
          </div>
        </div>

        {/* <div className="header-summary">
          <span>Overall Completion</span>
          <strong>{stats.completionRate}%</strong>
        </div> */}
      </section>

      <section className="dashboard-main-grid no-stats-grid">
        <div className="dash-card chart-card">
          <div className="card-head">
            <div>
              <h2>Training Progress</h2>
             {/* <p>Latest 2 course-wise assignment and completion status</p> */}
            </div>

            <Link to="/super-admin/analytics">View Analytics</Link>
          </div>

          <div className="course-progress-list">
  {recentCourses.length === 0 ? (
    <p className="empty-text">No course data available yet.</p>
  ) : (
    recentCourses.map((course) => (
      <div className="course-progress-item" key={course.id}>
        <div className="course-progress-top">
          <div>
            <h3>{course.title}</h3>
            <p>{course.department}</p>
          </div>

          <strong>{course.progress}%</strong>
        </div>

        <div className="course-progress-track">
          <span style={{ width: `${course.progress}%` }}></span>
        </div>

        <div className="course-progress-meta">
          <span>Assigned: {course.assigned}</span>
          <span>Completed: {course.completed}</span>
          <span>Pending: {course.pending}</span>
        </div>
      </div>
    ))
  )}
</div>
     
        </div>

        <div className="dash-card circle-card">
          <h2>Completion Rate</h2>

          <div
            className="circle-progress"
            style={{ "--progress": `${stats.completionRate}%` }}
          >
            <div>{stats.completionRate}%</div>
          </div>

          <p>
            {stats.completed} of {stats.assignedCourses} assigned courses completed
          </p>
        </div>

        <div className="dash-card quick-card">
          <h2>Quick Actions</h2>

          <div className="quick-actions">
            <Link to="/super-admin/users">Add / Manage Users</Link>
            <Link to="/super-admin/courses">Add / Manage Courses</Link>
            <Link to="/super-admin/departments">Departments</Link>
            <Link to="/super-admin/analytics">Reports & Analytics</Link>
          </div>
        </div>
      </section>

      <section className="dashboard-content-grid">
        <div className="dash-card table-card recent-courses-card">
          <div className="card-head">
            <div>
              <h2>Recent Courses</h2>
              <p>Latest 3 course-wise assignment and completion status</p>
            </div>

            <Link to="/super-admin/courses">View All</Link>
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
                {recentCourses.length === 0 ? (
                  <tr>
                    <td colSpan="6">No courses available yet.</td>
                  </tr>
                ) : (
                  recentCourses.map((course) => (
                    <tr key={course.id}>
                      <td>{course.title}</td>
                      <td>{course.department}</td>
                      <td>{course.assigned}</td>
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
        </div>
      </section>

      <section className="dashboard-bottom-row">
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
                  <span>
                    {index + 1}. {item.department}
                  </span>
                  <strong>{item.rate}%</strong>
                </div>

                <div className="dept-track">
                  <span style={{ width: `${item.rate}%` }}></span>
                </div>
              </div>
            ))
          )}
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
      </section>
    </div>
  );
}

export default SuperAdminDashboard;