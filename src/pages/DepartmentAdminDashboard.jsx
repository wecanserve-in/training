import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, ref } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/departmentadmin.css";

function DepartmentAdminDashboard() {
  const [currentUser, setCurrentUser] = useState(null);

  const [allCourses, setAllCourses] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [videoLibrary, setVideoLibrary] = useState([]);
  const [oldVideos, setOldVideos] = useState([]);

  const [assignments, setAssignments] = useState({});
  const [completedCourses, setCompletedCourses] = useState({});
  const [progress, setProgress] = useState({});

  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const normalize = (value) => String(value || "").trim().toLowerCase();

  const getRole = (user) => normalize(user?.role);

  const isAdminRole = (role) => {
    const cleanRole = normalize(role);
    return cleanRole === "admin" || cleanRole === "superadmin";
  };

  const isDepartmentAdminRole = (role) => {
    const cleanRole = normalize(role);

    return (
      cleanRole === "departmentadmin" ||
      cleanRole === "department admin" ||
      cleanRole === "department_admin" ||
      cleanRole === "deptadmin" ||
      cleanRole === "dept admin"
    );
  };

  const sameText = (a, b) => {
    const first = normalize(a);
    const second = normalize(b);

    return Boolean(first && second && first === second);
  };

  const getTime = (value) => {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  };

  const objectToArray = (data) => {
    if (!data || typeof data !== "object") return [];

    return Object.entries(data).map(([id, value]) => ({
      id,
      ...(value && typeof value === "object" ? value : {}),
    }));
  };

  const getDepartmentName = (item) => {
    return (
      item?.department ||
      item?.departmentName ||
      item?.departmentType ||
      item?.dept ||
      item?.deptName ||
      ""
    );
  };

  const getCourseTitle = (course) => {
    return (
      course?.title ||
      course?.courseTitle ||
      course?.courseName ||
      course?.name ||
      "Untitled Course"
    );
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      try {
        if (!loggedUser) {
          setCurrentUser(null);
          setAuthReady(true);
          setLoading(false);
          return;
        }

        const userSnap = await get(ref(database, `users/${loggedUser.uid}`));

        if (!userSnap.exists()) {
          setCurrentUser(null);
          setAuthReady(true);
          setLoading(false);
          return;
        }

        const userData = {
          id: loggedUser.uid,
          email: loggedUser.email,
          ...userSnap.val(),
        };

        setCurrentUser(userData);
        setAuthReady(true);
      } catch (error) {
        console.error("Failed to load current user:", error);
        setCurrentUser(null);
        setAuthReady(true);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !currentUser) return;

    setLoading(true);

    const loadedPaths = new Set();

    const markLoaded = (path) => {
      loadedPaths.add(path);

      if (loadedPaths.size === 7) {
        setLoading(false);
      }
    };

    const watchPath = (path, setter, asArray = false) => {
      return onValue(
        ref(database, path),
        (snapshot) => {
          const value = snapshot.exists() ? snapshot.val() : asArray ? [] : {};
          setter(asArray ? objectToArray(value) : value);
          markLoaded(path);
        },
        (error) => {
          console.error(`Firebase error at ${path}:`, error);
          setter(asArray ? [] : {});
          markLoaded(path);
        }
      );
    };

    const unsubCourses = watchPath("courses", setAllCourses, true);
    const unsubUsers = watchPath("users", setAllUsers, true);
    const unsubVideoLibrary = watchPath("videoLibrary", setVideoLibrary, true);
    const unsubOldVideos = watchPath("videos", setOldVideos, true);
    const unsubAssignments = watchPath("userAssignments", setAssignments);
    const unsubCompleted = watchPath("completedCourses", setCompletedCourses);
    const unsubProgress = watchPath("progress", setProgress);

    return () => {
      unsubCourses();
      unsubUsers();
      unsubVideoLibrary();
      unsubOldVideos();
      unsubAssignments();
      unsubCompleted();
      unsubProgress();
    };
  }, [authReady, currentUser]);

  const currentRole = getRole(currentUser);

  const canSeeAll = isAdminRole(currentRole);

  const departmentName =
    currentUser?.department ||
    currentUser?.departmentName ||
    currentUser?.departmentType ||
    "";

  const users = useMemo(() => {
    return allUsers.filter((user) => {
      const role = getRole(user);

      return !isAdminRole(role) && !isDepartmentAdminRole(role);
    });
  }, [allUsers]);

  const courses = useMemo(() => {
    const visibleCourses = canSeeAll
      ? allCourses
      : allCourses.filter((course) => {
          return (
            course.createdBy === currentUser?.id ||
            course.createdById === currentUser?.id ||
            sameText(course.createdByEmail, currentUser?.email) ||
            sameText(getDepartmentName(course), departmentName)
          );
        });

    return [...visibleCourses].sort(
      (a, b) => getTime(b.createdAt) - getTime(a.createdAt)
    );
  }, [allCourses, canSeeAll, currentUser, departmentName]);

  const videos = useMemo(() => {
    const map = new Map();

    [...videoLibrary, ...oldVideos].forEach((video) => {
      if (video?.id) {
        map.set(video.id, video);
      }
    });

    const list = [...map.values()];

    if (canSeeAll) return list;

    return list.filter((video) => {
      return (
        video.createdBy === currentUser?.id ||
        video.createdById === currentUser?.id ||
        sameText(video.createdByEmail, currentUser?.email) ||
        sameText(getDepartmentName(video), departmentName)
      );
    });
  }, [videoLibrary, oldVideos, canSeeAll, currentUser, departmentName]);

  const getCourseStatusForUser = (userId, courseId) => {
    const assignment = assignments?.[userId]?.[courseId];

    if (!assignment?.assigned) {
      return "notAssigned";
    }

    const completed = completedCourses?.[userId]?.[courseId];

    if (
      completed === true ||
      completed?.passed ||
      completed?.completed ||
      completed?.isCompleted
    ) {
      return "completed";
    }

    const userProgress = progress?.[userId] || {};

    const hasStarted = Object.values(userProgress).some((video) => {
      return (
        String(video?.courseId || "") === String(courseId) &&
        (Number(video?.watchedPercent || 0) > 0 || video?.completed)
      );
    });

    return hasStarted ? "inProgress" : "notStarted";
  };

  const courseStats = useMemo(() => {
    return courses.map((course) => {
      let assigned = 0;
      let completed = 0;
      let inProgress = 0;
      let notStarted = 0;

      users.forEach((user) => {
        const status = getCourseStatusForUser(user.id, course.id);

        if (status === "notAssigned") return;

        assigned++;

        if (status === "completed") completed++;
        if (status === "inProgress") inProgress++;
        if (status === "notStarted") notStarted++;
      });

      const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

      return {
        ...course,
        title: getCourseTitle(course),
        assigned,
        completed,
        inProgress,
        notStarted,
        pending: inProgress + notStarted,
        rate,
      };
    });
  }, [courses, users, assignments, completedCourses, progress]);

  const totalAssigned = useMemo(() => {
    return courseStats.reduce((total, course) => total + course.assigned, 0);
  }, [courseStats]);

  const totalCompleted = useMemo(() => {
    return courseStats.reduce((total, course) => total + course.completed, 0);
  }, [courseStats]);

  const totalInProgress = useMemo(() => {
    return courseStats.reduce((total, course) => total + course.inProgress, 0);
  }, [courseStats]);

  const totalNotStarted = useMemo(() => {
    return courseStats.reduce((total, course) => total + course.notStarted, 0);
  }, [courseStats]);

  const totalPending = totalInProgress + totalNotStarted;

  const completionRate =
    totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  const courseOverview = useMemo(() => {
    return [...courseStats]
      .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
      .slice(0, 2);
  }, [courseStats]);

  const userRows = useMemo(() => {
    return users
      .map((user) => {
        let assigned = 0;
        let completed = 0;
        let inProgress = 0;
        let notStarted = 0;

        courses.forEach((course) => {
          const status = getCourseStatusForUser(user.id, course.id);

          if (status === "notAssigned") return;

          assigned++;

          if (status === "completed") completed++;
          if (status === "inProgress") inProgress++;
          if (status === "notStarted") notStarted++;
        });

        const pending = inProgress + notStarted;
        const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

        return {
          id: user.id,
          name: user.name || user.fullName || "Unnamed User",
          email: user.email || "-",
          designation: user.designation || user.userRole || "-",
          department: getDepartmentName(user) || "-",
          assigned,
          completed,
          inProgress,
          notStarted,
          pending,
          rate,
        };
      })
      .filter((user) => user.assigned > 0)
      .sort((a, b) => b.assigned - a.assigned || a.rate - b.rate);
  }, [users, courses, assignments, completedCourses, progress]);

  const downloadReport = () => {
    const rows = userRows.map((user) => ({
      Name: user.name,
      Email: user.email,
      Designation: user.designation,
      Department: user.department,
      Assigned: user.assigned,
      Completed: user.completed,
      "In Progress": user.inProgress,
      "Not Started": user.notStarted,
      Pending: user.pending,
      "Completion %": `${user.rate}%`,
    }));

    const headers = Object.keys(
      rows[0] || {
        Name: "",
        Email: "",
        Designation: "",
        Department: "",
        Assigned: "",
        Completed: "",
        "In Progress": "",
        "Not Started": "",
        Pending: "",
        "Completion %": "",
      }
    );

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
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
    link.download = `department-dashboard-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="dept-dashboard-page">
        <div className="dept-loading-card">
          <h2>Loading dashboard...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="dept-dashboard-page">
      <div className="dept-dashboard-header">
        <div>
          <span>Department Dashboard</span>
          <h1>{departmentName || "Department"} Overview</h1>
          <p>
            Real Firebase stats based on userAssignments, completedCourses and
            progress.
          </p>
        </div>

        <button type="button" onClick={downloadReport}>
          Export Report
        </button>
      </div>

      <div className="dept-kpi-grid">
        <div className="dept-kpi-card">
          <span>Total Assignable Users</span>
          <h3>{users.length}</h3>
          <p>All normal users</p>
        </div>

        <div className="dept-kpi-card">
          <span>Total Courses</span>
          <h3>{courses.length}</h3>
          <p>Visible courses</p>
        </div>

        <div className="dept-kpi-card">
          <span>Total Videos</span>
          <h3>{videos.length}</h3>
          <p>Video library</p>
        </div>

        <div className="dept-kpi-card">
          <span>Assigned</span>
          <h3>{totalAssigned}</h3>
          <p>User-course assignments</p>
        </div>

        <div className="dept-kpi-card success">
          <span>Completed</span>
          <h3>{totalCompleted}</h3>
          <p>Completed trainings</p>
        </div>

        <div className="dept-kpi-card progress">
          <span>In Progress</span>
          <h3>{totalInProgress}</h3>
          <p>Started trainings</p>
        </div>

        <div className="dept-kpi-card warning">
          <span>Pending</span>
          <h3>{totalPending}</h3>
          <p>In progress + not started</p>
        </div>

        <div className="dept-kpi-card primary">
          <span>Completion Rate</span>
          <h3>{completionRate}%</h3>
          <p>Completed / assigned</p>
        </div>
      </div>

      <div className="dept-large-card">
        <div className="dept-section-head">
          <div>
            <span>Course Overview</span>
            <h2>Latest 2 Courses</h2>
          </div>
        </div>

        {courseOverview.length === 0 ? (
          <div className="dept-empty-row">No course data found.</div>
        ) : (
          <div className="dept-course-card-grid">
            {courseOverview.map((course) => (
              <div className="dept-course-card" key={course.id}>
                <div className="dept-course-title-row">
                  <h3>{course.title}</h3>
                  <strong>{course.rate}%</strong>
                </div>

                <div className="dept-progress-line">
                  <div>
                    <span style={{ width: `${course.rate}%` }}></span>
                  </div>
                </div>

                <div className="dept-course-stats">
                  <div>
                    <span>Assigned</span>
                    <b>{course.assigned}</b>
                  </div>

                  <div>
                    <span>Completed</span>
                    <b>{course.completed}</b>
                  </div>

                  <div>
                    <span>In Progress</span>
                    <b>{course.inProgress}</b>
                  </div>

                  <div>
                    <span>Not Started</span>
                    <b>{course.notStarted}</b>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dept-large-card">
        <div className="dept-section-head">
          <div>
            <span>Users</span>
            <h2>Assigned User Progress</h2>
          </div>
        </div>

        <div className="dept-table-wrap">
          <table className="dept-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Assigned</th>
                <th>Completed</th>
                <th>In Progress</th>
                <th>Not Started</th>
                <th>Completion</th>
              </tr>
            </thead>

            <tbody>
              {userRows.length > 0 ? (
                userRows.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.department}</td>
                    <td>{user.designation}</td>
                    <td>{user.assigned}</td>
                    <td>{user.completed}</td>
                    <td>{user.inProgress}</td>
                    <td>{user.notStarted}</td>
                    <td>
                      <b>{user.rate}%</b>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9">No assigned users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DepartmentAdminDashboard;