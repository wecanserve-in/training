import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ref, get } from "firebase/database";
import { database } from "../firebase";
import "../styles/superadmin.css";

const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .replace(/[\s_-]/g, "")
    .toLowerCase();

const isManagedUser = (user) => {
  const role = normalizeRole(user?.role);
  return role === "user" || role === "departmentadmin" || role === "deptadmin";
};

const isAdmin = (user) => normalizeRole(user?.role) === "admin";

const isDepartmentAdmin = (user) => {
  const role = normalizeRole(user?.role);
  return role === "departmentadmin" || role === "deptadmin";
};

const isCourseActive = (course) => {
  const status = String(course?.status || "").trim().toLowerCase();

  // Manage Courses may contain no status field. Treat missing status as active.
  return !["inactive", "archived", "deleted", "draft"].includes(status);
};

const isAssignmentActive = (assignment) =>
  assignment === true ||
  assignment?.assigned === true ||
  assignment?.status === "assigned" ||
  assignment?.status === "active";

const isCourseCompleted = (record) =>
  record === true ||
  record?.completed === true ||
  record?.passed === true ||
  String(record?.status || "").toLowerCase() === "completed";

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
        const assignmentsData = assignmentsSnap.exists()
          ? assignmentsSnap.val()
          : {};
        const departmentsData = departmentsSnap.exists()
          ? departmentsSnap.val()
          : {};

        const usersArr = Object.entries(usersData).map(([id, user]) => ({
          id,
          uid: user?.uid || id,
          ...(user || {}),
        }));

        /*
         * IMPORTANT:
         * This exactly matches ManageUsers.fetchUsers():
         * role === "user" OR role === "departmentAdmin".
         * Role normalization also safely handles department_admin/deptAdmin variants.
         */
        const managedUsers = usersArr.filter(isManagedUser);
        const managedUserIds = new Set(
          managedUsers.flatMap((user) => [user.id, user.uid]).filter(Boolean)
        );

        const admins = usersArr.filter(isAdmin).length;
        const deptAdmins = usersArr.filter(isDepartmentAdmin).length;

        const coursesArr = Object.entries(coursesData)
          .map(([id, course]) => ({
            id,
            ...(course || {}),
          }))
          .filter(isCourseActive);

        const validCourseIds = new Set(coursesArr.map((course) => course.id));

        const departmentsArr = Object.entries(departmentsData)
          .map(([id, department]) => ({
            id,
            ...(department || {}),
          }))
          .filter((department) => {
            const status = String(department.status || "").toLowerCase();
            return !["inactive", "deleted", "archived"].includes(status);
          });

        /*
         * Build unique valid user-course assignments.
         * Invalid users, deleted courses and duplicate aliases are ignored.
         */
        const assignmentPairs = new Set();

        managedUsers.forEach((user) => {
          const byUid = assignmentsData[user.uid] || {};
          const byId =
            user.id !== user.uid ? assignmentsData[user.id] || {} : {};

          const mergedAssignments = {
            ...byId,
            ...byUid,
          };

          Object.entries(mergedAssignments).forEach(
            ([courseId, assignment]) => {
              if (
                validCourseIds.has(courseId) &&
                isAssignmentActive(assignment)
              ) {
                assignmentPairs.add(`${user.uid}::${courseId}`);
              }
            }
          );
        });

        /*
         * Build unique valid completions.
         * A completion is counted only when the user and course still exist.
         */
        const completionPairs = new Set();

        managedUsers.forEach((user) => {
          const byUid = completedData[user.uid] || {};
          const byId =
            user.id !== user.uid ? completedData[user.id] || {} : {};

          const mergedCompleted = {
            ...byId,
            ...byUid,
          };

          Object.entries(mergedCompleted).forEach(([courseId, record]) => {
            if (
              validCourseIds.has(courseId) &&
              isCourseCompleted(record)
            ) {
              completionPairs.add(`${user.uid}::${courseId}`);
            }
          });
        });

        /*
         * Certificates are unique per user + course.
         * First use completedCourses, then accept passed result records as fallback.
         */
        const certificatePairs = new Set();

        managedUsers.forEach((user) => {
          const completedByUser = {
            ...(completedData[user.id] || {}),
            ...(completedData[user.uid] || {}),
          };

          Object.entries(completedByUser).forEach(([courseId, record]) => {
            if (
              validCourseIds.has(courseId) &&
              (record?.certificateUrl ||
                record?.certificateId ||
                record?.certificateIssued ||
                (record?.passed && record?.attemptId))
            ) {
              certificatePairs.add(`${user.uid}::${courseId}`);
            }
          });

          const resultsByUser = {
            ...(resultsData[user.id] || {}),
            ...(resultsData[user.uid] || {}),
          };

          Object.values(resultsByUser).forEach((result) => {
            const courseId = result?.courseId;
            if (
              courseId &&
              validCourseIds.has(courseId) &&
              result?.passed
            ) {
              certificatePairs.add(`${user.uid}::${courseId}`);
            }
          });
        });

        const assignedCourses = assignmentPairs.size;
        const completed = completionPairs.size;
        const pending = Math.max(assignedCourses - completed, 0);
        const completionRate =
          assignedCourses > 0
            ? Math.min(
                100,
                Math.round((completed / assignedCourses) * 100)
              )
            : 0;

        const departmentNameById = Object.fromEntries(
          departmentsArr.map((department) => [
            department.id,
            department.name ||
              department.title ||
              department.departmentName ||
              "Unnamed Department",
          ])
        );

        const deptMap = {};

        managedUsers.forEach((user) => {
          const departmentId = user.departmentId || "";
          const departmentName =
            user.department ||
            departmentNameById[departmentId] ||
            "Not Assigned";

          const departmentKey =
            departmentId || `name:${departmentName.toLowerCase()}`;

          if (!deptMap[departmentKey]) {
            deptMap[departmentKey] = {
              department: departmentName,
              departmentId,
              users: 0,
              assigned: 0,
              completed: 0,
            };
          }

          deptMap[departmentKey].users += 1;

          coursesArr.forEach((course) => {
            const pair = `${user.uid}::${course.id}`;

            if (assignmentPairs.has(pair)) {
              deptMap[departmentKey].assigned += 1;
            }

            if (completionPairs.has(pair)) {
              deptMap[departmentKey].completed += 1;
            }
          });
        });

        const deptRows = Object.values(deptMap)
          .map((item) => ({
            ...item,
            rate:
              item.assigned > 0
                ? Math.min(
                    100,
                    Math.round((item.completed / item.assigned) * 100)
                  )
                : 0,
          }))
          .sort(
            (a, b) =>
              b.rate - a.rate ||
              b.users - a.users ||
              a.department.localeCompare(b.department)
          )
          .slice(0, 5);

        const courseRows = coursesArr
          .map((course) => {
            let assigned = 0;
            let courseCompleted = 0;

            managedUsers.forEach((user) => {
              const pair = `${user.uid}::${course.id}`;

              if (assignmentPairs.has(pair)) assigned += 1;
              if (completionPairs.has(pair)) courseCompleted += 1;
            });

            const coursePending = Math.max(
              assigned - courseCompleted,
              0
            );

            const progress =
              assigned > 0
                ? Math.min(
                    100,
                    Math.round((courseCompleted / assigned) * 100)
                  )
                : 0;

            return {
              id: course.id,
              title:
                course.title ||
                course.courseTitle ||
                course.name ||
                "Untitled Course",
              department:
                course.department ||
                departmentNameById[course.departmentId] ||
                "General",
              assigned,
              completed: courseCompleted,
              pending: coursePending,
              progress,
              status: course.status || "Active",
              createdAt: course.createdAt || course.updatedAt || "",
            };
          })
          .sort(
            (a, b) =>
              b.assigned - a.assigned ||
              new Date(b.createdAt || 0).getTime() -
                new Date(a.createdAt || 0).getTime()
          )
          .slice(0, 5);

        setStats({
          // Must match Manage Users "Total Users".
          users: managedUsers.length,
          admins,
          deptAdmins,
          departments: departmentsArr.length,
          courses: coursesArr.length,
          assignedCourses,
          completed,
          certificates: certificatePairs.size,
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
          value: certificatePairs.size,
          type: "success",
        });

        alertItems.push({
          label: "Managed Users",
          value: managedUsers.length,
          type: "success",
        });

        setAlerts(alertItems);
      } catch (error) {
        console.error("Super admin dashboard error:", error);
      } finally {
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
          <p>
            Manage users, courses, departments and training progress from one
            place.
          </p>

          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <strong>{stats.users}</strong>
                <span>Total Users</span>
              </div>
            </div>

            <div className="hero-stat">
              <div className="hero-stat-icon admins-icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              <div>
                <strong>{stats.admins}</strong>
                <span>Admins</span>
              </div>
            </div>

            <div className="hero-stat">
              <div className="hero-stat-icon dept-icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
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
        <Link
          to="/super-admin/courses"
          className="stat-card stat-courses"
        >
          <div className="stat-card-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div className="stat-card-info">
            <span>Active Courses</span>
            <strong>{stats.courses}</strong>
          </div>
        </Link>

        <Link
          to="/super-admin/analytics"
          className="stat-card stat-progress"
        >
          <div className="stat-card-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div className="stat-card-info">
            <span>In Progress</span>
            <strong>{stats.pending}</strong>
          </div>
        </Link>

        <Link
          to="/super-admin/analytics"
          className="stat-card stat-completed"
        >
          <div className="stat-card-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="stat-card-info">
            <span>Completed</span>
            <strong>{stats.completed}</strong>
          </div>
        </Link>

        <div className="stat-card stat-cert">
          <div className="stat-card-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="8" r="7" />
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
            </svg>
          </div>
          <div className="stat-card-info">
            <span>Certificates</span>
            <strong>{stats.certificates}</strong>
          </div>
        </div>

        <div className="stat-card stat-rate">
          <div className="stat-card-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 20V10" />
              <path d="M12 20V4" />
              <path d="M6 20v-6" />
            </svg>
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
                const colors = [
                  "#f59e0b",
                  "#3b82f6",
                  "#10b981",
                  "#8b5cf6",
                  "#ec4899",
                ];
                const letter =
                  course.title?.charAt(0)?.toUpperCase() || "C";

                return (
                  <div className="course-row" key={course.id}>
                    <div
                      className="course-avatar"
                      style={{ background: colors[i % colors.length] }}
                    >
                      {letter}
                    </div>

                    <div className="course-info">
                      <h3>{course.title}</h3>
                      <span>
                        {course.assigned} Assigned &bull;{" "}
                        {course.completed} Done
                      </span>
                    </div>

                    <div className="course-progress-wrap">
                      <div className="course-progress-bar">
                        <span
                          style={{ width: `${course.progress}%` }}
                        ></span>
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

          <Link
            to="/super-admin/courses"
            className="create-course-btn"
          >
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
            <strong>{stats.completed}</strong>
            <span>Completed Courses</span>
            <p>Users finishing training</p>
          </div>

          <div className="gradient-card-icon">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
        </div>

        <div className="gradient-card gradient-pink">
          <div className="gradient-card-content">
            <strong>{stats.courses}</strong>
            <span>Training Courses</span>
            <p>Available for learning</p>
          </div>

          <div className="gradient-card-icon">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
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
              <div
                className="dept-row"
                key={item.departmentId || item.department}
              >
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

        <div className="dash-card pass-card">
          <div className="card-title-row">
            <h2>Overall Completion %</h2>
          </div>

          <div className="pass-donut-wrap">
            <svg className="pass-donut" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="#e8f5ee"
                strokeWidth="12"
              />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="#22c55e"
                strokeWidth="12"
                strokeDasharray={`${stats.completionRate * 3.14} ${
                  314 - stats.completionRate * 3.14
                }`}
                strokeDashoffset="78.5"
                strokeLinecap="round"
              />
            </svg>

            <div className="pass-donut-center">
              <strong>{stats.completionRate}%</strong>
            </div>
          </div>

          <p>
            {stats.completed} of {stats.assignedCourses} completed
          </p>
        </div>

        <div className="dash-card alerts-card">
          <div className="card-title-row">
            <h2>System Alerts</h2>
          </div>

          {alerts.length === 0 ? (
            <p className="empty-text">No alerts.</p>
          ) : (
            alerts.map((alert) => (
              <div
                className={`alert-row ${alert.type}`}
                key={alert.label}
              >
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
