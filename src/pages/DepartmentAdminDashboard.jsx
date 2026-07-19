import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, ref } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/superadmin.css";

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

  const getCourseThumbnail = (course) => {
    if (course?.thumbnailUrl) return course.thumbnailUrl;
    if (course?.courseThumbnail) return course.courseThumbnail;
    if (course?.thumbnail) return course.thumbnail;
    return "";
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
      if (isAdminRole(role) || isDepartmentAdminRole(role)) return false;
      if (!departmentName) return true;
      return sameText(getDepartmentName(user), departmentName);
    });
  }, [allUsers, departmentName]);

  const courses = useMemo(() => {
    if (canSeeAll) return [...allCourses].sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));

    const userDeptId = String(currentUser?.departmentId || "").trim();
    const userDept = String(departmentName || "").trim().toLowerCase();

    if (!userDeptId && !userDept) return [];

    return allCourses
      .filter((course) => {
        const courseDeptId = String(course.departmentId || "").trim();
        const courseDept = String(getDepartmentName(course) || "").trim().toLowerCase();
        if (courseDeptId && userDeptId && courseDeptId === userDeptId) return true;
        if (courseDept && userDept && courseDept === userDept) return true;
        return false;
      })
      .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
  }, [allCourses, canSeeAll, currentUser, departmentName]);

  const videos = useMemo(() => {
    const map = new Map();
    [...videoLibrary, ...oldVideos].forEach((video) => {
      if (video?.id) map.set(video.id, video);
    });
    const list = [...map.values()];
    if (canSeeAll) return list;
    return list.filter((video) => {
      return (
        video.createdBy === currentUser?.id ||
        video.createdById === currentUser?.id ||
        sameText(video.createdByEmail, currentUser?.email) ||
        (currentUser?.departmentId && video.departmentId === currentUser.departmentId) ||
        sameText(getDepartmentName(video), departmentName)
      );
    });
  }, [videoLibrary, oldVideos, canSeeAll, currentUser, departmentName]);

  const getCourseStatusForUser = (userId, courseId) => {
    const assignment = assignments?.[userId]?.[courseId];
    if (!assignment?.assigned) return "notAssigned";

    const completed = completedCourses?.[userId]?.[courseId];
    if (
      completed === true ||
      completed?.passed ||
      completed?.completed ||
      completed?.isCompleted
    ) return "completed";

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
      let assigned = 0, completed = 0, inProgress = 0, notStarted = 0;

      users.forEach((user) => {
        const status = getCourseStatusForUser(user.id, course.id);
        if (status === "notAssigned") return;
        assigned++;
        if (status === "completed") completed++;
        if (status === "inProgress") inProgress++;
        if (status === "notStarted") notStarted++;
      });

      const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

      return { ...course, title: getCourseTitle(course), assigned, completed, inProgress, notStarted, pending: inProgress + notStarted, rate };
    });
  }, [courses, users, assignments, completedCourses, progress]);

  const totalAssigned = useMemo(() => courseStats.reduce((t, c) => t + c.assigned, 0), [courseStats]);
  const totalCompleted = useMemo(() => courseStats.reduce((t, c) => t + c.completed, 0), [courseStats]);
  const totalInProgress = useMemo(() => courseStats.reduce((t, c) => t + c.inProgress, 0), [courseStats]);
  const totalNotStarted = useMemo(() => courseStats.reduce((t, c) => t + c.notStarted, 0), [courseStats]);
  const totalPending = totalInProgress + totalNotStarted;
  const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  const latestCourses = useMemo(() => {
    return [...courseStats]
      .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
      .slice(0, 4);
  }, [courseStats]);

  const userRows = useMemo(() => {
    return users
      .map((user) => {
        let assigned = 0, completed = 0, inProgress = 0, notStarted = 0;
        courses.forEach((course) => {
          const status = getCourseStatusForUser(user.id, course.id);
          if (status === "notAssigned") return;
          assigned++;
          if (status === "completed") completed++;
          if (status === "inProgress") inProgress++;
          if (status === "notStarted") notStarted++;
        });
        const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
        return {
          id: user.id,
          name: user.name || user.fullName || "Unnamed User",
          email: user.email || "-",
          designation: user.designation || user.userRole || "-",
          department: getDepartmentName(user) || "-",
          assigned, completed, inProgress, notStarted,
          pending: inProgress + notStarted,
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
      "Completion %": `${user.rate}%`,
    }));

    const headers = Object.keys(rows[0] || { Name: "", Email: "", Designation: "", Department: "", Assigned: "", Completed: "", "In Progress": "", "Not Started": "", "Completion %": "" });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        headers.map((h) => `"${String(row[h] || "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dept-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="super-loading">
        <h2>Loading dashboard...</h2>
      </div>
    );
  }

  return (
    <div className="super-dashboard">
      {/* Hero Banner */}
      <section className="dash-hero">
        <div className="hero-content">
          <h1>{departmentName || "Department"} Overview</h1>
          <p>Real-time stats for {departmentName || "your department"}.</p>
          <div className="hero-stats">
            <Link to="/department-admin/members" className="hero-stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="hero-stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <strong>{users.length}</strong>
                <span>Dept Users</span>
              </div>
            </Link>
            <Link to="/department-admin/courses" className="hero-stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="hero-stat-icon admins-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              </div>
              <div>
                <strong>{courses.length}</strong>
                <span>Courses</span>
              </div>
            </Link>
            <Link to="/department-admin/video-library" className="hero-stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="hero-stat-icon dept-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
              <div>
                <strong>{videos.length}</strong>
                <span>Videos</span>
              </div>
            </Link>
            <Link to="/department-admin/analytics" className="hero-stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="hero-stat-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div>
                <strong>{completionRate}%</strong>
                <span>Completion</span>
              </div>
            </Link>
          </div>
        </div>
        <div className="hero-decoration">
          <div className="hero-circle-1"></div>
          <div className="hero-circle-2"></div>
        </div>
      </section>

      {/* Stat Cards Row */}
      <section className="dash-stat-cards">
        <Link to="/department-admin/members" className="stat-card stat-courses" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Dept Users</span>
            <strong>{users.length}</strong>
          </div>
        </Link>

        <Link to="/department-admin/assignments" className="stat-card stat-progress" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Total Assigned</span>
            <strong>{totalAssigned}</strong>
          </div>
        </Link>

        <Link to="/department-admin/analytics" className="stat-card stat-completed" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Completed</span>
            <strong>{totalCompleted}</strong>
          </div>
        </Link>

        <Link to="/department-admin/analytics" className="stat-card stat-progress" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div className="stat-card-info">
            <span>In Progress</span>
            <strong>{totalInProgress}</strong>
          </div>
        </Link>

        <Link to="/department-admin/analytics" className="stat-card stat-rate" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Completion Rate</span>
            <strong>{completionRate}%</strong>
          </div>
        </Link>
      </section>

      {/* Latest Courses + Department Summary */}
      <section className="dash-content-row">
        <div className="dash-card courses-card">
          <div className="card-head">
            <div>
              <h2>Latest Courses</h2>
              <p>Recently added courses with assignment stats</p>
            </div>
            <Link to="/department-admin/courses" className="view-all-link">View All</Link>
          </div>

          <div className="course-list">
            {latestCourses.length === 0 ? (
              <p className="empty-text">No courses available yet.</p>
            ) : (
              latestCourses.map((course) => {
                const thumb = getCourseThumbnail(course);
                return (
                  <div className="course-row" key={course.id}>
                    {thumb ? (
                      <img className="course-thumb" src={thumb} alt={course.title} />
                    ) : (
                      <div className="course-avatar" style={{ background: "#059669" }}>
                        {(course.title?.charAt(0) || "C").toUpperCase()}
                      </div>
                    )}
                    <div className="course-info">
                      <h3>{course.title}</h3>
                      <span>{course.assigned} Assigned &bull; {course.completed} Done</span>
                    </div>
                    <div className="course-progress-wrap">
                      <div className="course-progress-bar">
                        <span style={{ width: `${course.rate}%` }}></span>
                      </div>
                      <strong>{course.rate}%</strong>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="dash-card quick-card-side">
          <div className="quick-side-header">
            <h2>Department Summary</h2>
            <p>Quick overview of your department</p>
          </div>

          <div className="quick-mini-cards">
            <div className="quick-mini">
              <strong>{totalAssigned}</strong>
              <span>Assigned</span>
            </div>
            <div className="quick-mini">
              <strong>{totalCompleted}</strong>
              <span>Completed</span>
            </div>
            <div className="quick-mini">
              <strong>{totalInProgress}</strong>
              <span>In Progress</span>
            </div>
            <div className="quick-mini">
              <strong>{courses.length}</strong>
              <span>Courses</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Light Summary Cards */}
      <section className="dash-four-cards">
        <Link to="/department-admin/assignments" className="light-summary-card" style={{ textDecoration: "none" }}>
          <div className="light-card-icon" style={{ background: "#ede9fe", color: "#7c3aed" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          </div>
          <div className="light-card-text">
            <strong>{totalAssigned}</strong>
            <span>Total Assigned</span>
          </div>
        </Link>

        <Link to="/department-admin/analytics" className="light-summary-card" style={{ textDecoration: "none" }}>
          <div className="light-card-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="light-card-text">
            <strong>{totalCompleted}</strong>
            <span>Completed</span>
          </div>
        </Link>

        <Link to="/department-admin/analytics" className="light-summary-card" style={{ textDecoration: "none" }}>
          <div className="light-card-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div className="light-card-text">
            <strong>{totalInProgress}</strong>
            <span>In Progress</span>
          </div>
        </Link>

        <Link to="/department-admin/analytics" className="light-summary-card" style={{ textDecoration: "none" }}>
          <div className="light-card-icon" style={{ background: "#fee2e2", color: "#dc2626" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div className="light-card-text">
            <strong>{totalNotStarted}</strong>
            <span>Not Started</span>
          </div>
        </Link>
      </section>

      {/* Bottom Row: Completion Rate + Alerts + User Progress */}
      <section className="dash-bottom-row">
        <div className="dash-card pass-card">
          <div className="card-title-row">
            <h2>Completion Rate</h2>
          </div>
          <div className="pass-donut-wrap">
            <svg className="pass-donut" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#e8f5ee" strokeWidth="12" />
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke="#22c55e"
                strokeWidth="12"
                strokeDasharray={`${completionRate * 3.14} ${314 - completionRate * 3.14}`}
                strokeDashoffset="78.5"
                strokeLinecap="round"
              />
            </svg>
            <div className="pass-donut-center">
              <strong>{completionRate}%</strong>
            </div>
          </div>
          <p>{totalCompleted} of {totalAssigned} completed</p>
        </div>

        <div className="dash-card alerts-card">
          <div className="card-title-row">
            <h2>Training Alerts</h2>
          </div>
          {totalPending > 0 && (
            <div className="alert-row warning">
              <span>Pending Courses</span>
              <strong>{totalPending}</strong>
            </div>
          )}
          <div className={`alert-row ${completionRate >= 50 ? "success" : "warning"}`}>
            <span>Completion Rate</span>
            <strong>{completionRate}%</strong>
          </div>
          <div className="alert-row success">
            <span>Courses Available</span>
            <strong>{courses.length}</strong>
          </div>
        </div>

        <div className="dash-card department-card">
          <div className="card-title-row">
            <h2>User Progress</h2>
          </div>
          {userRows.length === 0 ? (
            <p className="empty-text">No assigned users yet.</p>
          ) : (
            userRows.slice(0, 5).map((user, index) => (
              <div className="dept-row" key={user.id}>
                <div>
                  <span>{index + 1}. {user.name}</span>
                  <strong>{user.rate}%</strong>
                </div>
                <div className="dept-track">
                  <span style={{ width: `${user.rate}%` }}></span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Assigned User Progress Table */}
      <section className="dash-content-row" style={{ padding: "0 24px 28px" }}>
        <div className="dash-card courses-card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-head">
            <div>
              <h2>Assigned User Progress</h2>
              <p>Detailed breakdown of all assigned users</p>
            </div>
            <button type="button" onClick={downloadReport} className="export-btn">
              Export Report
            </button>
          </div>

          <div style={{ width: "100%", overflowX: "auto" }}>
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
                      <td><strong>{user.name}</strong></td>
                      <td>{user.email}</td>
                      <td>{user.department}</td>
                      <td>{user.designation}</td>
                      <td>{user.assigned}</td>
                      <td>{user.completed}</td>
                      <td>{user.inProgress}</td>
                      <td>{user.notStarted}</td>
                      <td><b>{user.rate}%</b></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="9">No assigned users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DepartmentAdminDashboard;
