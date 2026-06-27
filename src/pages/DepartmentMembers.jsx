import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref, remove } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/departmentmembers.css";

function DepartmentMembers() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [progress, setProgress] = useState({});
  const [completedCourses, setCompletedCourses] = useState({});
  const [results, setResults] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const getField = (obj, keys) => {
    for (const key of keys) {
      const value = obj?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
    return "";
  };

  const keys = {
    city: ["cityArea", "city", "City", "area", "Area", "location", "Location"],
    designation: ["designation", "jobTitle", "roleTitle", "position"],
  };

  const loadData = async (adminData) => {
    const [usersSnap, coursesSnap, assignmentsSnap, progressSnap, completedSnap, resultsSnap] =
      await Promise.all([
        get(ref(database, "users")),
        get(ref(database, "courses")),
        get(ref(database, "userAssignments")),
        get(ref(database, "progress")),
        get(ref(database, "completedCourses")),
        get(ref(database, "results")),
      ]);

    const allUsers = usersSnap.exists()
      ? Object.entries(usersSnap.val()).map(([id, user]) => ({ id, ...user }))
      : [];

    const normalUsers = allUsers.filter((user) => {
      const role = String(user.role || "").toLowerCase();
      return !["admin", "superadmin", "departmentadmin"].includes(role);
    });

    const allCourses = coursesSnap.exists()
      ? Object.entries(coursesSnap.val()).map(([id, course]) => ({ id, ...course }))
      : [];

    const myCourses = allCourses.filter((course) => {
      return (
        course.createdBy === adminData.id ||
        course.createdByEmail === adminData.email ||
        course.department === adminData.department
      );
    });

    setUsers(normalUsers);
    setCourses(myCourses);
    setAssignments(assignmentsSnap.exists() ? assignmentsSnap.val() : {});
    setProgress(progressSnap.exists() ? progressSnap.val() : {});
    setCompletedCourses(completedSnap.exists() ? completedSnap.val() : {});
    setResults(resultsSnap.exists() ? resultsSnap.val() : {});
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) return;

      const userSnap = await get(ref(database, `users/${loggedUser.uid}`));
      if (!userSnap.exists()) return;

      const adminData = {
        id: loggedUser.uid,
        email: loggedUser.email,
        ...userSnap.val(),
      };

      setCurrentUser(adminData);
      await loadData(adminData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getCourseById = (courseId) => {
    return courses.find((course) => course.id === courseId);
  };

  const getUserStatus = (userId, courseId) => {
    const assigned = assignments?.[userId]?.[courseId]?.assigned;
    const completed = completedCourses?.[userId]?.[courseId];
    const result = results?.[userId]?.[courseId];

    if (!assigned) return "notStarted";
    if (completed?.passed || completed?.completed || result?.passed) return "completed";

    const userProgress = progress?.[userId] || {};
    const hasProgress = Object.values(userProgress).some(
      (item) => item?.watchedPercent > 0 || item?.completed
    );

    return hasProgress ? "inProgress" : "notStarted";
  };

  const getUserProgress = (userId, courseId) => {
    const status = getUserStatus(userId, courseId);
    if (status === "completed") return 100;

    const userProgress = progress?.[userId] || {};
    const values = Object.values(userProgress).map((p) => Number(p?.watchedPercent || 0));

    if (values.length === 0) return 0;

    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };

  const assignmentRows = useMemo(() => {
    const rows = [];

    Object.entries(assignments || {}).forEach(([userId, userAssignments]) => {
      const user = users.find((u) => u.id === userId);
      if (!user) return;

      Object.entries(userAssignments || {}).forEach(([courseId, assignment]) => {
        if (!assignment?.assigned) return;

        const course = getCourseById(courseId);
        if (!course) return;

        const status = getUserStatus(userId, courseId);
        const progressPercent = getUserProgress(userId, courseId);

        rows.push({
          id: `${userId}-${courseId}`,
          userId,
          courseId,
          user,
          course,
          assignment,
          status,
          progressPercent,
        });
      });
    });

    return rows.sort(
      (a, b) => new Date(b.assignment?.assignedAt || 0) - new Date(a.assignment?.assignedAt || 0)
    );
  }, [assignments, users, courses, progress, completedCourses, results]);

  const stats = useMemo(() => {
    return assignmentRows.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.status === "completed") acc.completed += 1;
        if (row.status === "inProgress") acc.inProgress += 1;
        if (row.status === "notStarted") acc.notStarted += 1;
        return acc;
      },
      { total: 0, completed: 0, inProgress: 0, notStarted: 0 }
    );
  }, [assignmentRows]);

  const topPendingUser = useMemo(() => {
    return [...assignmentRows]
      .filter((row) => row.status === "notStarted")
      .sort((a, b) => new Date(a.assignment?.assignedAt || 0) - new Date(b.assignment?.assignedAt || 0))[0];
  }, [assignmentRows]);

  const topInProgressUser = useMemo(() => {
    return [...assignmentRows]
      .filter((row) => row.status === "inProgress")
      .sort((a, b) => b.progressPercent - a.progressPercent)[0];
  }, [assignmentRows]);

  const latestCompletedUser = useMemo(() => {
    return [...assignmentRows].filter((row) => row.status === "completed")[0];
  }, [assignmentRows]);

  const filteredRows = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) return assignmentRows;

    return assignmentRows.filter((row) => {
      const designation = getField(row.user, keys.designation);
      const city = getField(row.user, keys.city);

      const searchText = [
        row.user.name,
        row.user.email,
        row.course.title,
        designation,
        city,
        row.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchText.includes(value);
    });
  }, [assignmentRows, search]);

  const removeAssignment = async (userId, courseId) => {
    if (!window.confirm("Remove this course assignment?")) return;

    await remove(ref(database, `userAssignments/${userId}/${courseId}`));
    await loadData(currentUser);
  };

  const getStatusLabel = (status) => {
    if (status === "completed") return "Completed";
    if (status === "inProgress") return "In Progress";
    return "Not Started";
  };

  if (loading) {
    return <div className="tracker-page">Loading tracker...</div>;
  }

  return (
    <div className="tracker-page">
      <div className="tracker-header clean-header">
        <div>
          <span>Department Training</span>
          <h1>Assigned Users Tracker</h1>
          <p>Quick view of assigned courses, user progress and pending follow-ups.</p>
        </div>
      </div>

      <div className="tracker-stats-grid clean-stats">
        <div className="tracker-stat blue">
          <h3>{stats.total}</h3>
          <p>Total Assigned</p>
        </div>

        <div className="tracker-stat orange">
          <h3>{stats.inProgress}</h3>
          <p>In Progress</p>
        </div>

        <div className="tracker-stat green">
          <h3>{stats.completed}</h3>
          <p>Completed</p>
        </div>

        <div className="tracker-stat red">
          <h3>{stats.notStarted}</h3>
          <p>Not Started</p>
        </div>
      </div>

      <div className="priority-strip">
        <div className="priority-card danger">
          <span>Top Follow-up</span>
          <strong>{topPendingUser?.user?.name || "No pending user"}</strong>
          <p>{topPendingUser?.course?.title || "All users have started"}</p>
        </div>

        <div className="priority-card warning">
          <span>Highest In Progress</span>
          <strong>{topInProgressUser?.user?.name || "No active user"}</strong>
          <p>
            {topInProgressUser
              ? `${topInProgressUser.progressPercent}% completed`
              : "No course in progress"}
          </p>
        </div>

        <div className="priority-card success">
          <span>Latest Completed</span>
          <strong>{latestCompletedUser?.user?.name || "No completion yet"}</strong>
          <p>{latestCompletedUser?.course?.title || "No completed course"}</p>
        </div>
      </div>

      <div className="tracker-card">
        <div className="tracker-card-head clean-table-head">
          <div>
            <h2>Course Assignment Records</h2>
            <p>{filteredRows.length} of {assignmentRows.length} records showing</p>
          </div>

          <input
            className="quick-search-input"
            placeholder="Search name, email, course, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="tracker-table-wrap">
          <table className="tracker-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Course</th>
                <th>Designation</th>
                <th>City</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Assigned On</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="tracker-empty">
                    No assignment records found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const designation = getField(row.user, keys.designation) || "-";
                  const city = getField(row.user, keys.city) || "-";

                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="tracker-user-cell">
                          <div className="tracker-avatar">
                            {(row.user.name || row.user.email || "U").charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <strong>{row.user.name || "Unnamed User"}</strong>
                            <small>{row.user.email}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <strong>{row.course.title}</strong>
                        <small>{row.course.department || "Training"}</small>
                      </td>

                      <td>{designation}</td>
                      <td>{city}</td>

                      <td>
                        <div className="tracker-progress">
                          <div>
                            <span style={{ width: `${row.progressPercent}%` }}></span>
                          </div>
                          <b>{row.progressPercent}%</b>
                        </div>
                      </td>

                      <td>
                        <span className={`tracker-status ${row.status}`}>
                          {getStatusLabel(row.status)}
                        </span>
                      </td>

                      <td>
                        {row.assignment?.assignedAt
                          ? new Date(row.assignment.assignedAt).toLocaleDateString("en-IN")
                          : "-"}
                      </td>

                      <td>
                        <button
                          className="tracker-remove-btn"
                          onClick={() => removeAssignment(row.userId, row.courseId)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DepartmentMembers;