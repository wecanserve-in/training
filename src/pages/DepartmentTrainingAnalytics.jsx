import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/departmenttraininganalytics.css";

function DepartmentTrainingAnalytics() {
  const [currentUser, setCurrentUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [completedCourses, setCompletedCourses] = useState({});
  const [progress, setProgress] = useState({});
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) {
        setLoading(false);
        return;
      }

      try {
        const userSnap = await get(ref(database, `users/${loggedUser.uid}`));
        if (!userSnap.exists()) {
          setLoading(false);
          return;
        }

        const adminData = {
          id: loggedUser.uid,
          email: loggedUser.email,
          ...userSnap.val(),
        };

        setCurrentUser(adminData);

        const [
          coursesSnap,
          usersSnap,
          assignmentsSnap,
          completedSnap,
          progressSnap,
        ] = await Promise.all([
          get(ref(database, "courses")),
          get(ref(database, "users")),
          get(ref(database, "userAssignments")),
          get(ref(database, "completedCourses")),
          get(ref(database, "progress")),
        ]);

        const allCourses = coursesSnap.exists()
          ? Object.entries(coursesSnap.val()).map(([id, course]) => ({
              id,
              ...course,
            }))
          : [];

        const myCourses = allCourses.filter((course) => {
          return (
            course.createdBy === adminData.id ||
            course.createdByEmail === adminData.email ||
            course.department === adminData.department
          );
        });

        const normalUsers = usersSnap.exists()
          ? Object.entries(usersSnap.val())
              .map(([id, user]) => ({
                id,
                ...user,
              }))
              .filter(
                (u) =>
                  u.role !== "admin" &&
                  u.role !== "superAdmin" &&
                  u.role !== "departmentAdmin"
              )
          : [];

        setCourses(myCourses);
        setUsers(normalUsers);
        setAssignments(assignmentsSnap.exists() ? assignmentsSnap.val() : {});
        setCompletedCourses(completedSnap.exists() ? completedSnap.val() : {});
        setProgress(progressSnap.exists() ? progressSnap.val() : {});
      } catch (error) {
        console.error(error);
        alert("Failed to load analytics");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const getCourseStatusForUser = (userId, courseId) => {
    const assigned = assignments?.[userId]?.[courseId]?.assigned;
    const completed = completedCourses?.[userId]?.[courseId];

    if (!assigned) return "notAssigned";
    if (completed?.passed || completed?.completed) return "completed";

    const userProgress = progress?.[userId] || {};

    const hasProgress = Object.values(userProgress).some(
      (item) =>
        item?.courseId === courseId &&
        (Number(item?.watchedPercent || 0) > 0 || item?.completed)
    );

    return hasProgress ? "inProgress" : "notStarted";
  };

  const courseStats = useMemo(() => {
    return courses.map((course) => {
      let assigned = 0;
      let completed = 0;
      let inProgress = 0;
      let notStarted = 0;

      users.forEach((user) => {
        const status = getCourseStatusForUser(user.id, course.id);

        if (status !== "notAssigned") assigned += 1;
        if (status === "completed") completed += 1;
        if (status === "inProgress") inProgress += 1;
        if (status === "notStarted") notStarted += 1;
      });

      return {
        ...course,
        assigned,
        completed,
        inProgress,
        notStarted,
      };
    });
  }, [courses, users, assignments, completedCourses, progress]);

  const selectedCourse = courseStats.find((course) => course.id === selectedCourseId);

  const totalStats = useMemo(() => {
    return courseStats.reduce(
      (acc, course) => {
        acc.assigned += course.assigned;
        acc.completed += course.completed;
        acc.inProgress += course.inProgress;
        acc.notStarted += course.notStarted;
        return acc;
      },
      {
        assigned: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
      }
    );
  }, [courseStats]);

  const selectedUsers = useMemo(() => {
    if (!selectedCourseId) return [];

    return users
      .map((user) => {
        const status = getCourseStatusForUser(user.id, selectedCourseId);

        return {
          ...user,
          status,
        };
      })
      .filter((user) => {
        if (user.status === "notAssigned") return false;

        const text = [
          user.name,
          user.email,
          user.zone,
          user.state,
          user.city,
          user.cityArea,
          user.area,
          user.designation,
          user.userRole,
          user.experience,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch = text.includes(search.toLowerCase());
        const matchesStatus = statusFilter ? user.status === statusFilter : true;

        return matchesSearch && matchesStatus;
      });
  }, [
    users,
    selectedCourseId,
    search,
    statusFilter,
    assignments,
    completedCourses,
    progress,
  ]);

  const downloadDepartmentReport = () => {
    const reportRows = [];

    courseStats.forEach((course) => {
      users.forEach((user) => {
        const status = getCourseStatusForUser(user.id, course.id);

        if (status === "notAssigned") return;

        reportRows.push({
          Course: course.title || course.courseTitle || "-",
          Department: course.department || "-",
          User: user.name || "-",
          Email: user.email || "-",
          Designation: user.designation || user.userRole || "-",
          Location:
            [user.city || user.cityArea || user.area, user.state, user.zone]
              .filter(Boolean)
              .join(", ") || "-",
          Status:
            status === "completed"
              ? "Completed"
              : status === "inProgress"
              ? "In Progress"
              : "Not Started",
        });
      });
    });

    if (reportRows.length === 0) {
      alert("No report data available to download");
      return;
    }

    const headers = Object.keys(reportRows[0]);

    const csvContent = [
      headers.join(","),
      ...reportRows.map((row) =>
        headers
          .map((header) => `"${String(row[header] || "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `department-training-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="training-analytics-page">Loading analytics...</div>;
  }

  return (
    <div className="training-analytics-page">
      <div className="training-analytics-header">
        <div>
          <span>Training Analytics</span>
          <h1>Assignment Tracking</h1>
          <p>Track course assignment, completion and user progress.</p>
        </div>

        <button
          type="button"
          className="download-report-btn"
          onClick={downloadDepartmentReport}
        >
          Download Department Report
        </button>
      </div>

      <div className="analytics-stats-grid">
        <div className="analytics-stat-card blue">
          <h3>{totalStats.assigned}</h3>
          <p>Total Assigned</p>
        </div>

        <div className="analytics-stat-card orange">
          <h3>{totalStats.inProgress}</h3>
          <p>In Progress</p>
        </div>

        <div className="analytics-stat-card green">
          <h3>{totalStats.completed}</h3>
          <p>Completed</p>
        </div>

        <div className="analytics-stat-card red">
          <h3>{totalStats.notStarted}</h3>
          <p>Not Started</p>
        </div>
      </div>

      <div className="analytics-card">
        <div className="analytics-card-head">
          <div>
            <h2>Course Overview</h2>
            <p>Click any course to see assigned users.</p>
          </div>
        </div>

        <div className="course-overview-table-wrap">
          <table className="course-overview-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Assigned</th>
                <th>In Progress</th>
                <th>Completed</th>
                <th>Not Started</th>
              </tr>
            </thead>

            <tbody>
              {courseStats.map((course) => (
                <tr
                  key={course.id}
                  onClick={() => setSelectedCourseId(course.id)}
                  className={selectedCourseId === course.id ? "active" : ""}
                >
                  <td>
                    <strong>{course.title || course.courseTitle}</strong>
                    <small>{course.department || "-"}</small>
                  </td>

                  <td>{course.assigned}</td>
                  <td>{course.inProgress}</td>
                  <td>{course.completed}</td>
                  <td>{course.notStarted}</td>
                </tr>
              ))}

              {courseStats.length === 0 && (
                <tr>
                  <td colSpan="5" className="empty-cell">
                    No courses created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCourse && (
        <div className="analytics-card">
          <div className="analytics-card-head">
            <div>
              <h2>{selectedCourse.title || selectedCourse.courseTitle}</h2>
              <p>
                {selectedCourse.assigned} assigned • {selectedCourse.completed} completed
              </p>
            </div>
          </div>

          <div className="funnel-box">
            <div>
              <span>Assigned</span>
              <strong>{selectedCourse.assigned}</strong>
              <div className="funnel-bar">
                <i style={{ width: "100%" }}></i>
              </div>
            </div>

            <div>
              <span>Started</span>
              <strong>{selectedCourse.inProgress + selectedCourse.completed}</strong>
              <div className="funnel-bar">
                <i
                  style={{
                    width: `${
                      selectedCourse.assigned
                        ? ((selectedCourse.inProgress + selectedCourse.completed) /
                            selectedCourse.assigned) *
                          100
                        : 0
                    }%`,
                  }}
                ></i>
              </div>
            </div>

            <div>
              <span>Completed</span>
              <strong>{selectedCourse.completed}</strong>
              <div className="funnel-bar">
                <i
                  style={{
                    width: `${
                      selectedCourse.assigned
                        ? (selectedCourse.completed / selectedCourse.assigned) * 100
                        : 0
                    }%`,
                  }}
                ></i>
              </div>
            </div>
          </div>

          <div className="analytics-filter-row">
            <input
              placeholder="Search user, city, designation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="notStarted">Not Started</option>
              <option value="inProgress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="user-progress-table-wrap">
            <table className="user-progress-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Designation</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {selectedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name || "Unnamed User"}</strong>
                      <small>{user.email}</small>
                    </td>

                    <td>{user.designation || user.userRole || "-"}</td>

                    <td>
                      {[user.city || user.cityArea || user.area, user.state, user.zone]
                        .filter(Boolean)
                        .join(", ") || "-"}
                    </td>

                    <td>
                      <span className={`analytics-status ${user.status}`}>
                        {user.status === "completed"
                          ? "Completed"
                          : user.status === "inProgress"
                          ? "In Progress"
                          : "Not Started"}
                      </span>
                    </td>
                  </tr>
                ))}

                {selectedUsers.length === 0 && (
                  <tr>
                    <td colSpan="4" className="empty-cell">
                      No users found for this course/filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default DepartmentTrainingAnalytics;