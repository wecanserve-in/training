import { useEffect, useMemo, useState } from "react";
import { ref, get } from "firebase/database";
import { database } from "../firebase";
import "../styles/admindashboard.css";

function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [completedCourses, setCompletedCourses] = useState({});
  const [results, setResults] = useState({});
  const [assignments, setAssignments] = useState({});
  const [attempts, setAttempts] = useState([]);
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
          userAssignmentsSnap,
          oldAssignmentsSnap,
          attemptsSnap,
        ] = await Promise.all([
          get(ref(database, "users")),
          get(ref(database, "departments")),
          get(ref(database, "courses")),
          get(ref(database, "completedCourses")),
          get(ref(database, "results")),
          get(ref(database, "userAssignments")),
          get(ref(database, "assignments")),
          get(ref(database, "attempts")),
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
          userAssignmentsSnap.exists()
            ? userAssignmentsSnap.val()
            : oldAssignmentsSnap.exists()
            ? oldAssignmentsSnap.val()
            : {}
        );

        setAttempts(
          attemptsSnap.exists()
            ? Object.entries(attemptsSnap.val())
                .map(([id, attempt]) => ({ id, ...attempt }))
                .sort(
                  (a, b) =>
                    new Date(b.submittedAt || 0) -
                    new Date(a.submittedAt || 0)
                )
            : []
        );
      } catch (error) {
        console.error(error);
        alert(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getRole = (user) => String(user?.role || "").toLowerCase();

  const employeeUsers = useMemo(() => {
    return users.filter((user) => !["superadmin", "admin"].includes(getRole(user)));
  }, [users]);

  const learners = employeeUsers.filter(
    (user) => !["departmentadmin"].includes(getRole(user))
  );

  const departmentAdmins = employeeUsers.filter(
    (user) => getRole(user) === "departmentadmin"
  );

  const getAssignedCourseCount = (userId) => {
    const userAssignments = assignments?.[userId];
    if (!userAssignments || typeof userAssignments !== "object") return 0;
    return Object.keys(userAssignments).length;
  };

  const getCompletedCourseCount = (userId) => {
    const userCompleted = completedCourses?.[userId];
    if (!userCompleted || typeof userCompleted !== "object") return 0;
    return Object.keys(userCompleted).length;
  };

  const getCertificateCount = (userId) => {
    const userResults = results?.[userId];
    if (!userResults || typeof userResults !== "object") return 0;
    return Object.values(userResults).filter((result) => result?.passed).length;
  };

  const totalAssignedCourses = employeeUsers.reduce(
    (total, user) => total + getAssignedCourseCount(user.id),
    0
  );

  const totalCompletedCourses = employeeUsers.reduce(
    (total, user) => total + getCompletedCourseCount(user.id),
    0
  );

  const totalCertificates = employeeUsers.reduce(
    (total, user) => total + getCertificateCount(user.id),
    0
  );

  const pendingCourses = Math.max(totalAssignedCourses - totalCompletedCourses, 0);

  const completionRate =
    totalAssignedCourses > 0
      ? Math.round((totalCompletedCourses / totalAssignedCourses) * 100)
      : 0;

  const usersNeedingAttention = learners
    .map((user) => {
      const assigned = getAssignedCourseCount(user.id);
      const completed = getCompletedCourseCount(user.id);

      return {
        ...user,
        assigned,
        completed,
        pending: Math.max(assigned - completed, 0),
        completion: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
      };
    })
    .filter((user) => user.assigned > 0 && user.completion < 100)
    .sort((a, b) => b.pending - a.pending)
    .slice(0, 6);

  const departmentSummary = departments.slice(0, 6).map((dept) => {
    const deptName = dept.departmentName || dept.name || dept.title || "";
    const deptUsers = employeeUsers.filter(
      (user) =>
        String(user.department || "").toLowerCase() === deptName.toLowerCase()
    );

    const assigned = deptUsers.reduce(
      (total, user) => total + getAssignedCourseCount(user.id),
      0
    );

    const completed = deptUsers.reduce(
      (total, user) => total + getCompletedCourseCount(user.id),
      0
    );

    return {
      ...dept,
      deptName,
      users: deptUsers.length,
      assigned,
      completed,
      completion: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
    };
  });

  const recentActivity = attempts.slice(0, 6);

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
          <span>Admin Overview</span>
          <h1>Training Dashboard</h1>
          <p>
            Course-wise overview of users, department admins, assignments,
            completions and certificates.
          </p>
        </div>

        <img src="/Logo.webp" alt="Logo" />
      </div>

      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <span>Total Employees</span>
          <h2>{learners.length}</h2>
          <p>Normal users/staff</p>
        </div>

        <div className="admin-kpi-card">
          <span>Department Admins</span>
          <h2>{departmentAdmins.length}</h2>
          <p>Department level managers</p>
        </div>

        <div className="admin-kpi-card">
          <span>Active Courses</span>
          <h2>{courses.length}</h2>
          <p>Created training courses</p>
        </div>

        <div className="admin-kpi-card">
          <span>Assigned Courses</span>
          <h2>{totalAssignedCourses}</h2>
          <p>Total course assignments</p>
        </div>

        <div className="admin-kpi-card danger">
          <span>Pending Courses</span>
          <h2>{pendingCourses}</h2>
          <p>Yet to be completed</p>
        </div>

        <div className="admin-kpi-card primary">
          <span>Completion Rate</span>
          <h2>{completionRate}%</h2>
          <p>Course-wise completion</p>
        </div>
      </div>

      <div className="admin-main-grid no-actions">
        <div className="admin-panel progress-panel">
          <div className="admin-panel-head">
            <span>Progress</span>
            <h2>Overall Training Status</h2>
          </div>

          <div className="progress-circle">
            <div>{completionRate}%</div>
          </div>

          <p>
            {totalCompletedCourses} of {totalAssignedCourses} assigned courses
            completed.
          </p>

          <div className="mini-stats">
            <div>
              <span>Completed</span>
              <strong>{totalCompletedCourses}</strong>
            </div>

            <div>
              <span>Pending</span>
              <strong>{pendingCourses}</strong>
            </div>

            <div>
              <span>Certificates</span>
              <strong>{totalCertificates}</strong>
            </div>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <span>Attention</span>
            <h2>Users Needing Follow-up</h2>
          </div>

          <div className="admin-user-list">
            {usersNeedingAttention.length === 0 ? (
              <p className="admin-empty-text">No pending user follow-up found.</p>
            ) : (
              usersNeedingAttention.map((user) => (
                <div className="admin-user-row" key={user.id}>
                  <div>
                    <strong>{user.name || "Unnamed User"}</strong>
                    <span>
                      {user.designation || user.role || "User"} • Pending{" "}
                      {user.pending}
                    </span>
                  </div>

                  <b>{user.completion}%</b>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="admin-bottom-grid">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <span>Departments</span>
            <h2>Department-wise Course Status</h2>
          </div>

          <div className="admin-user-list">
            {departmentSummary.length === 0 ? (
              <p className="admin-empty-text">No departments created yet.</p>
            ) : (
              departmentSummary.map((dept) => (
                <div className="admin-user-row dept-row" key={dept.id}>
                  <div>
                    <strong>{dept.deptName || "-"}</strong>
                    <span>
                      Users {dept.users} • Assigned {dept.assigned} • Completed{" "}
                      {dept.completed}
                    </span>
                  </div>

                  <b>{dept.completion}%</b>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <span>Activity</span>
            <h2>Recent Course Attempts</h2>
          </div>

          <div className="admin-user-list">
            {recentActivity.length === 0 ? (
              <p className="admin-empty-text">No recent attempts found.</p>
            ) : (
              recentActivity.map((attempt) => (
                <div className="admin-user-row" key={attempt.id}>
                  <div>
                    <strong>{attempt.userName || "Unnamed User"}</strong>
                    <span>
                      {attempt.courseTitle ||
                        attempt.courseName ||
                        attempt.videoTitle ||
                        "Untitled Course"}
                    </span>
                  </div>

                  <b className={attempt.passed ? "pass-text" : "fail-text"}>
                    {attempt.passed ? "Passed" : "Failed"}
                  </b>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;