import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, ref, remove } from "firebase/database";
import { auth, database } from "../firebase";
import { createNotification } from "../services/doubtService";
import "../styles/superadmin.css";
import "../styles/assignedusers.css";
import {
  isAnalyticsTrainingUser,
  isAdminRole,
  isSuperAdminRole,
  isDepartmentAdminRole,
  getUserKeys,
  mergeUserRecords,
  isAssignmentActive,
  isCompletedRecord,
  isCourseCompletedForUser,
  hasCertificate,
  getCertificateKey,
  getUserCertificateCount,
  getUserZone,
  getUserZoneField,
  normalizeZone,
  calculateGroupStats,
  calculateZoneStats,
  getUniqueAnalyticsTrainingUsers,
  flattenAttempts,
  computeTestPerformance,
  getTime,
  objectToArray,
  getDepartmentName,
  getCourseTitle,
  getCourseThumbnail,
  isCourseActive,
  getVal,
  getStatusLabel,
} from "../utils/trainingAnalytics";

const getRole = (user) => String(user?.role || "").trim().toLowerCase();

function AdminDashboard() {
  const [currentUser, setCurrentUser] = useState(null);

  const [allCourses, setAllCourses] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [videoLibrary, setVideoLibrary] = useState([]);
  const [oldVideos, setOldVideos] = useState([]);

  const [assignments, setAssignments] = useState({});
  const [completedCourses, setCompletedCourses] = useState({});
  const [rawAttempts, setRawAttempts] = useState({});
  const [rawQuizAttempts, setRawQuizAttempts] = useState({});
  const [progress, setProgress] = useState({});
  const [videoProgress, setVideoProgress] = useState({});
  const [courseProgress, setCourseProgress] = useState({});
  const [departments, setDepartments] = useState({});

  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const [expandedCourseId, setExpandedCourseId] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const isUserRole = (role) => {
    const cleanRole = String(role || "").trim().toLowerCase();
    return cleanRole === "user" || cleanRole === "";
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
      if (loadedPaths.size === 12) {
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
    const unsubAttempts = watchPath("attempts", setRawAttempts);
    const unsubQuizAttempts = watchPath("quizAttempts", setRawQuizAttempts);
    const unsubProgress = watchPath("progress", setProgress);
    const unsubVideoProgress = watchPath("videoProgress", setVideoProgress);
    const unsubCourseProgress = watchPath("courseProgress", setCourseProgress);
    const unsubDepartments = watchPath("departments", setDepartments);

    return () => {
      unsubCourses();
      unsubUsers();
      unsubVideoLibrary();
      unsubOldVideos();
      unsubAssignments();
      unsubCompleted();
      unsubAttempts();
      unsubQuizAttempts();
      unsubProgress();
      unsubVideoProgress();
      unsubCourseProgress();
      unsubDepartments();
    };
  }, [authReady, currentUser]);

  const platformUsers = useMemo(() => {
    const userMap = new Map();

    allUsers.forEach((user) => {
      const key = user?.uid || user?.id || user?.email;
      if (key) userMap.set(String(key), user);
    });

    if (currentUser) {
      const key =
        currentUser?.uid ||
        currentUser?.id ||
        currentUser?.email;

      if (key) {
        userMap.set(String(key), {
          ...(userMap.get(String(key)) || {}),
          ...currentUser,
        });
      }
    }

    return [...userMap.values()];
  }, [allUsers, currentUser]);

  const trainingUserList = useMemo(() => {
    return platformUsers;
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
        if (validCourseIds.has(courseId) && isCompletedRecord(record)) {
          count++;
        }
      });
    });
    return count;
  }, [trainingUserList, completedCourses, validCourseIds]);

  const getCourseStatusForUser = (userId, courseId) => {
    const assignment = assignments?.[userId]?.[courseId];
    if (!isAssignmentActive(assignment)) return "notAssigned";

    const completed = completedCourses?.[userId]?.[courseId];
    if (
      completed === true ||
      completed?.passed ||
      completed?.completed ||
      completed?.isCompleted
    ) return "completed";

    const cp = courseProgress?.[userId]?.[courseId];
    if (cp?.completed || cp?.courseTestPassed || cp?.passed || cp?.progressPercentage >= 100) return "completed";

    const vp = videoProgress?.[userId]?.[courseId];
    if (vp && typeof vp === "object") {
      const vals = Object.values(vp);
      const anyStarted = vals.some((v) => Number(v?.progressPercentage || v?.watchedPercent || 0) > 0 || v?.completed);
      const allDone = vals.length > 0 && vals.every((v) => v?.completed || Number(v?.progressPercentage || v?.watchedPercent || 0) >= 100);
      if (allDone) return "completed";
      if (anyStarted) return "inProgress";
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

  const totalInProgress = useMemo(() => {
    let count = 0;
    trainingUserList.forEach((user) => {
      activeCourses.forEach((course) => {
        const status = getCourseStatusForUser(user.id || user.uid, course.id);
        if (status === "inProgress") count++;
      });
    });
    return count;
  }, [trainingUserList, activeCourses, assignments, completedCourses, progress, videoProgress, courseProgress]);

  const totalNotStarted = useMemo(() => {
    return Math.max(totalAssigned - totalCompleted - totalInProgress, 0);
  }, [totalAssigned, totalCompleted, totalInProgress]);

  const totalCertificates = useMemo(() => {
    const learners = getUniqueAnalyticsTrainingUsers(platformUsers);
    return learners.reduce((sum, user) => {
      return sum + getUserCertificateCount(user, completedCourses);
    }, 0);
  }, [platformUsers, completedCourses]);

  const totalVideosCompleted = useMemo(() => {
    let count = 0;
    const isDone = (v) =>
      v?.completed === true ||
      Number(v?.progressPercentage || v?.watchedPercent || v?.progress || 0) >= 100;
    Object.values(videoProgress || {}).forEach((userEntry) => {
      if (!userEntry || typeof userEntry !== "object") return;
      Object.values(userEntry).forEach((courseEntry) => {
        if (!courseEntry || typeof courseEntry !== "object") return;
        Object.values(courseEntry).forEach((v) => {
          if (v && typeof v === "object" && isDone(v)) count++;
        });
      });
    });
    Object.values(progress || {}).forEach((userEntry) => {
      if (!userEntry || typeof userEntry !== "object") return;
      Object.values(userEntry).forEach((v) => {
        if (v && typeof v === "object" && isDone(v)) count++;
      });
    });
    return count;
  }, [progress, videoProgress]);

  const completionRate = totalAssigned > 0
    ? Math.round((totalCompleted / totalAssigned) * 100)
    : 0;

  const totalPending = totalInProgress + totalNotStarted;

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
  }, [activeCourses, trainingUserList, assignments, completedCourses, progress, videoProgress, courseProgress]);

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

  const zoneStats = useMemo(() => {
    return calculateZoneStats({
      users: getUniqueAnalyticsTrainingUsers(platformUsers),
      assignments,
      completedCourses,
      courseProgress,
      videoProgress,
    });
  }, [platformUsers, assignments, completedCourses, courseProgress, videoProgress]);

  const latestCourses = useMemo(() => {
    return [...courseStats]
      .map((course) => {
        const departmentId = course.departmentId || course.deptId || "";
        const departmentName = getDepartmentName(course) || departmentNameById[departmentId] || "Department not specified";
        const creatorId = course.createdBy || course.createdById || course.creatorId || course.adminId || "";
        const createdByName = course.createdByName || course.creatorName || course.createdByEmail || userNameById[String(creatorId)] || "Creator not specified";

        return { ...course, departmentName, createdByName };
      })
      .sort((a, b) => {
        const bTime = getTime(b.createdAt || b.createdOn || b.dateCreated || b.updatedAt);
        const aTime = getTime(a.createdAt || a.createdOn || a.dateCreated || a.updatedAt);
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [courseStats, departmentNameById, userNameById]);

  const expandedCourseData = useMemo(() => {
    if (!expandedCourseId) return null;
    const course = courseStats.find((c) => c.id === expandedCourseId);
    if (!course) return null;

    const assignedUsers = [];
    trainingUserList.forEach((user) => {
      const byUid = assignments[user.uid] || {};
      const byId = user.id !== user.uid ? assignments[user.id] || {} : {};
      const merged = { ...byId, ...byUid };
      const a = merged[course.id];
      if (a?.assigned) {
        const status = getCourseStatusForUser(user.id || user.uid, course.id);
        assignedUsers.push({ ...user, status, userId: user.id || user.uid });
      }
    });

    return { ...course, assignedUsers };
  }, [expandedCourseId, courseStats, trainingUserList, assignments, completedCourses, progress, videoProgress, courseProgress]);

  const filteredUsers = useMemo(() => {
    if (!expandedCourseData) return [];
    return expandedCourseData.assignedUsers.filter((u) => {
      const text = [u.name, u.email, u.designation, u.zone, u.Zone, u.zoneName, u.region, u.regionName, u.state, u.State, u.cityArea].filter(Boolean).join(" ").toLowerCase();
      return (
        text.includes(filterSearch.toLowerCase()) &&
        (!filterStatus || u.status === filterStatus)
      );
    });
  }, [expandedCourseData, filterSearch, filterStatus]);

  const unassignUser = async (userId, courseId, userName) => {
    if (!window.confirm(`Unassign "${userName}" from this course?`)) return;
    try {
      await remove(ref(database, `userAssignments/${userId}/${courseId}`));
      setAssignments((prev) => {
        const copy = { ...prev };
        if (copy[userId]) {
          const userCopy = { ...copy[userId] };
          delete userCopy[courseId];
          copy[userId] = userCopy;
        }
        return copy;
      });
      createNotification(userId, {
        type: "course_removed",
        courseId: courseId,
        courseTitle: expandedCourseData?.title || "",
        title: "Course Removed",
        message: `Your access to '${expandedCourseData?.title || "a course"}' has been removed.`,
      }).catch((e) => console.error("Failed to send unassign notification:", e));
    } catch (e) {
      console.error(e);
      alert("Failed to unassign.");
    }
  };

  const topDepartments = useMemo(() => {
    const deptMap = {};

    trainingUserList.forEach((user) => {
      const departmentId = user.departmentId || "";
      const departmentName = user.department || departmentNameById[departmentId] || "Not Assigned";
      const departmentKey = departmentId || `name:${departmentName.toLowerCase()}`;

      if (!deptMap[departmentKey]) {
        deptMap[departmentKey] = { department: departmentName, departmentId, users: 0, assigned: 0, completed: 0 };
      }

      deptMap[departmentKey].users += 1;

      activeCourses.forEach((course) => {
        const byUid = assignments[user.uid] || {};
        const byId = user.id !== user.uid ? assignments[user.id] || {} : {};
        const merged = { ...byId, ...byUid };
        if (!isAssignmentActive(merged[course.id])) return;

        deptMap[departmentKey].assigned += 1;

        if (
          isCourseCompletedForUser(
            user,
            course.id,
            completedCourses,
            courseProgress,
            videoProgress
          )
        ) {
          deptMap[departmentKey].completed += 1;
          return;
        }

        const userProgressEntries = progress?.[user.uid] || progress?.[user.id] || {};
        const courseVideos = Object.values(userProgressEntries).filter(
          (v) => String(v?.courseId || "") === String(course.id)
        );
        if (
          courseVideos.length > 0 &&
          courseVideos.every(
            (v) =>
              v?.completed === true ||
              Number(v?.watchedPercent || 0) >= 100
          )
        ) {
          deptMap[departmentKey].completed += 1;
        }
      });
    });

    const deptList = objectToArray(departments);
    deptList.forEach((dept) => {
      const deptId = dept.id;
      const deptName = dept.departmentName || "Unnamed Department";
      const existingKey = Object.keys(deptMap).find(
        (k) => deptMap[k].department.toLowerCase() === deptName.toLowerCase()
      );
      if (existingKey) {
        deptMap[existingKey].departmentId = deptMap[existingKey].departmentId || deptId;
      } else {
        deptMap[deptId || `name:${deptName.toLowerCase()}`] = { department: deptName, departmentId: deptId, users: 0, assigned: 0, completed: 0 };
      }
    });

    const mergedByName = {};
    Object.values(deptMap).forEach((item) => {
      if (item.department === "Not Assigned") return;
      const key = item.department.toLowerCase();
      if (!mergedByName[key]) {
        mergedByName[key] = { ...item };
      } else {
        mergedByName[key].users += item.users;
        mergedByName[key].assigned += item.assigned;
        mergedByName[key].completed += item.completed;
        if (!mergedByName[key].departmentId && item.departmentId) {
          mergedByName[key].departmentId = item.departmentId;
        }
      }
    });

    return Object.values(mergedByName)
      .map((item) => ({
        ...item,
        rate: item.assigned > 0 ? Math.round((item.completed / item.assigned) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate || b.users - a.users || a.department.localeCompare(b.department));
  }, [trainingUserList, activeCourses, assignments, completedCourses, courseProgress, videoProgress, progress, departmentNameById, departments]);

  const recentActivities = useMemo(() => {
    const activities = [];

    trainingUserList.forEach((user) => {
      const userId = user.uid || user.id;
      const userName = user.name || user.fullName || user.displayName || user.email || "Unknown User";

      const completedByUser = mergeUserRecords(completedCourses, user);

      Object.entries(completedByUser).forEach(([courseId, record]) => {
        if (!isCompletedRecord(record)) return;

        const course = activeCourses.find((item) => String(item.id) === String(courseId));

        activities.push({
          id: `${userId}-${courseId}`,
          userName,
          userPhoto: user.photoURL || "",
          courseTitle: course ? getCourseTitle(course) : "Course completed",
          time: getTime(record?.completedAt || record?.passedAt || record?.updatedAt || record?.timestamp || record?.createdAt),
        });
      });
    });

    return activities.sort((a, b) => b.time - a.time).slice(0, 4);
  }, [trainingUserList, completedCourses, activeCourses]);

  const testPerformance = useMemo(() => {
    return computeTestPerformance(flattenAttempts(rawAttempts, rawQuizAttempts));
  }, [rawAttempts, rawQuizAttempts]);

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
            <Link to="/admin/users" className="hero-stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="hero-stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <strong>{platformUsers.length}</strong>
                <span>Total Users</span>
              </div>
            </Link>
            <Link to="/admin/users" className="hero-stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="hero-stat-icon admins-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </div>
              <div>
                <strong>{adminCount}</strong>
                <span>Admins</span>
              </div>
            </Link>
            <Link to="/admin/users" className="hero-stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="hero-stat-icon dept-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <strong>{deptAdminCount}</strong>
                <span>Dept Admins</span>
              </div>
            </Link>
            <Link to="/admin/analytics" className="hero-stat" style={{ textDecoration: "none", color: "inherit" }}>
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
        <Link to="/admin/analytics" className="stat-card stat-courses" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Total Assignments</span>
            <strong>{totalAssigned}</strong>
          </div>
        </Link>

        <Link to="/admin/analytics" className="stat-card stat-completed" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Courses Completed</span>
            <strong>{totalCompleted}</strong>
          </div>
        </Link>

        <Link to="/admin/analytics" className="stat-card stat-progress" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Videos Completed</span>
            <strong>{totalVideosCompleted}</strong>
          </div>
        </Link>

        <Link to="/admin/analytics" className="stat-card stat-rate" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Certificates Issued</span>
            <strong>{totalCertificates}</strong>
          </div>
        </Link>

        <Link to="/admin/analytics" className="stat-card stat-progress" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Average Score</span>
            <strong>{testPerformance.average}%</strong>
          </div>
        </Link>
      </section>

      <section className="dashboard-overview-row">
        <div className="dash-card department-progress-card">
          <div className="card-head compact-card-head">
            <div>
              <h2>Department-wise Progress</h2>
              <p>Members and overall course completion</p>
            </div>
          </div>

          <div className="department-progress-list">
            {topDepartments.length === 0 ? (
              <p className="empty-text">No department data available.</p>
            ) : (
              topDepartments.map((item) => (
                <Link
                  to={`/admin/department-analytics?dept=${encodeURIComponent(item.department)}`}
                  className="department-progress-row department-progress-link"
                  key={item.departmentId || item.department}
                >
                  <div className="department-progress-top">
                    <div>
                      <h3>{item.department}</h3>
                      <span>{item.users} members</span>
                    </div>
                    <strong>{item.rate}%</strong>
                  </div>
                  <div className="department-progress-track">
                    <span style={{ width: `${item.rate}%` }}></span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="dash-card zone-summary-card">
          <div className="card-head compact-card-head">
            <div>
              <h2>Zone-wise Progress</h2>
              <p>Overall course completion by zone</p>
            </div>
          </div>

          <div className="zone-summary-grid">
            {zoneStats.map((item) => (
              <Link
                key={item.zone}
                to={`/admin/analytics?zone=${encodeURIComponent(item.zone)}`}
                className={`zone-summary-item zone-${item.zone.toLowerCase()}`}
              >
                <div className="zone-summary-heading">
                  <div className="zone-summary-icon">
                    {item.zone.charAt(0)}
                  </div>
                  <div>
                    <h3>{item.zone} Zone</h3>
                    <span>
                      {item.userCount} users &bull; {item.completed} of {item.assigned} completed
                    </span>
                  </div>
                </div>
                <strong>{item.percentage}%</strong>
                <div className="zone-summary-track">
                  <span style={{ width: `${item.percentage}%` }}></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-insights-row">
        <div className="dash-card compact-insight-card completion-donut-card">
          <div className="insight-card-head">
            <div>
              <h2>Completion Overview</h2>
              <p>Overall assigned course completion</p>
            </div>
          </div>

          <div className="compact-donut-content">
            <div className="compact-css-donut" style={{ "--completion": `${completionRate * 3.6}deg` }}>
              <div className="compact-donut-center">
                <strong>{completionRate}%</strong>
                <span>Completed</span>
              </div>
            </div>

            <div className="donut-summary-list">
              <div>
                <span className="summary-dot completed-dot"></span>
                <p>Completed</p>
                <strong>{totalCompleted}</strong>
              </div>
              <div>
                <span className="summary-dot progress-dot"></span>
                <p>In Progress</p>
                <strong>{totalInProgress}</strong>
              </div>
              <div>
                <span className="summary-dot pending-dot"></span>
                <p>Not Started</p>
                <strong>{totalNotStarted}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="dash-card compact-insight-card recent-activity-card">
          <div className="insight-card-head">
            <div>
              <h2>Recent Activity</h2>
              <p>Latest course completions</p>
            </div>
            <Link to="/admin/analytics">View All</Link>
          </div>

          <div className="recent-activity-list">
            {recentActivities.length === 0 ? (
              <p className="empty-text">No recent activity available.</p>
            ) : (
              recentActivities.map((activity) => (
                <div className="recent-activity-item" key={activity.id}>
                  <div className="activity-avatar">
                    {activity.userPhoto ? (
                      <img src={activity.userPhoto} alt={activity.userName} className="activity-avatar-img" />
                    ) : (
                      activity.userName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="activity-copy">
                    <h3>{activity.userName}</h3>
                    <span>Completed {activity.courseTitle}</span>
                  </div>
                  <span className="activity-status">Done</span>
                </div>
              ))
            )}
          </div>
        </div>

        <Link to="/admin/results" className="dash-card compact-insight-card test-performance-card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="insight-card-head">
            <div>
              <h2>Test Performance</h2>
              <p>Course test &amp; video quiz results</p>
            </div>
            <span>View All</span>
          </div>

          <div className="test-mini-grid">
            <div className="tm-blue">
              <span>Users Attempted</span>
              <strong>{testPerformance.uniqueUsers}</strong>
            </div>
            <div className="tm-violet">
              <span>Total Attempts</span>
              <strong>{testPerformance.totalAttempts}</strong>
            </div>
            <div className="tm-green">
              <span>Passed</span>
              <strong>{testPerformance.passed}</strong>
            </div>
            <div className="tm-red">
              <span>Failed</span>
              <strong>{testPerformance.failed}</strong>
            </div>
            <div className="tm-amber">
              <span>Pass Rate</span>
              <strong>{testPerformance.passRate}%</strong>
            </div>
            <div className="tm-teal">
              <span>Avg Score</span>
              <strong>{testPerformance.average}%</strong>
            </div>
          </div>
        </Link>
      </section>

      <section className="dash-card latest-course-section">
        <div className="card-head compact-card-head">
          <div>
            <h2>Latest Course Progress</h2>
            <p>{expandedCourseId ? "Assigned users for selected course" : "Five most recently created courses"}</p>
          </div>

          {expandedCourseId ? (
            <button className="au-back-btn" onClick={() => { setExpandedCourseId(""); setFilterSearch(""); setFilterStatus(""); }} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 14px", fontSize: "0.78rem" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
              All Courses
            </button>
          ) : (
            <Link to="/admin/assigned-users" className="view-all-link">View All</Link>
          )}
        </div>

        {!expandedCourseId && (
          <div className="latest-course-grid">
            {latestCourses.length === 0 ? (
              <p className="empty-text">No courses available yet.</p>
            ) : (
              latestCourses.map((course) => {
                const thumb = getCourseThumbnail(course);
                return (
                  <button
                    type="button"
                    className="latest-course-card"
                    key={course.id}
                    title={`View assigned users for ${course.title}`}
                    onClick={() => setExpandedCourseId(course.id)}
                    style={{ cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
                  >
                    <div className="latest-course-media">
                      {thumb ? (
                        <img src={thumb} alt={course.title} />
                      ) : (
                        <div className="latest-course-placeholder">
                          {(course.title?.charAt(0) || "C").toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="latest-course-body">
                      <h3 title={course.title}>{course.title}</h3>
                      <span className="latest-course-created">Created by {course.departmentName}</span>
                      <div className="latest-course-numbers">
                        <span>{course.completed}/{course.assigned} completed</span>
                        <strong>{course.rate}%</strong>
                      </div>
                      <div className="latest-course-track">
                        <span style={{ width: `${course.rate}%` }}></span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {expandedCourseData && (
          <div className="au-fade-in" style={{ marginTop: "18px" }}>
            <div className="au-toolbar">
              <div className="au-filters" style={{ width: "100%" }}>
                <div className="au-search-box">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  <input type="text" placeholder="Search name, email..." value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
                </div>
                <div className="au-status-pills">
                  <button className={`au-pill ${filterStatus === "" ? "active" : ""}`} onClick={() => setFilterStatus("")}>All</button>
                  <button className={`au-pill au-pill-notstarted ${filterStatus === "notStarted" ? "active" : ""}`} onClick={() => setFilterStatus("notStarted")}>Not Started</button>
                  <button className={`au-pill au-pill-progress ${filterStatus === "inProgress" ? "active" : ""}`} onClick={() => setFilterStatus("inProgress")}>In Progress</button>
                  <button className={`au-pill au-pill-done ${filterStatus === "completed" ? "active" : ""}`} onClick={() => setFilterStatus("completed")}>Completed</button>
                </div>
              </div>
            </div>

            <div className="au-status-bar">
              <div className="au-status-chip au-chip-all" onClick={() => setFilterStatus("")}>
                <strong>{expandedCourseData.assigned}</strong><span>All</span>
              </div>
              <div className="au-status-chip au-chip-notstarted" onClick={() => setFilterStatus("notStarted")}>
                <strong>{expandedCourseData.notStarted}</strong><span>Not Started</span>
              </div>
              <div className="au-status-chip au-chip-progress" onClick={() => setFilterStatus("inProgress")}>
                <strong>{expandedCourseData.inProgress}</strong><span>In Progress</span>
              </div>
              <div className="au-status-chip au-chip-done" onClick={() => setFilterStatus("completed")}>
                <strong>{expandedCourseData.completed}</strong><span>Completed</span>
              </div>
            </div>

            <div className="au-card">
              <div className="au-table-head">
                <h2>Assigned Users ({filteredUsers.length})</h2>
              </div>
              <div className="au-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Designation</th>
                      <th>Zone</th>
                      <th>State</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan="8" className="au-empty">No users found.</td></tr>
                    ) : filteredUsers.map((u, idx) => (
                      <tr key={u.id || u.uid || idx} className="au-table-row-enter" style={{ animationDelay: `${idx * 30}ms` }}>
                        <td className="au-td-idx">{idx + 1}</td>
                        <td className="au-td-name"><strong>{u.name || "-"}</strong></td>
                        <td className="au-td-email">{u.email || "-"}</td>
                        <td>{u.designation || "-"}</td>
                        <td>{getUserZoneField(u) || "-"}</td>
                        <td>{getVal(u, ["state", "State"]) || "-"}</td>
                        <td>
                          <span className={`au-status-badge au-status-${u.status}`}>
                            {getStatusLabel(u.status)}
                          </span>
                        </td>
                        <td>
                          <button className="au-unassign-btn" onClick={() => unassignUser(u.id || u.uid, expandedCourseId, u.name || "this user")}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                            Unassign
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminDashboard;