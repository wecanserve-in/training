import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, ref, remove } from "firebase/database";
import { auth, database } from "../firebase";
import { createNotification } from "../services/doubtService";
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
} from "../utils/trainingAnalytics";
import "../styles/superadmin.css";
import "../styles/assignedusers.css";
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
  const [videoProgress, setVideoProgress] = useState({});
  const [courseProgress, setCourseProgress] = useState({});

  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const [expandedCourseId, setExpandedCourseId] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const normalize = (value) => String(value || "").trim().toLowerCase();

  const getRole = (user) => normalize(user?.role);

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

  const isCourseActive = (course) => {
    const status = String(course?.status || "").trim().toLowerCase();
    return !["inactive", "archived", "deleted", "draft"].includes(status);
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
      if (loadedPaths.size === 9) {
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
    const unsubVideoProgress = watchPath("videoProgress", setVideoProgress);
    const unsubCourseProgress = watchPath("courseProgress", setCourseProgress);

    return () => {
      unsubCourses();
      unsubUsers();
      unsubVideoLibrary();
      unsubOldVideos();
      unsubAssignments();
      unsubCompleted();
      unsubProgress();
      unsubVideoProgress();
      unsubCourseProgress();
    };
  }, [authReady, currentUser]);

  const departmentName =
    currentUser?.department ||
    currentUser?.departmentName ||
    currentUser?.departmentType ||
    "";

  const deptUsers = useMemo(() => {
    const userDeptId = String(currentUser?.departmentId || "").trim();
    const userDept = String(departmentName || "").trim().toLowerCase();
    return allUsers.filter((user) => {
      const role = getRole(user);
      if (isAdminRole(role) || isDepartmentAdminRole(role)) return false;
      if (!userDeptId && !userDept) return true;
      const userDeptIdField = String(user.departmentId || "").trim();
      const userDeptName = String(getDepartmentName(user) || "").trim().toLowerCase();
      if (userDeptId && userDeptIdField && userDeptIdField === userDeptId) return true;
      if (userDept && userDeptName && userDeptName === userDept) return true;
      return false;
    });
  }, [allUsers, currentUser, departmentName]);

  const deptCourses = useMemo(() => {
    const userDeptId = String(currentUser?.departmentId || "").trim();
    const userDept = String(departmentName || "").trim().toLowerCase();

    if (!userDeptId && !userDept) return [];

    return allCourses
      .filter((course) => {
        if (!isCourseActive(course)) return false;
        const courseDeptId = String(course.departmentId || "").trim();
        const courseDept = String(getDepartmentName(course) || "").trim().toLowerCase();
        if (courseDeptId && userDeptId && courseDeptId === userDeptId) return true;
        if (courseDept && userDept && courseDept === userDept) return true;
        return false;
      })
      .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
  }, [allCourses, currentUser, departmentName]);

  const videos = useMemo(() => {
    const map = new Map();
    [...videoLibrary, ...oldVideos].forEach((video) => {
      if (video?.id) map.set(video.id, video);
    });
    return [...map.values()].filter((video) => {
      return (
        video.createdBy === currentUser?.id ||
        video.createdById === currentUser?.id ||
        sameText(video.createdByEmail, currentUser?.email) ||
        (currentUser?.departmentId && video.departmentId === currentUser.departmentId) ||
        sameText(getDepartmentName(video), departmentName)
      );
    });
  }, [videoLibrary, oldVideos, currentUser, departmentName]);

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

  const courseStats = useMemo(() => {
    return deptCourses.map((course) => {
      let assigned = 0, completed = 0, inProgress = 0, notStarted = 0;

      deptUsers.forEach((user) => {
        const status = getCourseStatusForUser(user.id || user.uid, course.id);
        if (status === "notAssigned") return;
        assigned++;
        if (status === "completed") completed++;
        if (status === "inProgress") inProgress++;
        if (status === "notStarted") notStarted++;
      });

      const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

      return { ...course, title: getCourseTitle(course), assigned, completed, inProgress, notStarted, pending: inProgress + notStarted, rate };
    });
  }, [deptCourses, deptUsers, assignments, completedCourses, progress, videoProgress, courseProgress]);

  const totalAssigned = useMemo(() => courseStats.reduce((t, c) => t + c.assigned, 0), [courseStats]);
  const totalCompleted = useMemo(() => courseStats.reduce((t, c) => t + c.completed, 0), [courseStats]);
  const totalInProgress = useMemo(() => courseStats.reduce((t, c) => t + c.inProgress, 0), [courseStats]);
  const totalNotStarted = useMemo(() => courseStats.reduce((t, c) => t + c.notStarted, 0), [courseStats]);
  const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  const totalCertificates = useMemo(() => {
    const learners = getUniqueAnalyticsTrainingUsers(deptUsers);
    return learners.reduce((sum, user) => {
      return sum + getUserCertificateCount(user, completedCourses);
    }, 0);
  }, [deptUsers, completedCourses]);

  const countCompletedVideos = (data) => {
    let c = 0;
    Object.values(data || {}).forEach((userEntry) => {
      if (!userEntry || typeof userEntry !== "object") return;
      Object.values(userEntry).forEach((v) => {
        if (v?.completed === true || Number(v?.progressPercentage || v?.watchedPercent || v?.progress || 0) >= 100) {
          c++;
        }
      });
    });
    return c;
  };

  const totalVideosCompleted = useMemo(() => {
    return countCompletedVideos(progress) + countCompletedVideos(videoProgress);
  }, [progress, videoProgress]);

  const averageScore = useMemo(() => {
    let totalScore = 0;
    let scoreCount = 0;

    deptUsers.forEach((user) => {
      const merged = mergeUserRecords(completedCourses, user);

      Object.values(merged).forEach((courseRecord) => {
        if (!courseRecord || typeof courseRecord !== "object") return;

        const score = Number(
          courseRecord.percentage ??
          courseRecord.score ??
          courseRecord.finalScore ??
          courseRecord.marksPercentage ??
          courseRecord.testPercentage
        );

        if (Number.isFinite(score) && score >= 0) {
          totalScore += score;
          scoreCount++;
        }
      });
    });

    return scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
  }, [deptUsers, completedCourses]);

  const userNameById = useMemo(() => {
    const entries = allUsers.flatMap((user) => {
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
  }, [allUsers]);

  const latestCourses = useMemo(() => {
    return [...courseStats]
      .map((course) => {
        const creatorId = course.createdBy || course.createdById || course.creatorId || course.adminId || "";
        const createdByName = course.createdByName || course.creatorName || course.createdByEmail || userNameById[String(creatorId)] || "Creator not specified";

        return { ...course, createdByName };
      })
      .sort((a, b) => {
        const bTime = getTime(b.createdAt || b.createdOn || b.dateCreated || b.updatedAt);
        const aTime = getTime(a.createdAt || a.createdOn || a.dateCreated || a.updatedAt);
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [courseStats, userNameById]);

  const expandedCourseData = useMemo(() => {
    if (!expandedCourseId) return null;
    const course = courseStats.find((c) => c.id === expandedCourseId);
    if (!course) return null;

    const assignedUsers = [];
    deptUsers.forEach((user) => {
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
  }, [expandedCourseId, courseStats, deptUsers, assignments, completedCourses, progress, videoProgress, courseProgress]);

  const filteredUsers = useMemo(() => {
    if (!expandedCourseData) return [];
    return expandedCourseData.assignedUsers.filter((u) => {
      const text = [u.name, u.email, u.designation, u.zone, u.state, u.cityArea].filter(Boolean).join(" ").toLowerCase();
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

  const getVal = (obj, keys) => {
    for (const k of keys) { if (obj?.[k]) return String(obj[k]).trim(); }
    return "";
  };

  const getStatusLabel = (s) => s === "completed" ? "Completed" : s === "inProgress" ? "In Progress" : "Not Started";

  const zoneStats = useMemo(() => {
    return calculateZoneStats({
      users: getUniqueAnalyticsTrainingUsers(deptUsers),
      assignments,
      completedCourses,
      courseProgress,
      videoProgress,
    });
  }, [deptUsers, assignments, completedCourses, courseProgress, videoProgress]);

  const topPerformers = useMemo(() => {
    return deptUsers
      .map((user) => {
        let assigned = 0, completed = 0;
        deptCourses.forEach((course) => {
          const status = getCourseStatusForUser(user.id || user.uid, course.id);
          if (status === "notAssigned") return;
          assigned++;
          if (status === "completed") completed++;
        });
        const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
        return {
          id: user.id || user.uid,
          name: user.name || user.fullName || user.displayName || user.email || "Unknown",
          email: user.email || "",
          zone: getUserZoneField(user) || "-",
          assigned,
          completed,
          rate,
        };
      })
      .filter((u) => u.assigned > 0 && u.rate > 0)
      .sort((a, b) => b.rate - a.rate || b.completed - a.completed)
      .slice(0, 5);
  }, [deptUsers, deptCourses, assignments, completedCourses, progress, videoProgress, courseProgress]);

  const userProgressRows = useMemo(() => {
    return deptUsers
      .map((user) => {
        let assigned = 0, completed = 0, inProgress = 0, notStarted = 0;
        deptCourses.forEach((course) => {
          const status = getCourseStatusForUser(user.id || user.uid, course.id);
          if (status === "notAssigned") return;
          assigned++;
          if (status === "completed") completed++;
          if (status === "inProgress") inProgress++;
          if (status === "notStarted") notStarted++;
        });
        const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
        return {
          id: user.id || user.uid,
          name: user.name || user.fullName || "Unnamed User",
          email: user.email || "-",
          zone: getUserZoneField(user) || "-",
          designation: user.designation || "-",
          assigned, completed, inProgress, notStarted,
          pending: inProgress + notStarted,
          rate,
        };
      })
      .filter((user) => user.assigned > 0)
      .sort((a, b) => b.rate - a.rate || b.completed - a.completed);
  }, [deptUsers, deptCourses, assignments, completedCourses, progress, videoProgress, courseProgress]);

  const recentActivities = useMemo(() => {
    const activities = [];

    deptUsers.forEach((user) => {
      const userId = user.uid || user.id;
      const userName = user.name || user.fullName || user.displayName || user.email || "Unknown User";

      const completedByUser = mergeUserRecords(completedCourses, user);

      Object.entries(completedByUser).forEach(([courseId, record]) => {
        if (!isCompletedRecord(record)) return;

        const course = deptCourses.find((item) => String(item.id) === String(courseId));

        activities.push({
          id: `${userId}-${courseId}`,
          userName,
          courseTitle: course ? getCourseTitle(course) : "Course completed",
          time: getTime(record?.completedAt || record?.passedAt || record?.updatedAt || record?.timestamp || record?.createdAt),
        });
      });
    });

    return activities.sort((a, b) => b.time - a.time).slice(0, 4);
  }, [deptUsers, completedCourses, deptCourses]);

  const testPerformance = useMemo(() => {
    let totalAttempts = 0;
    let passedAttempts = 0;
    let failedAttempts = 0;
    let scoreTotal = 0;
    let scoredAttempts = 0;

    deptUsers.forEach((user) => {
      const merged = mergeUserRecords(completedCourses, user);

      Object.values(merged).forEach((record) => {
        if (!record || typeof record !== "object") return;

        const hasTestData =
          record.attemptId ||
          record.testAttemptId ||
          record.score !== undefined ||
          record.percentage !== undefined ||
          record.finalScore !== undefined ||
          record.passed !== undefined;

        if (!hasTestData) return;

        totalAttempts += 1;

        const passed =
          record.passed === true ||
          record.completed === true ||
          String(record.status || "").toLowerCase() === "passed";

        if (passed) passedAttempts += 1;
        else failedAttempts += 1;

        const score = Number(
          record.percentage ??
          record.score ??
          record.finalScore ??
          record.marksPercentage ??
          record.testPercentage
        );

        if (Number.isFinite(score) && score >= 0) {
          scoreTotal += score;
          scoredAttempts += 1;
        }
      });
    });

    return {
      totalAttempts,
      passedAttempts,
      failedAttempts,
      passRate: totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0,
      average: scoredAttempts > 0 ? Math.round(scoreTotal / scoredAttempts) : 0,
    };
  }, [deptUsers, completedCourses]);

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
          <h1>{departmentName || "Department"} Overview</h1>
          <p>Real-time training stats for {departmentName || "your department"}.</p>
          <div className="hero-stats">
            <Link to="/department-admin/members" className="hero-stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="hero-stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <strong>{deptUsers.length}</strong>
                <span>Dept Users</span>
              </div>
            </Link>
            <Link to="/department-admin/courses" className="hero-stat" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="hero-stat-icon admins-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              </div>
              <div>
                <strong>{deptCourses.length}</strong>
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

      <section className="dash-stat-cards">
        <Link to="/department-admin/analytics" className="stat-card stat-courses" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Videos Done</span>
            <strong>{totalVideosCompleted}</strong>
          </div>
        </Link>

        <Link to="/department-admin/analytics" className="stat-card stat-rate" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Certificates</span>
            <strong>{totalCertificates}</strong>
          </div>
        </Link>

        <Link to="/department-admin/analytics" className="stat-card stat-progress" style={{ textDecoration: "none" }}>
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Avg Score</span>
            <strong>{averageScore}%</strong>
          </div>
        </Link>
      </section>

      <section className="dashboard-overview-row">
        <div className="dash-card user-progress-card">
          <div className="card-head compact-card-head">
            <div>
              <h2>User Progress</h2>
              <p>Individual training completion for department members</p>
            </div>
          </div>

          <div className="department-progress-list dept-admin-user-list">
            {userProgressRows.length === 0 ? (
              <p className="empty-text">No user progress data available.</p>
            ) : (
              userProgressRows.map((user) => (
                <div className="department-progress-row" key={user.id}>
                  <div className="department-progress-top">
                    <div>
                      <h3>{user.name}</h3>
                      <span>{user.zone || "-"} &bull; {user.assigned} assigned &bull; {user.completed} done</span>
                    </div>
                    <strong>{user.rate}%</strong>
                  </div>
                  <div className="department-progress-track">
                    <span style={{ width: `${user.rate}%` }}></span>
                  </div>
                </div>
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
                to={`/department-admin/analytics?zone=${encodeURIComponent(item.zone)}`}
                className={`zone-summary-item zone-${item.zone.toLowerCase()}`}
                style={{ textDecoration: "none", color: "inherit" }}
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
            <div
              className="compact-css-donut"
              style={{ "--completion": `${completionRate * 3.6}deg` }}
            >
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
            <Link to="/department-admin/analytics">View All</Link>
          </div>

          <div className="recent-activity-list">
            {recentActivities.length === 0 ? (
              <p className="empty-text">No recent activity available.</p>
            ) : (
              recentActivities.map((activity) => (
                <div className="recent-activity-item" key={activity.id}>
                  <div className="activity-avatar">
                    {activity.userName.charAt(0).toUpperCase()}
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

        <div className="dash-card compact-insight-card test-performance-card">
          <div className="insight-card-head">
            <div>
              <h2>Test Performance</h2>
              <p>Final test results summary</p>
            </div>
            <Link to="/department-admin/analytics">Results</Link>
          </div>

          <div className="test-main-score">
            <span>Average Score</span>
            <strong>{testPerformance.average}%</strong>
            <div className="test-score-track">
              <span style={{ width: `${testPerformance.average}%` }}></span>
            </div>
          </div>

          <div className="test-mini-grid">
            <div>
              <span>Total Tests</span>
              <strong>{testPerformance.totalAttempts}</strong>
            </div>
            <div>
              <span>Passed</span>
              <strong>{testPerformance.passedAttempts}</strong>
            </div>
            <div>
              <span>Failed</span>
              <strong>{testPerformance.failedAttempts}</strong>
            </div>
            <div>
              <span>Pass Rate</span>
              <strong>{testPerformance.passRate}%</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="dash-card latest-course-section">
        <div className="card-head compact-card-head">
          <div>
            <h2>Course Progress Detail</h2>
            <p>{expandedCourseId ? "Assigned users for selected course" : "Click a course to see assigned users"}</p>
          </div>

          {expandedCourseId && (
            <button className="au-back-btn" onClick={() => { setExpandedCourseId(""); setFilterSearch(""); setFilterStatus(""); }} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 14px", fontSize: "0.78rem" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
              All Courses
            </button>
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
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan="6" className="au-empty">No users found.</td></tr>
                    ) : filteredUsers.map((u, idx) => (
                      <tr key={u.id || u.uid || idx} className="au-table-row-enter" style={{ animationDelay: `${idx * 30}ms` }}>
                        <td className="au-td-idx">{idx + 1}</td>
                        <td className="au-td-name"><strong>{u.name || "-"}</strong></td>
                        <td className="au-td-email">{u.email || "-"}</td>
                        <td>{u.designation || "-"}</td>
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

export default DepartmentAdminDashboard;