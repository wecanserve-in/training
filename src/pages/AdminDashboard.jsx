import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ref, get } from "firebase/database";
import { database } from "../firebase";
import "../styles/admindashboard.css";

function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [completedCourses, setCompletedCourses] = useState({});
  const [results, setResults] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [
          usersSnap,
          departmentsSnap,
          coursesSnap,
          completedSnap,
          resultsSnap,
          assignmentsSnap,
        ] = await Promise.all([
          get(ref(database, "users")),
          get(ref(database, "departments")),
          get(ref(database, "courses")),
          get(ref(database, "completedCourses")),
          get(ref(database, "results")),
          get(ref(database, "assignments")),
        ]);

        setUsers(
          usersSnap.exists()
            ? Object.entries(usersSnap.val()).map(([id, user]) => ({
                id,
                ...user,
              }))
            : []
        );

        setDepartments(
          departmentsSnap.exists()
            ? Object.entries(departmentsSnap.val()).map(([id, dept]) => ({
                id,
                ...dept,
              }))
            : []
        );

        setCourses(
          coursesSnap.exists()
            ? Object.entries(coursesSnap.val()).map(([id, course]) => ({
                id,
                ...course,
              }))
            : []
        );

        setCompletedCourses(completedSnap.exists() ? completedSnap.val() : {});
        setResults(resultsSnap.exists() ? resultsSnap.val() : {});

        setAssignments(
          assignmentsSnap.exists()
            ? Object.entries(assignmentsSnap.val()).map(([id, assignment]) => ({
                id,
                ...assignment,
              }))
            : []
        );
      } catch (error) {
        alert(error.message);
      }

      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  const employeeUsers = useMemo(() => {
    return users.filter((user) => user.role !== "superAdmin");
  }, [users]);

  const normalUsers = employeeUsers.filter((user) => user.role === "user");
  const admins = employeeUsers.filter((user) => user.role === "admin");
  const departmentAdmins = employeeUsers.filter(
    (user) => user.role === "departmentAdmin"
  );

  const getCompletedCount = (userId) => {
    if (!completedCourses[userId]) return 0;
    return Object.keys(completedCourses[userId]).length;
  };

  const getCertificateCount = (userId) => {
    if (!results[userId]) return 0;

    return Object.values(results[userId]).filter((result) => result.passed)
      .length;
  };

  

  const totalCompleted = employeeUsers.reduce(
    (total, user) => total + getCompletedCount(user.id),
    0
  );

  const totalCertificates = employeeUsers.reduce(
    (total, user) => total + getCertificateCount(user.id),
    0
  );

 
const totalAssignedTrainings = assignments.length;

const pendingTrainings = Math.max(
  totalAssignedTrainings - totalCompleted,
  0
);

const completionRate =
  totalAssignedTrainings > 0
    ? Math.round((totalCompleted / totalAssignedTrainings) * 100)
    : 0;
  

  const assignedCourses = assignments.length;

  const latestCourses = [...courses]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 4);

  const usersNeedingAttention = employeeUsers
    .map((user) => {
      const completed = getCompletedCount(user.id);
      const completion =
        courses.length > 0 ? Math.round((completed / courses.length) * 100) : 0;

      return {
        ...user,
        completed,
        completion,
      };
    })
    .filter((user) => user.completion < 100)
    .sort((a, b) => a.completion - b.completion)
    .slice(0, 5);

  const departmentSummary = departments.slice(0, 5);

  if (loading) {
    return (
      <div className="admin-loading-box">
        <h2>Loading dashboard...</h2>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-page">
      <div className="admin-topbar">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Real-time overview of users, courses, assignments and training progress.</p>
        </div>

        <img src="/Logo.webp" alt="Logo" />
      </div>

      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <span>Total Users</span>
          <h2>{employeeUsers.length}</h2>
        </div>

        <div className="admin-kpi-card">
          <span>Departments</span>
          <h2>{departments.length}</h2>
        </div>

        <div className="admin-kpi-card">
          <span>Total Courses</span>
          <h2>{courses.length}</h2>
        </div>

        <div className="admin-kpi-card">
          <span>Assigned Trainings</span>
          <h2>{assignedCourses}</h2>
        </div>

        <div className="admin-kpi-card">
          <span>Pending Trainings</span>
          <h2>{pendingTrainings}</h2>
        </div>

        <div className="admin-kpi-card primary">
          <span>Completion Rate</span>
          <h2>{completionRate}%</h2>
        </div>
      </div>

      <div className="admin-main-grid">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <span>Quick Actions</span>
            <h2>Training Operations</h2>
          </div>

          <div className="admin-action-grid">
            <Link to="/admin/users">
              <h3>Manage Users</h3>
              <p>Add employees, update details and reset passwords.</p>
              <strong>Open →</strong>
            </Link>

            <Link to="/admin/add-course">
              <h3>Create Course</h3>
              <p>Upload course videos, quiz and training content.</p>
              <strong>Create →</strong>
            </Link>

            <Link to="/admin/assignments">
              <h3>Assign Training</h3>
              <p>Assign courses by zone, state, city and designation.</p>
              <strong>Assign →</strong>
            </Link>

            <Link to="/admin/results">
              <h3>View Results</h3>
              <p>Track completion, quiz performance and certificates.</p>
              <strong>View →</strong>
            </Link>
          </div>
        </div>

        <div className="admin-panel progress-panel">
          <div className="admin-panel-head">
            <span>Progress</span>
            <h2>Company Training Status</h2>
          </div>

          <div className="progress-circle">
            <div>{completionRate}%</div>
          </div>

        <p>
  {totalCompleted} of {totalAssignedTrainings} assigned trainings completed.
</p>

          <div className="mini-stats">
            <div>
              <span>Completed</span>
              <strong>{totalCompleted}</strong>
            </div>

            <div>
              <span>Certificates</span>
              <strong>{totalCertificates}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-bottom-grid">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <span>People</span>
            <h2>User Breakdown</h2>
          </div>

          <div className="admin-breakdown-grid">
            <div>
              <span>Employees</span>
              <strong>{normalUsers.length}</strong>
            </div>

            <div>
              <span>Admins</span>
              <strong>{admins.length}</strong>
            </div>

            <div>
              <span>Department Admins</span>
              <strong>{departmentAdmins.length}</strong>
            </div>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <span>Attention</span>
            <h2>Users Needing Follow-up</h2>
          </div>

          <div className="admin-user-list">
            {usersNeedingAttention.map((user) => (
              <div className="admin-user-row" key={user.id}>
                <div>
                  <strong>{user.name || "Unnamed User"}</strong>
                  <span>{user.designation || "No designation"}</span>
                </div>

                <b>{user.completion}%</b>
              </div>
            ))}

            {usersNeedingAttention.length === 0 && (
              <p className="admin-empty-text">All users are fully completed.</p>
            )}
          </div>
        </div>
      </div>

      <div className="admin-bottom-grid">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <span>Departments</span>
            <h2>Department Admins</h2>
          </div>

          <div className="admin-user-list">
            {departmentSummary.map((dept) => (
              <div className="admin-user-row" key={dept.id}>
                <div>
                  <strong>{dept.departmentName || "-"}</strong>
                  <span>{dept.departmentAdminName || "No admin assigned"}</span>
                </div>

                <b>{dept.departmentAdminDesignation || "-"}</b>
              </div>
            ))}

            {departments.length === 0 && (
              <p className="admin-empty-text">No departments created yet.</p>
            )}
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <span>Courses</span>
            <h2>Latest Courses</h2>
          </div>

          <div className="admin-user-list">
            {latestCourses.map((course) => (
              <div className="admin-user-row" key={course.id}>
                <div>
                  <strong>{course.title || course.courseName || "Untitled Course"}</strong>
                  <span>{course.department || "General Training"}</span>
                </div>

                <b>{course.status || "Active"}</b>
              </div>
            ))}

            {courses.length === 0 && (
              <p className="admin-empty-text">No courses created yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;