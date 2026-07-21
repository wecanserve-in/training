import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, ref } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/superadmin.css";

function SuperAdminDashboard() {
  const [currentUser, setCurrentUser] = useState(null);

  const [allCourses, setAllCourses] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [videoLibrary, setVideoLibrary] = useState([]);
  const [oldVideos, setOldVideos] = useState([]);

  const [assignments, setAssignments] = useState({});
  const [completedCourses, setCompletedCourses] = useState({});
  const [progress, setProgress] = useState({});
  const [departments, setDepartments] = useState({});

  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const normalize = (value) => String(value || "").trim().toLowerCase();

  const getRole = (user) => normalize(user?.role);

  const isAdminRole = (role) => {
    const cleanRole = normalize(role);
    return cleanRole === "admin";
  };

  const isSuperAdminRole = (role) => {
    const cleanRole = normalize(role);
    return cleanRole === "superadmin";
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

  const isUserRole = (role) => {
    const cleanRole = normalize(role);
    return cleanRole === "user" || cleanRole === "";
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

  const isCourseActive = (course) => {
    const status = String(course?.status || "").trim().toLowerCase();
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
      if (loadedPaths.size === 8) {
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
    const unsubDepartments = watchPath("departments", setDepartments);

    return () => {
      unsubCourses();
      unsubUsers();
      unsubVideoLibrary();
      unsubOldVideos();
      unsubAssignments();
      unsubCompleted();
      unsubProgress();
      unsubDepartments();
    };
  }, [authReady, currentUser]);

  /*
   * Every account visible to the Super Admin.
   * currentUser is merged explicitly so the logged-in Super Admin is still
   * counted even if the users listener has not returned that record yet.
   */
  const platformUsers = useMemo(() => {
    const userMap = new Map();

    allUsers.forEach((user) => {
      const key = user.id || user.uid || user.email;
      if (key) userMap.set(String(key), user);
    });

    if (currentUser) {
      const key =
        currentUser.id ||
        currentUser.uid ||
        currentUser.email;

      if (key) {
        userMap.set(String(key), {
          ...(userMap.get(String(key)) || {}),
          ...currentUser,
        });
      }
    }

    return [...userMap.values()];
  }, [allUsers, currentUser]);

  /*
   * Training calculations stay limited to learners and department admins.
   * Admin and Super Admin accounts are included in Total Users, but they do
   * not incorrectly affect assignment/completion analytics.
   */
  const trainingUserList = useMemo(() => {
    return platformUsers.filter((user) => {
      const role = getRole(user);
      return !isAdminRole(role) && !isSuperAdminRole(role);
    });
  }, [platformUsers]);

  const userCount = useMemo(() => {
    return platformUsers.filter((user) =>
      isUserRole(getRole(user))
    ).length;
  }, [platformUsers]);

  const deptAdminCount = useMemo(() => {
    return platformUsers.filter((user) =>
      isDepartmentAdminRole(getRole(user))
    ).length;
  }, [platformUsers]);

  const adminCount = useMemo(() => {
    return platformUsers.filter((user) =>
      isAdminRole(getRole(user))
    ).length;
  }, [platformUsers]);

  const superAdminCount = useMemo(() => {
    return platformUsers.filter((user) =>
      isSuperAdminRole(getRole(user))
    ).length;
  }, [platformUsers]);

  const activeCourses = useMemo(() => {
    return allCourses.filter(isCourseActive);
  }, [allCourses]);

  const validCourseIds = useMemo(() => {
    return new Set(activeCourses.map((c) => c.id));
  }, [activeCourses]);

  const videos = useMemo(() => {
    const map = new Map();
    [...videoLibrary, ...oldVideos].forEach((video) => {
      if (video?.id) map.set(video.id, video);
    });
    return [...map.values()];
  }, [videoLibrary, oldVideos]);

  const totalAssigned = useMemo(() => {
    let count = 0;
    trainingUserList.forEach((user) => {
      const byUid = assignments[user.uid] || {};
      const byId = user.id !== user.uid ? assignments[user.id] || {} : {};
      const merged = { ...byId, ...byUid };
      Object.entries(merged).forEach(([courseId, assignment]) => {
        if (validCourseIds.has(courseId) && isAssignmentActive(assignment)) {
          count++;
        }
      });
    });
    return count;
  }, [trainingUserList, assignments, validCourseIds]);

  const totalCompleted = useMemo(() => {
    let count = 0;
    trainingUserList.forEach((user) => {
      const byUid = completedCourses[user.uid] || {};
      const byId = user.id !== user.uid ? completedCourses[user.id] || {} : {};
      const merged = { ...byId, ...byUid };
      Object.entries(merged).forEach(([courseId, record]) => {
        if (validCourseIds.has(courseId) && isCourseCompleted(record)) {
          count++;
        }
      });
    });
    return count;
  }, [trainingUserList, completedCourses, validCourseIds]);

  const totalInProgress = useMemo(() => {
    let count = 0;
    trainingUserList.forEach((user) => {
      const userProgress = progress[user.uid] || progress[user.id] || {};
      activeCourses.forEach((course) => {
        const byUid = assignments[user.uid] || {};
        const byId = user.id !== user.uid ? assignments[user.id] || {} : {};
        const merged = { ...byId, ...byUid };
        if (!isAssignmentActive(merged[course.id])) return;

        const compByUid = completedCourses[user.uid] || {};
        const compById = user.id !== user.uid ? completedCourses[user.id] || {} : {};
        const compMerged = { ...compById, ...compByUid };
        if (isCourseCompleted(compMerged[course.id])) return;

        const hasStarted = Object.values(userProgress).some((video) => {
          return (
            String(video?.courseId || "") === String(course.id) &&
            (Number(video?.watchedPercent || 0) > 0 || video?.completed)
          );
        });

        if (hasStarted) count++;
      });
    });
    return count;
  }, [trainingUserList, activeCourses, assignments, completedCourses, progress]);

  const totalNotStarted = useMemo(() => {
    return Math.max(totalAssigned - totalCompleted - totalInProgress, 0);
  }, [totalAssigned, totalCompleted, totalInProgress]);

  const totalCertificates = useMemo(() => {
    let count = 0;
    trainingUserList.forEach((user) => {
      const completedByUser = {
        ...(completedCourses[user.id] || {}),
        ...(completedCourses[user.uid] || {}),
      };
      Object.entries(completedByUser).forEach(([courseId, record]) => {
        if (
          validCourseIds.has(courseId) &&
          (record?.certificateUrl ||
            record?.certificateId ||
            record?.certificateIssued ||
            (record?.passed && record?.attemptId))
        ) {
          count++;
        }
      });
    });
    return count;
  }, [trainingUserList, completedCourses, validCourseIds]);

  const completionRate = totalAssigned > 0
    ? Math.round((totalCompleted / totalAssigned) * 100)
    : 0;

  const totalPending = totalInProgress + totalNotStarted;

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
    return activeCourses.map((course) => {
      let assigned = 0, completed = 0, inProgress = 0, notStarted = 0;

      trainingUserList.forEach((user) => {
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
  }, [activeCourses, trainingUserList, assignments, completedCourses, progress]);

  const departmentNameById = useMemo(() => {
    const deptList = objectToArray(departments);

    return Object.fromEntries(
      deptList.map((dept) => [
        dept.id,
        dept.name ||
          dept.title ||
          dept.departmentName ||
          "Unnamed Department",
      ])
    );
  }, [departments]);

  const userNameById = useMemo(() => {
    const entries = platformUsers.flatMap((user) => {
      const displayName =
        user.name ||
        user.fullName ||
        user.displayName ||
        user.email ||
        "Unknown User";

      const keys = [user.id, user.uid]
        .filter(Boolean)
        .map((key) => [String(key), displayName]);

      return keys;
    });

    return Object.fromEntries(entries);
  }, [platformUsers]);

  const latestCourses = useMemo(() => {
    return [...courseStats]
      .map((course) => {
        const departmentId =
          course.departmentId ||
          course.deptId ||
          "";

        const departmentName =
          getDepartmentName(course) ||
          departmentNameById[departmentId] ||
          "Department not specified";

        const creatorId =
          course.createdBy ||
          course.createdById ||
          course.creatorId ||
          course.adminId ||
          "";

        const createdByName =
          course.createdByName ||
          course.creatorName ||
          course.createdByEmail ||
          userNameById[String(creatorId)] ||
          "Creator not specified";

        return {
          ...course,
          departmentName,
          createdByName,
        };
      })
      .sort((a, b) => {
        const bTime = getTime(
          b.createdAt ||
            b.createdOn ||
            b.dateCreated ||
            b.updatedAt
        );

        const aTime = getTime(
          a.createdAt ||
            a.createdOn ||
            a.dateCreated ||
            a.updatedAt
        );

        return bTime - aTime;
      })
      .slice(0, 3);
  }, [courseStats, departmentNameById, userNameById]);

  const topDepartments = useMemo(() => {
    const deptMap = {};

    trainingUserList.forEach((user) => {
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

      activeCourses.forEach((course) => {
        const byUid = assignments[user.uid] || {};
        const byId = user.id !== user.uid ? assignments[user.id] || {} : {};
        const merged = { ...byId, ...byUid };
        if (isAssignmentActive(merged[course.id])) {
          deptMap[departmentKey].assigned += 1;
        }

        const compByUid = completedCourses[user.uid] || {};
        const compById = user.id !== user.uid ? completedCourses[user.id] || {} : {};
        const compMerged = { ...compById, ...compByUid };
        if (isCourseCompleted(compMerged[course.id])) {
          deptMap[departmentKey].completed += 1;
        }
      });
    });

    return Object.values(deptMap)
      .map((item) => ({
        ...item,
        rate:
          item.assigned > 0
            ? Math.round((item.completed / item.assigned) * 100)
            : 0,
      }))
      .sort(
        (a, b) =>
          b.rate - a.rate ||
          b.users - a.users ||
          a.department.localeCompare(b.department)
      )
      .slice(0, 5);
  }, [trainingUserList, activeCourses, assignments, completedCourses, departmentNameById]);

  const userRows = useMemo(() => {
    return trainingUserList
      .map((user) => {
        let assigned = 0, completed = 0, inProgress = 0, notStarted = 0;
        activeCourses.forEach((course) => {
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
          department: getDepartmentName(user) || "-",
          assigned, completed, inProgress, notStarted,
          pending: inProgress + notStarted,
          rate,
        };
      })
      .filter((user) => user.assigned > 0)
      .sort((a, b) => b.assigned - a.assigned || a.rate - b.rate);
  }, [trainingUserList, activeCourses, assignments, completedCourses, progress]);

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
          <p>Real-time stats across all users, departments and courses.</p>
          <div className="hero-stats">
            <Link to="/super-admin/users" className="hero-stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="hero-stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <strong>{platformUsers.length}</strong>
                <span>Total Users</span>
              </div>
            </Link>
            <Link to="/super-admin/admins" className="hero-stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="hero-stat-icon admins-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </div>
              <div>
                <strong>{adminCount}</strong>
                <span>Admins</span>
              </div>
            </Link>
            <Link to="/super-admin/users" className="hero-stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="hero-stat-icon dept-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <strong>{deptAdminCount}</strong>
                <span>Dept Admins</span>
              </div>
            </Link>
            <Link to="/super-admin/analytics" className="hero-stat" style={{ textDecoration: "none", color: "inherit" }}>
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

      <section className="dash-stat-cards">
        <Link to="/super-admin/users" className="stat-card stat-courses" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Total Users</span>
            <strong>{platformUsers.length}</strong>
          </div>
        </Link>

        <Link to="/super-admin/analytics" className="stat-card stat-progress" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Total Assigned</span>
            <strong>{totalAssigned}</strong>
          </div>
        </Link>

        <Link to="/super-admin/analytics" className="stat-card stat-completed" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Completed</span>
            <strong>{totalCompleted}</strong>
          </div>
        </Link>

        <Link to="/super-admin/analytics" className="stat-card stat-progress" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div className="stat-card-info">
            <span>In Progress</span>
            <strong>{totalInProgress}</strong>
          </div>
        </Link>

        <Link to="/super-admin/analytics" className="stat-card stat-rate" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Completion Rate</span>
            <strong>{completionRate}%</strong>
          </div>
        </Link>
      </section>

      <section className="dash-content-row">
        <div className="dash-card courses-card">
          <div className="card-head">
            <div>
              <h2>Latest Courses</h2>
              <p>Three most recently created courses</p>
            </div>
            <Link to="/super-admin/courses" className="view-all-link">View All</Link>
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

                      <span>
                        {course.departmentName}
                        {" • "}
                        Created by {course.createdByName}
                      </span>

                      <span>
                        {course.assigned} Assigned
                        {" • "}
                        {course.completed} Completed
                      </span>
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
            <h2>User Directory Snapshot</h2>
            <p>Account breakdown across the complete LMS</p>
          </div>

          <div className="quick-mini-cards">
            <Link
              to="/super-admin/users"
              className="quick-mini"
              style={{ textDecoration: "none" }}
            >
              <strong>{platformUsers.length}</strong>
              <span>Total Accounts</span>
            </Link>

            <Link
              to="/super-admin/users"
              className="quick-mini"
              style={{ textDecoration: "none" }}
            >
              <strong>{userCount}</strong>
              <span>Learners</span>
            </Link>

            <Link
              to="/super-admin/admins"
              className="quick-mini"
              style={{ textDecoration: "none" }}
            >
              <strong>{adminCount}</strong>
              <span>Admins</span>
            </Link>

            <Link
              to="/super-admin/users"
              className="quick-mini"
              style={{ textDecoration: "none" }}
            >
              <strong>{deptAdminCount}</strong>
              <span>Dept Admins</span>
            </Link>

            <div className="quick-mini">
              <strong>{superAdminCount}</strong>
              <span>Super Admins</span>
            </div>

            <Link
              to="/super-admin/courses"
              className="quick-mini"
              style={{ textDecoration: "none" }}
            >
              <strong>{activeCourses.length}</strong>
              <span>Active Courses</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="dash-four-cards">
        <Link to="/super-admin/analytics" className="light-summary-card" style={{ textDecoration: "none" }}>
          <div className="light-card-icon" style={{ background: "#ede9fe", color: "#7c3aed" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          </div>
          <div className="light-card-text">
            <strong>{totalAssigned}</strong>
            <span>Total Assigned</span>
          </div>
        </Link>

        <Link to="/super-admin/analytics" className="light-summary-card" style={{ textDecoration: "none" }}>
          <div className="light-card-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="light-card-text">
            <strong>{totalCompleted}</strong>
            <span>Completed</span>
          </div>
        </Link>

        <Link to="/super-admin/analytics" className="light-summary-card" style={{ textDecoration: "none" }}>
          <div className="light-card-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div className="light-card-text">
            <strong>{totalInProgress}</strong>
            <span>In Progress</span>
          </div>
        </Link>

        <Link to="/super-admin/analytics" className="light-summary-card" style={{ textDecoration: "none" }}>
          <div className="light-card-icon" style={{ background: "#fee2e2", color: "#dc2626" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
          </div>
          <div className="light-card-text">
            <strong>{totalCertificates}</strong>
            <span>Certificates</span>
          </div>
        </Link>
      </section>

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
            <span>Total Users</span>
            <strong>{platformUsers.length}</strong>
          </div>
        </div>

        <div className="dash-card department-card">
          <div className="card-title-row">
            <h2>Top Departments</h2>
          </div>
          {topDepartments.length === 0 ? (
            <p className="empty-text">No department data yet.</p>
          ) : (
            topDepartments.map((item, index) => (
              <div className="dept-row" key={item.departmentId || item.department}>
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
        </div>
      </section>
    </div>
  );
}

export default SuperAdminDashboard;
