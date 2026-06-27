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
  const [courseFilter, setCourseFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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
    zone: ["zone", "Zone"],
    state: ["state", "State"],
    city: ["city", "City", "area", "Area", "location", "Location", "hq", "HQ"],
    designation: ["designation", "userRole", "jobTitle", "roleTitle", "position"],
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
      const role = user.role || "";
      return role !== "admin" && role !== "superAdmin" && role !== "departmentAdmin";
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

    if (!assigned) return "notAssigned";
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
    if (status === "notStarted") return 0;

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

  const zoneOptions = [...new Set(users.map((u) => getField(u, keys.zone)).filter(Boolean))];
  const stateOptions = [...new Set(users.map((u) => getField(u, keys.state)).filter(Boolean))];
  const cityOptions = [...new Set(users.map((u) => getField(u, keys.city)).filter(Boolean))];
  const designationOptions = [
    ...new Set(users.map((u) => getField(u, keys.designation)).filter(Boolean)),
  ];

  const filteredRows = useMemo(() => {
    return assignmentRows.filter((row) => {
      const zone = getField(row.user, keys.zone);
      const state = getField(row.user, keys.state);
      const city = getField(row.user, keys.city);
      const designation = getField(row.user, keys.designation);

      const searchText = [
        row.user.name,
        row.user.email,
        row.course.title,
        designation,
        zone,
        state,
        city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        searchText.includes(search.toLowerCase()) &&
        (!courseFilter || row.courseId === courseFilter) &&
        (!zoneFilter || zone === zoneFilter) &&
        (!stateFilter || state === stateFilter) &&
        (!cityFilter || city === cityFilter) &&
        (!designationFilter || designation === designationFilter) &&
        (!statusFilter || row.status === statusFilter)
      );
    });
  }, [
    assignmentRows,
    search,
    courseFilter,
    zoneFilter,
    stateFilter,
    cityFilter,
    designationFilter,
    statusFilter,
  ]);

  const resetFilters = () => {
    setSearch("");
    setCourseFilter("");
    setZoneFilter("");
    setStateFilter("");
    setCityFilter("");
    setDesignationFilter("");
    setStatusFilter("");
  };

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
      <div className="tracker-header">
        <div>
          <span>Training Tracker</span>
          <h1>Assigned Course Users</h1>
          <p>Track who received which course and their current progress.</p>
        </div>
      </div>

      <div className="tracker-stats-grid">
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

      <div className="tracker-card">
        <div className="tracker-card-head">
          <div>
            <h2>Assigned List</h2>
            <p>{filteredRows.length} of {assignmentRows.length} records showing</p>
          </div>
        </div>

        <div className="tracker-filters">
          <input
            placeholder="Search user, course, city, designation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            <option value="">All Courses</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>

          <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
            <option value="">All Zones</option>
            {zoneOptions.map((zone) => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>

          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
            <option value="">All States</option>
            {stateOptions.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>

          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
            <option value="">All Cities</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>

          <select
            value={designationFilter}
            onChange={(e) => setDesignationFilter(e.target.value)}
          >
            <option value="">All Designations</option>
            {designationOptions.map((des) => (
              <option key={des} value={des}>{des}</option>
            ))}
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="notStarted">Not Started</option>
            <option value="inProgress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          <button type="button" onClick={resetFilters}>Reset</button>
        </div>

        <div className="tracker-table-wrap">
          <table className="tracker-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Course</th>
                <th>Designation</th>
                <th>Location</th>
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
                  const location =
                    [
                      getField(row.user, keys.city),
                      getField(row.user, keys.state),
                      getField(row.user, keys.zone),
                    ]
                      .filter(Boolean)
                      .join(", ") || "-";

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
                      <td>{location}</td>

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