import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ref, get } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { database, auth } from "../firebase";
import {
  getRole,
  getDepartmentName,
  mergeUserNode,
  mergeUserRecords,
  isAssignmentActive,
  isCompletedRecord,
  isCourseCompletedForUser,
  hasCertificate,
  getGroupCertificateCount,
  calculateGroupStats,
  objectToArray,
} from "../utils/trainingAnalytics";
import { loadUserProfile } from "../lib/userAccess";
import "../styles/departmentanalytics.css";

const AVATAR_COLORS = [
  { bg: "#fef3c7", color: "#b45309" },
  { bg: "#dbeafe", color: "#1d4ed8" },
  { bg: "#dcfce7", color: "#15803d" },
  { bg: "#ede9fe", color: "#6d28d9" },
  { bg: "#fce7f3", color: "#be185d" },
  { bg: "#e0f2fe", color: "#0369a1" },
  { bg: "#fff7ed", color: "#c2410c" },
  { bg: "#f0fdf4", color: "#047857" },
  { bg: "#fdf2f8", color: "#9d174d" },
  { bg: "#f5f3ff", color: "#5b21b6" },
];

function getAvatarColor(i) { return AVATAR_COLORS[i % AVATAR_COLORS.length]; }

function getVal(user, keys) {
  for (const k of keys) { if (user?.[k]) return String(user[k]).trim(); }
  return "";
}

function DepartmentAnalyticsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [completedCourses, setCompletedCourses] = useState({});
  const [results, setResults] = useState({});
  const [assignments, setAssignments] = useState({});
  const [courseProgress, setCourseProgress] = useState({});
  const [videoProgress, setVideoProgress] = useState({});
  const [departmentsData, setDepartmentsData] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [drillDept, setDrillDept] = useState("");
  const [animKey, setAnimKey] = useState(0);

  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");

  const bumpAnim = () => setAnimKey((k) => k + 1);

  const drillIntoDept = (dept) => {
    bumpAnim();
    setDrillDept(dept);
    setSearch("");
    setDesignationFilter("");
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoading(false); return; }
      try {
        const profile = await loadUserProfile(user);
        if (profile) {
          setCurrentUser(profile);
        } else {
          const snap = await get(ref(database, `users/${user.uid}`));
          if (snap.exists()) {
            setCurrentUser({ id: user.uid, uid: user.uid, ...snap.val() });
          } else {
            setCurrentUser({ id: user.uid, uid: user.uid, role: "superadmin" });
          }
        }
      } catch (e) {
        console.error("Failed to load user:", e);
        setCurrentUser({ id: user.uid, uid: user.uid, role: "superadmin" });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      try {
        const [
          usersSnap,
          coursesSnap,
          completedSnap,
          resultsSnap,
          assignmentsSnap,
          courseProgressSnap,
          videoProgressSnap,
          departmentsSnap,
        ] = await Promise.all([
          get(ref(database, "users")),
          get(ref(database, "courses")),
          get(ref(database, "completedCourses")),
          get(ref(database, "results")),
          get(ref(database, "userAssignments")),
          get(ref(database, "courseProgress")),
          get(ref(database, "videoProgress")),
          get(ref(database, "departments")),
        ]);

        if (usersSnap.exists()) {
          const usersData = usersSnap.val();
          setUsers(Object.entries(usersData).map(([id, u]) => ({ id, uid: u.uid || id, ...u })));
        }
        if (coursesSnap.exists()) {
          const coursesData = coursesSnap.val();
          setCourses(Object.entries(coursesData).map(([id, c]) => ({ id, ...c })));
        }
        if (completedSnap.exists()) setCompletedCourses(completedSnap.val());
        if (resultsSnap.exists()) setResults(resultsSnap.val());
        if (assignmentsSnap.exists()) setAssignments(assignmentsSnap.val());
        if (courseProgressSnap.exists()) setCourseProgress(courseProgressSnap.val());
        if (videoProgressSnap.exists()) setVideoProgress(videoProgressSnap.val());
        if (departmentsSnap.exists()) setDepartmentsData(departmentsSnap.val());
      } catch (e) { console.error("Department analytics fetch error:", e); } finally { setLoading(false); }
    };
    fetchData();
  }, [currentUser]);

  useEffect(() => {
    if (loading) return;
    const deptParam = searchParams.get("dept");
    if (deptParam) {
      drillIntoDept(deptParam);
    }
  }, [loading, searchParams]);

  const userRole = String(currentUser?.role || "").trim().toLowerCase().replace(/[\s_-]/g, "");
  const isSuperOrAdmin = userRole === "superadmin" || userRole === "admin";
  const departmentName = currentUser?.department || currentUser?.departmentName || currentUser?.departmentType || "";

  const departmentNameById = useMemo(() => {
    if (!departmentsData) return {};
    const list = objectToArray(departmentsData);
    return Object.fromEntries(
      list.map((dept) => [
        dept.id,
        dept.name || dept.departmentName || dept.title || "Unnamed Department",
      ])
    );
  }, [departmentsData]);

  const resolveUserDept = (user) => {
    const direct = getDepartmentName(user);
    if (direct && direct.toLowerCase() !== "not assigned" && direct.toLowerCase() !== "not specified" && direct.toLowerCase() !== "general") {
      return direct;
    }
    const deptId = String(user?.departmentId || "").trim();
    if (deptId && departmentNameById[deptId]) {
      return departmentNameById[deptId];
    }
    return direct || "Not Assigned";
  };

  const deptCourses = useMemo(() => {
    const userDeptId = String(currentUser?.departmentId || "").trim();
    const userDept = String(departmentName || "").trim().toLowerCase();
    const userId = String(currentUser?.id || currentUser?.uid || "").trim();
    return courses.filter((course) => {
      const status = String(course?.status || "").trim().toLowerCase();
      if (["inactive", "archived", "deleted", "draft"].includes(status)) return false;
      if (isSuperOrAdmin) return true;
      const courseDeptId = String(course.departmentId || "").trim();
      const courseDept = String(getDepartmentName(course) || "").trim().toLowerCase();
      if (courseDeptId && userDeptId && courseDeptId === userDeptId) return true;
      if (courseDept && userDept && courseDept === userDept) return true;
      const createdBy = String(course.createdBy || course.createdById || "").trim();
      if (userId && createdBy === userId) return true;
      return false;
    });
  }, [courses, currentUser, departmentName, isSuperOrAdmin]);

  const employeeUsers = useMemo(() => {
    const deptCourseIds = new Set(deptCourses.map((c) => c.id));
    const userDeptId = String(currentUser?.departmentId || "").trim();
    const userDept = String(departmentName || "").trim().toLowerCase();
    const uniqueUsers = new Map();
    users.forEach((user) => {
      const key = String(user?.uid || user?.id || user?.email || "").trim();
      if (!key) return;
      const role = String(user?.role || "").trim().toLowerCase().replace(/[\s_-]/g, "");
      if (role === "admin" || role === "superadmin") return;

      if (isSuperOrAdmin) {
        uniqueUsers.set(key, { ...(uniqueUsers.get(key) || {}), ...user });
        return;
      }

      if (role === "departmentadmin" || role === "deptadmin") return;

      const userDeptIdField = String(user.departmentId || "").trim();
      const userDeptName = String(resolveUserDept(user) || "").trim().toLowerCase();
      if (userDeptId && userDeptIdField && userDeptIdField === userDeptId) {
        uniqueUsers.set(key, { ...(uniqueUsers.get(key) || {}), ...user });
        return;
      }
      if (userDept && userDeptName && userDeptName === userDept) {
        uniqueUsers.set(key, { ...(uniqueUsers.get(key) || {}), ...user });
        return;
      }
      const userAssignments = mergeUserRecords(assignments, user) || {};
      const hasAssignmentToVisibleCourse = Object.entries(userAssignments).some(
        ([courseId, assignment]) => deptCourseIds.has(courseId) && isAssignmentActive(assignment)
      );
      if (hasAssignmentToVisibleCourse) {
        uniqueUsers.set(key, { ...(uniqueUsers.get(key) || {}), ...user });
      }
    });
    return Array.from(uniqueUsers.values());
  }, [users, currentUser, departmentName, deptCourses, assignments, isSuperOrAdmin, departmentNameById]);

  const getCompletedCount = (userOrId) => {
    const assignedEntries = getAssignedCourseEntries(userOrId);
    return assignedEntries.filter(([courseId]) => isCourseCompletedForUser(userOrId, courseId, completedCourses, courseProgress, videoProgress)).length;
  };

  const getCertificateCount = (userOrId) => {
    const records = mergeUserNode(completedCourses, userOrId);
    return Object.entries(records).filter(([, completion]) => hasCertificate(completion)).length;
  };

  const getAssignedCourseEntries = (userOrId) => {
    const userAssignments = mergeUserNode(assignments, userOrId);
    return Object.entries(userAssignments).filter(([, assignment]) => isAssignmentActive(assignment));
  };

  const getAssignedCount = (userOrId) => getAssignedCourseEntries(userOrId).length;

  const getCourseProgressPercent = (userOrId, courseId) => {
    const directCourseProgress = mergeUserNode(courseProgress, userOrId)?.[courseId] || {};
    const directCandidates = [
      directCourseProgress.percentage,
      directCourseProgress.progress,
      directCourseProgress.progressPercent,
      directCourseProgress.completionPercent,
      directCourseProgress.completedPercent,
      directCourseProgress.watchedPercent,
    ];
    const directValue = directCandidates.map(Number).find((value) => Number.isFinite(value) && value >= 0);
    if (directValue !== undefined) return Math.max(0, Math.min(100, Math.round(directValue)));

    const courseVideos = mergeUserNode(videoProgress, userOrId)?.[courseId] || {};
    const progressValues = Object.values(courseVideos).map((video) => {
      if (video?.completed) return 100;
      const value = Number(video?.watchedPercent ?? video?.progressPercent ?? video?.progress ?? 0);
      return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    });
    if (progressValues.length === 0) return 0;
    return Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length);
  };

  const getCourseCompletionRecord = (userOrId, courseId) => mergeUserNode(completedCourses, userOrId)?.[courseId];

  const getCourseResultRecord = (userOrId, courseId) => {
    const userResults = mergeUserNode(results, userOrId);
    return userResults?.[courseId] || Object.values(userResults).find((result) => String(result?.courseId || "") === String(courseId));
  };

  const getCourseStatus = (userOrId, courseId) => {
    const completedRecord = getCourseCompletionRecord(userOrId, courseId);
    if (isCompletedRecord(completedRecord)) return "completed";
    const cp = mergeUserNode(courseProgress, userOrId)?.[courseId];
    if (cp?.courseTestPassed || cp?.passed) return "completed";
    const progressPercent = getCourseProgressPercent(userOrId, courseId);
    return progressPercent > 0 ? "inProgress" : "notStarted";
  };

  const getUserCompletion = (userOrId) => {
    const assigned = getAssignedCount(userOrId);
    const completed = getCompletedCount(userOrId);
    return assigned > 0 ? Math.min(100, Math.round((completed / assigned) * 100)) : 0;
  };

  const getUserOverallProgress = (userOrId) => {
    const entries = getAssignedCourseEntries(userOrId);
    if (entries.length === 0) return 0;
    const totalProgress = entries.reduce((sum, [courseId]) => sum + getCourseProgressPercent(userOrId, courseId), 0);
    return Math.round(totalProgress / entries.length);
  };

  const departments = useMemo(() => {
    const deptMap = {};

    Object.values(departmentNameById).forEach((name) => {
      if (!name) return;
      const deptKey = name.trim().toLowerCase();
      if (!deptMap[deptKey]) {
        deptMap[deptKey] = { name: name.trim(), users: [] };
      }
    });

    employeeUsers.forEach((user) => {
      const deptName = resolveUserDept(user);
      const deptKey = deptName.toLowerCase();
      if (!deptMap[deptKey]) {
        deptMap[deptKey] = { name: deptName, users: [] };
      }
      deptMap[deptKey].users.push(user);
    });

    return Object.values(deptMap)
      .map((dept) => ({
        ...dept,
        total: dept.users.length,
        certs: dept.users.reduce((sum, u) => sum + getCertificateCount(u), 0),
        ...calculateGroupStats({
          users: dept.users,
          assignments,
          completedCourses,
          courseProgress,
          videoProgress,
        }),
      }))
      .filter((dept) => dept.total > 0 || (isSuperOrAdmin && dept.name !== "Not Assigned"))
      .sort((a, b) => b.rate - a.rate || b.total - a.total || a.name.localeCompare(b.name));
  }, [employeeUsers, assignments, completedCourses, courseProgress, videoProgress, departmentNameById, isSuperOrAdmin]);

  const contextUsers = useMemo(() => {
    if (!drillDept) return employeeUsers;
    return employeeUsers.filter((u) => resolveUserDept(u).toLowerCase() === drillDept.toLowerCase());
  }, [employeeUsers, drillDept, departmentNameById]);

  const filteredUsers = useMemo(() => {
    return contextUsers.filter((u) => {
      const text = [u.name, u.email, u.designation, u.zone, u.state, u.cityArea].filter(Boolean).join(" ").toLowerCase();
      return text.includes(search.toLowerCase()) && (!designationFilter || u.designation === designationFilter);
    });
  }, [contextUsers, search, designationFilter]);

  const designations = useMemo(() => [...new Set(contextUsers.map((u) => u.designation).filter(Boolean))].sort(), [contextUsers]);

  const overallStats = useMemo(() => ({
    total: employeeUsers.length,
    ...calculateGroupStats({
      users: employeeUsers,
      assignments,
      completedCourses,
      courseProgress,
      videoProgress,
    }),
    certs: getGroupCertificateCount(employeeUsers, completedCourses),
  }), [employeeUsers, assignments, completedCourses, courseProgress, videoProgress]);

  const selectedUserCourseRows = useMemo(() => {
    if (!selectedUser) return [];
    const assignedEntries = getAssignedCourseEntries(selectedUser);
    return assignedEntries
      .map(([courseId, assignment]) => {
        const course = courses.find((item) => String(item.id) === String(courseId));
        const completionRecord = getCourseCompletionRecord(selectedUser, courseId);
        const resultRecord = getCourseResultRecord(selectedUser, courseId);
        const status = getCourseStatus(selectedUser, courseId);
        const progressPercent = status === "completed" ? 100 : getCourseProgressPercent(selectedUser, courseId);
        return {
          courseId,
          title: course?.title || course?.courseTitle || course?.courseName || course?.name || assignment?.courseTitle || "Untitled Course",
          department: course?.departmentName || course?.department || assignment?.departmentName || assignment?.department || "Not specified",
          assignedAt: assignment?.assignedAt || assignment?.createdAt || assignment?.dateAssigned || "",
          status,
          progressPercent,
          certificate: resultRecord?.certificateUrl || resultRecord?.certificateId || completionRecord?.certificateUrl || completionRecord?.certificateId || "",
          score: resultRecord?.percentage ?? resultRecord?.scorePercentage ?? resultRecord?.marksPercentage ?? "",
        };
      })
      .sort((a, b) => new Date(b.assignedAt || 0).getTime() - new Date(a.assignedAt || 0).getTime());
  }, [selectedUser, courses, assignments, completedCourses, results, courseProgress, videoProgress]);

  const selectedUserStats = useMemo(() => {
    if (!selectedUser) return { assigned: 0, completed: 0, inProgress: 0, notStarted: 0, certificates: 0, completion: 0 };
    const assigned = selectedUserCourseRows.length;
    const completed = selectedUserCourseRows.filter((c) => c.status === "completed").length;
    const inProgress = selectedUserCourseRows.filter((c) => c.status === "inProgress").length;
    const notStarted = selectedUserCourseRows.filter((c) => c.status === "notStarted").length;
    return {
      assigned,
      completed,
      inProgress,
      notStarted,
      certificates: getCertificateCount(selectedUser),
      completion: getUserOverallProgress(selectedUser),
    };
  }, [selectedUser, selectedUserCourseRows, completedCourses]);

  const formatDate = (value) => {
    if (!value) return "\u2014";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "\u2014";
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const downloadReport = () => {
    const rows = filteredUsers.map((u) => ({
      Name: u.name || "", Email: u.email || "", Role: getRole(u), Designation: u.designation || "",
      Department: resolveUserDept(u), Zone: getVal(u, ["zone", "Zone", "zoneName"]), State: getVal(u, ["state", "State", "stateName"]),
      "Assigned": getAssignedCount(u), "Completed": getCompletedCount(u),
      "Certificates": getCertificateCount(u), "Completion %": `${getUserOverallProgress(u)}%`,
    }));
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => `"${String(r[h] || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `department-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  };

  const currentLabel = drillDept || "All Departments";

  if (loading) return <div className="sa-page"><div className="sa-loading">Loading department analytics...</div></div>;

  return (
    <div className="sa-page">

      {/* Hero */}
      <section className="sa-hero">
        <div className="sa-hero-left">
          <div className="sa-hero-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <h1>Department Analytics</h1>
            <p>Drill down: Department &rarr; Users &rarr; Course Progress</p>
          </div>
        </div>
        <div className="sa-hero-right">
          <div className="sa-hero-stat"><strong>{overallStats.total}</strong><span>Users</span></div>
          <div className="sa-hero-stat"><strong>{overallStats.assigned}</strong><span>Assigned</span></div>
          <div className="sa-hero-stat"><strong>{overallStats.rate}%</strong><span>Completion</span></div>
          <div className="sa-hero-stat sa-hero-cert"><strong>{overallStats.certs}</strong><span>Certificates</span></div>
        </div>
      </section>

      {/* Department Selector (always visible) */}
      <div className="sa-selector-row sa-fade-in" key={`sel-${animKey}`}>
        <div className="sa-select-group">
          <label>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Department
          </label>
          <select value={drillDept} onChange={(e) => drillIntoDept(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.name} value={d.name}>{d.name} ({d.total})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Dept Card */}
      {drillDept && (
        <div className="sa-cards-row sa-fade-in">
          {(() => {
            const d = departments.find((x) => x.name.toLowerCase() === drillDept.toLowerCase());
            if (!d) return null;
            return (
              <div className="sa-detail-card">
                <button className="sa-dcard-remove" onClick={() => { setDrillDept(""); setSearch(""); setDesignationFilter(""); bumpAnim(); }}>&times;</button>
                <div className="sa-dcard-avatar" style={{ background: getAvatarColor(0).bg, color: getAvatarColor(0).color }}>{d.name.charAt(0).toUpperCase()}</div>
                <div className="sa-dcard-body">
                  <strong>{d.name}</strong>
                  <span className="sa-dcard-tag">Department</span>
                  <span className="sa-dcard-meta">{d.total} users &bull; {d.rate}% completion</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Department Cards Grid (overview mode) */}
      {!drillDept && (
        <div className="dept-analytics-grid sa-fade-in" key={`grid-${animKey}`}>
          {departments.length === 0 ? (
            <p className="sa-empty" style={{ gridColumn: "1 / -1" }}>No department data available.</p>
          ) : (
            departments.map((dept, idx) => (
              <button
                type="button"
                className="dept-analytics-card"
                key={dept.name}
                onClick={() => drillIntoDept(dept.name)}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="dept-card-header">
                  <div className="dept-card-avatar" style={{ background: getAvatarColor(idx).bg, color: getAvatarColor(idx).color }}>
                    {dept.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="dept-card-info">
                    <h3>{dept.name}</h3>
                    <span>{dept.total} users &bull; {dept.certs} certs</span>
                  </div>
                  <strong className="dept-card-rate">{dept.rate}%</strong>
                </div>
                <div className="dept-card-stats">
                  <div><span>Assigned</span><strong>{dept.assigned}</strong></div>
                  <div><span>Completed</span><strong>{dept.completed}</strong></div>
                  <div><span>Rate</span><strong>{dept.rate}%</strong></div>
                </div>
                <div className="dept-card-track">
                  <span style={{ width: `${dept.rate}%` }} />
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Bottom Section (when dept is selected) */}
      {drillDept && (
        <div className="sa-stats-reveal">
          <div className="sa-kpi-row">
            <div className="sa-kpi sa-kpi-users sa-slide-up" style={{ animationDelay: "0ms" }}>
              <div className="sa-kpi-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
              <div><span>Users</span><strong>{filteredUsers.length}</strong></div>
            </div>
            <div className="sa-kpi sa-kpi-completed sa-slide-up" style={{ animationDelay: "80ms" }}>
              <div className="sa-kpi-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg></div>
              <div><span>Completed</span><strong>{filteredUsers.reduce((s, u) => s + getCompletedCount(u), 0)}</strong></div>
            </div>
            <div className="sa-kpi sa-kpi-certs sa-slide-up" style={{ animationDelay: "160ms" }}>
              <div className="sa-kpi-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15l-2 5l9-13h-5l2-5-9 13h5z"/></svg></div>
              <div><span>Certificates</span><strong>{filteredUsers.reduce((s, u) => s + getCertificateCount(u), 0)}</strong></div>
            </div>
            <div className="sa-kpi sa-kpi-rate sa-slide-up" style={{ animationDelay: "240ms" }}>
              <div className="sa-kpi-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
              <div><span>Rate</span><strong>{filteredUsers.length > 0 ? Math.round((filteredUsers.reduce((s, u) => s + getCompletedCount(u), 0) / (filteredUsers.reduce((s, u) => s + getAssignedCount(u), 0) || 1)) * 100) : 0}%</strong></div>
            </div>
          </div>

          {/* USER TABLE */}
          <div className="sa-users-final-section sa-fade-in" style={{ animationDelay: "100ms" }}>
            <div className="sa-filters-card">
              <div className="sa-filters-row">
                <div className="sa-search-box">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  <input type="text" placeholder={`Search users in ${currentLabel}...`} value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select className="sa-filter-select" value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)}>
                  <option value="">All Designations</option>
                  {designations.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <button className="sa-btn sa-btn-download" onClick={downloadReport}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download CSV
                </button>
              </div>
            </div>

            <div className="sa-card">
              <div className="sa-table-head">
                <div>
                  <h2>Department User Report &mdash; {currentLabel}</h2>
                  <p>{filteredUsers.length} users &bull; {filteredUsers.reduce((sum, user) => sum + getCompletedCount(user), 0)} completed</p>
                </div>
                <span className="sa-click-hint">Click a row to view details</span>
              </div>
              <div className="sa-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Designation</th>
                      <th>Zone</th>
                      <th>State</th>
                      <th>Assigned</th>
                      <th>Completed</th>
                      <th>Certs</th>
                      <th>Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan="10" className="sa-empty">No users found.</td></tr>
                    ) : filteredUsers.map((u, idx) => {
                      const assigned = getAssignedCount(u);
                      const comp = getCompletedCount(u);
                      const pct = getUserOverallProgress(u);
                      return (
                        <tr
                          key={u.id}
                          className="sa-table-row-enter sa-user-clickable-row"
                          style={{ animationDelay: `${idx * 30}ms` }}
                          onClick={() => setSelectedUser(u)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedUser(u);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`View complete progress for ${u.name || "this user"}`}
                          title="Click anywhere in this row to view complete user progress"
                        >
                          <td className="sa-td-idx">{idx + 1}</td>
                          <td className="sa-td-name"><strong className="sa-user-row-name">{u.name || "-"}</strong></td>
                          <td className="sa-td-email">{u.email || "-"}</td>
                          <td>{u.designation || "-"}</td>
                          <td>{getVal(u, ["zone", "Zone", "zoneName"]) || "-"}</td>
                          <td>{getVal(u, ["state", "State", "stateName"]) || "-"}</td>
                          <td>{assigned}</td>
                          <td><strong>{comp}</strong></td>
                          <td>{getCertificateCount(u)}</td>
                          <td>
                            <div className="sa-pct-cell">
                              <div className="sa-pct-bar"><span style={{ width: `${pct}%` }} /></div>
                              <strong>{pct}%</strong>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Drawer */}
      {selectedUser && (
        <div className="sa-user-detail-backdrop" onClick={() => setSelectedUser(null)}>
          <aside className="sa-user-detail-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="sa-user-detail-header">
              <div className="sa-user-detail-profile">
                <div className="sa-user-detail-avatar">
                  {(selectedUser.name || selectedUser.email || "U").split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2>{selectedUser.name || "Unnamed User"}</h2>
                  <p>{selectedUser.email || "Email not available"}</p>
                </div>
              </div>
              <button type="button" className="sa-user-detail-close" onClick={() => setSelectedUser(null)} aria-label="Close user progress">&times;</button>
            </div>

            <div className="sa-user-detail-body">
              <div className="sa-user-location-grid">
                <div><span>Department</span><strong>{resolveUserDept(selectedUser)}</strong></div>
                <div><span>Designation</span><strong>{selectedUser.designation || "Not specified"}</strong></div>
                <div><span>Zone</span><strong>{getVal(selectedUser, ["zone", "Zone", "zoneName"]) || "Not assigned"}</strong></div>
                <div><span>State</span><strong>{getVal(selectedUser, ["state", "State", "stateName"]) || "Not assigned"}</strong></div>
              </div>

              <div className="sa-user-progress-summary">
                <div className="sa-user-summary-card assigned"><strong>{selectedUserStats.assigned}</strong><span>Assigned</span></div>
                <div className="sa-user-summary-card completed"><strong>{selectedUserStats.completed}</strong><span>Completed</span></div>
                <div className="sa-user-summary-card progress"><strong>{selectedUserStats.inProgress}</strong><span>In Progress</span></div>
                <div className="sa-user-summary-card pending"><strong>{selectedUserStats.notStarted}</strong><span>Not Started</span></div>
                <div className="sa-user-summary-card certificate"><strong>{selectedUserStats.certificates}</strong><span>Certificates</span></div>
                <div className="sa-user-summary-card rate"><strong>{selectedUserStats.completion}%</strong><span>Completion</span></div>
              </div>

              <div className="sa-user-course-section">
                <div className="sa-user-course-head">
                  <div>
                    <h3>Assigned Course Progress</h3>
                    <p>Course-wise progress for {selectedUser.name || "this user"}</p>
                  </div>
                  <span>{selectedUserCourseRows.length} courses</span>
                </div>

                <div className="sa-user-course-list">
                  {selectedUserCourseRows.length === 0 ? (
                    <div className="sa-user-no-courses">No courses are currently assigned to this user.</div>
                  ) : (
                    selectedUserCourseRows.map((course, index) => (
                      <div className="sa-user-course-card" key={course.courseId}>
                        <div className="sa-user-course-number">{index + 1}</div>
                        <div className="sa-user-course-content">
                          <div className="sa-user-course-title-row">
                            <div>
                              <h4>{course.title}</h4>
                              <p>{course.department}{course.assignedAt ? ` \u2022 Assigned ${formatDate(course.assignedAt)}` : ""}</p>
                            </div>
                            <span className={`sa-course-status ${course.status}`}>
                              {course.status === "completed" ? "Completed" : course.status === "inProgress" ? "In Progress" : "Not Started"}
                            </span>
                          </div>
                          <div className="sa-user-course-progress-row">
                            <div className="sa-user-course-progress-track">
                              <span style={{ width: `${course.progressPercent}%` }} />
                            </div>
                            <strong>{course.progressPercent}%</strong>
                          </div>
                          {(course.score !== "" || course.certificate) && (
                            <div className="sa-user-course-extra">
                              {course.score !== "" && <span>Test score: {course.score}%</span>}
                              {course.certificate && <span>Certificate issued</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

    </div>
  );
}

export default DepartmentAnalyticsPage;
