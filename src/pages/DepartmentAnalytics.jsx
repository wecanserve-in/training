import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/superanalytics.css";
import {
  isAnalyticsTrainingUser,
  getUserKeys,
  mergeUserNode,
  mergeUserRecords,
  isAssignmentActive,
  isCompletedRecord,
  isCourseCompletedForUser,
  hasCertificate,
  getCertificateKey,
  getUserCertificateCount,
  getGroupCertificateCount,
  getUserZone,
  normalizeZone,
  calculateGroupStats,
  calculateZoneStats,
  getUniqueAnalyticsTrainingUsers,
  getVal,
  getDepartmentName,
} from "../utils/trainingAnalytics";

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

function DepartmentAnalytics() {
  const [currentUser, setCurrentUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [completedCourses, setCompletedCourses] = useState({});
  const [results, setResults] = useState({});
  const [assignments, setAssignments] = useState({});
  const [courseProgress, setCourseProgress] = useState({});
  const [videoProgress, setVideoProgress] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [drillLevel, setDrillLevel] = useState("overview");
  const [drillZone, setDrillZone] = useState("");
  const [drillState, setDrillState] = useState("");
  const [drillCity, setDrillCity] = useState("");
  const [animKey, setAnimKey] = useState(0);

  const [search, setSearch] = useState("");
const [designationFilter, setDesignationFilter] = useState("");
const [departmentFilter, setDepartmentFilter] = useState("all");
const [searchParams] = useSearchParams();

  const normalize = (value) => String(value || "").trim().toLowerCase();
  const sameText = (a, b) => { const f = normalize(a); const s = normalize(b); return Boolean(f && s && f === s); };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoading(false); return; }
      try {
        const snap = await get(ref(database, `users/${user.uid}`));
        if (snap.exists()) {
          setCurrentUser({ id: user.uid, ...snap.val() });
        }
      } catch (e) { console.error("Failed to load user:", e); }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      try {
        const [usersSnap, coursesSnap, completedSnap, resultsSnap, assignmentsSnap, courseProgressSnap, videoProgressSnap] = await Promise.all([
          get(ref(database, "users")),
          get(ref(database, "courses")),
          get(ref(database, "completedCourses")),
          get(ref(database, "results")),
          get(ref(database, "userAssignments")),
          get(ref(database, "courseProgress")),
          get(ref(database, "videoProgress")),
        ]);
        if (usersSnap.exists()) setAllUsers(Object.entries(usersSnap.val()).map(([id, u]) => ({ id, uid: u.uid || id, ...u })));
       if (coursesSnap.exists()) {
  const loadedCourses = Object.entries(coursesSnap.val()).map(([id, c]) => ({
    id,
    ...c,
  }));

  setAllCourses(loadedCourses);
  setCourses(loadedCourses);
}
        if (completedSnap.exists()) setCompletedCourses(completedSnap.val());
        if (resultsSnap.exists()) setResults(resultsSnap.val());
        if (assignmentsSnap.exists()) setAssignments(assignmentsSnap.val());
        if (courseProgressSnap.exists()) setCourseProgress(courseProgressSnap.val());
        if (videoProgressSnap.exists()) setVideoProgress(videoProgressSnap.val());
      } catch (e) { console.error("Analytics fetch error:", e); }
      setLoading(false);
    };
    fetchData();
  }, [currentUser]);

  const departmentName = currentUser?.department || currentUser?.departmentName || currentUser?.departmentType || "";

  useEffect(() => {
    if (loading || !currentUser) return;
    const zoneParam = searchParams.get("zone");
    if (zoneParam) drillIntoZone(zoneParam);
  }, [loading, currentUser]);

  const deptCourses = useMemo(() => {
    const userDeptId = String(currentUser?.departmentId || "").trim();
    const userDept = String(departmentName || "").trim().toLowerCase();
    const userId = String(currentUser?.id || currentUser?.uid || "").trim();
    return courses.filter((course) => {
      const status = String(course?.status || "").trim().toLowerCase();
      if (["inactive", "archived", "deleted", "draft"].includes(status)) return false;
      const courseDeptId = String(course.departmentId || "").trim();
      const courseDept = String(getDepartmentName(course) || "").trim().toLowerCase();
      if (courseDeptId && userDeptId && courseDeptId === userDeptId) return true;
      if (courseDept && userDept && courseDept === userDept) return true;
      const createdBy = String(course.createdBy || course.createdById || "").trim();
      if (userId && createdBy === userId) return true;
      return false;
    });
  }, [courses, currentUser, departmentName]);

  const employeeUsers = useMemo(() => {
    const deptCourseIds = new Set(deptCourses.map((c) => c.id));
    return getUniqueAnalyticsTrainingUsers(allUsers.filter((user) => {
      const role = String(user?.role || "").trim().toLowerCase();
      if (role === "admin" || role === "superadmin" || role === "departmentadmin" || role === "deptadmin") return false;
      if (!departmentName) {
        if (deptCourseIds.size === 0) return true;
        const userAssignments = mergeUserRecords(assignments, user) || {};
        return Object.entries(userAssignments).some(
          ([courseId, assignment]) => deptCourseIds.has(courseId) && isAssignmentActive(assignment)
        );
      }
      if (sameText(getDepartmentName(user), departmentName)) return true;
      const userAssignments = mergeUserRecords(assignments, user) || {};
      return Object.entries(userAssignments).some(
        ([courseId, assignment]) => deptCourseIds.has(courseId) && isAssignmentActive(assignment)
      );
    }));
  }, [allUsers, departmentName, deptCourses, assignments]);

  const getCompletedCount = (userOrId) => {
    const assignedEntries = getAssignedCourseEntries(userOrId);
    return assignedEntries.filter(([courseId]) => isCourseCompletedForUser(userOrId, courseId, completedCourses, courseProgress, videoProgress)).length;
  };

const getCertificateCount = (userOrId) => {
  const visibleEntries = getAssignedCourseEntries(userOrId);

  return visibleEntries.filter(([courseId]) => {
    const completion = getCourseCompletionRecord(
      userOrId,
      courseId
    );

    return hasCertificate(completion);
  }).length;
};

const getRealCertificateCount = (userOrId) => {
  const records = mergeUserNode(completedCourses, userOrId);

  return Object.entries(records).filter(([, completion]) =>
    hasCertificate(completion)
  ).length;
};

const getAssignedCourseEntries = (userOrId) => {
  const userEntries = Object.entries(
    mergeUserNode(assignments, userOrId)
  );

  const userDepartmentId = String(
    userOrId?.departmentId || ""
  ).trim();

  const adminDepartmentId = String(
    currentUser?.departmentId || ""
  ).trim();

  const userDepartment = String(
    getDepartmentName(userOrId) || ""
  ).trim().toLowerCase();

  const adminDepartment = String(
    departmentName || ""
  ).trim().toLowerCase();

  const isOwnDepartmentUser =
    (
      userDepartmentId &&
      adminDepartmentId &&
      userDepartmentId === adminDepartmentId
    ) ||
    (
      userDepartment &&
      adminDepartment &&
      userDepartment === adminDepartment
    );

  // Own department user:
  // Show ALL courses assigned to that user,
  // including courses belonging to other departments.
  if (isOwnDepartmentUser) {
    return userEntries.filter(
      ([, assignment]) => isAssignmentActive(assignment)
    );
  }

  // Other department user:
  // Show only courses that belong to this admin's department.
  const deptCourseIds = new Set(
    deptCourses.map((c) => String(c.id))
  );

  return userEntries.filter(
    ([courseId, assignment]) =>
      deptCourseIds.has(String(courseId)) &&
      isAssignmentActive(assignment)
  );
};

  const getAssignedCount = (userOrId) => getAssignedCourseEntries(userOrId).length;

  const getCourseProgressPercent = (userOrId, courseId) => {
    const cp = mergeUserNode(courseProgress, userOrId)?.[courseId] || {};
    const direct = [cp.percentage, cp.progress, cp.progressPercent, cp.completionPercent, cp.completedPercent, cp.watchedPercent].map(Number).find((v) => Number.isFinite(v) && v >= 0);
    if (direct !== undefined) return Math.max(0, Math.min(100, Math.round(direct)));
    const vp = mergeUserNode(videoProgress, userOrId)?.[courseId] || {};
    const vals = Object.values(vp).map((v) => { if (v?.completed) return 100; const n = Number(v?.watchedPercent ?? v?.progressPercent ?? v?.progress ?? 0); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0; });
    return vals.length === 0 ? 0 : Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  };

  const getCourseCompletionRecord = (userOrId, courseId) => mergeUserNode(completedCourses, userOrId)?.[courseId];
  const getCourseResultRecord = (userOrId, courseId) => { const r = mergeUserNode(results, userOrId); return r?.[courseId] || Object.values(r).find((x) => String(x?.courseId || "") === String(courseId)); };
  const getCourseStatus = (userOrId, courseId) => { if (isCompletedRecord(getCourseCompletionRecord(userOrId, courseId))) return "completed"; const cp = mergeUserNode(courseProgress, userOrId)?.[courseId]; if (cp?.courseTestPassed || cp?.passed) return "completed"; return getCourseProgressPercent(userOrId, courseId) > 0 ? "inProgress" : "notStarted"; };
  const getUserCompletion = (userOrId) => { const a = getAssignedCount(userOrId); const c = getCompletedCount(userOrId); return a > 0 ? Math.min(100, Math.round((c / a) * 100)) : 0; };
  const getUserOverallProgress = (userOrId) => {
    const entries = getAssignedCourseEntries(userOrId);
    if (entries.length === 0) return 0;
    const totalProgress = entries.reduce((sum, [courseId]) => sum + getCourseProgressPercent(userOrId, courseId), 0);
    return Math.round(totalProgress / entries.length);
  };

  const getGroupStats = (groupUsers) => {
    const total = groupUsers.length;
    const completed = groupUsers.reduce((s, u) => s + getCompletedCount(u), 0);
    const certs = groupUsers.reduce((s, u) => s + getCertificateCount(u), 0);
    const assigned = groupUsers.reduce((s, u) => s + getAssignedCount(u), 0);
    const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
    return { total, completed, certs, assigned, rate };
  };

  const normalizeState = (v) => String(v || "").trim() || "Unassigned";
  const normalizeCity = (v) => String(v || "").trim() || "Unassigned";

  const zones = useMemo(() => {
    return calculateZoneStats({
      users: employeeUsers,
      assignments,
      completedCourses,
      courseProgress,
      videoProgress,
    });
  }, [employeeUsers, assignments, completedCourses, courseProgress, videoProgress]);

  const states = useMemo(() => {
    const filtered = drillZone ? employeeUsers.filter((u) => normalizeZone(getVal(u, ["zone", "Zone", "zoneName"])) === drillZone) : employeeUsers;
    const map = {};
    filtered.forEach((u) => { const s = normalizeState(getVal(u, ["state", "State", "stateName"])); if (!map[s]) map[s] = []; map[s].push(u); });
    return Object.entries(map).map(([name, list]) => ({ name, users: list, total: list.length, ...calculateGroupStats({ users: list, assignments, completedCourses, courseProgress, videoProgress }) })).sort((a, b) => b.rate - a.rate);
  }, [employeeUsers, drillZone, deptCourses, courses, completedCourses, results, assignments, courseProgress, videoProgress]);

  const cities = useMemo(() => {
    let filtered = employeeUsers;
    if (drillZone) filtered = filtered.filter((u) => normalizeZone(getVal(u, ["zone", "Zone", "zoneName"])) === drillZone);
    if (drillState) filtered = filtered.filter((u) => normalizeState(getVal(u, ["state", "State", "stateName"])) === drillState);
    const map = {};
    filtered.forEach((u) => { const c = normalizeCity(getVal(u, ["cityArea", "city", "City", "Area", "area"])); if (!map[c]) map[c] = []; map[c].push(u); });
    return Object.entries(map).map(([name, list]) => ({ name, users: list, total: list.length, ...calculateGroupStats({ users: list, assignments, completedCourses, courseProgress, videoProgress }) })).sort((a, b) => b.rate - a.rate);
  }, [employeeUsers, drillZone, drillState, deptCourses, courses, completedCourses, results, assignments, courseProgress, videoProgress]);

  const contextUsers = useMemo(() => {
    let filtered = employeeUsers;
    if (drillZone) filtered = filtered.filter((u) => normalizeZone(getVal(u, ["zone", "Zone", "zoneName"])) === drillZone);
    if (drillState) filtered = filtered.filter((u) => normalizeState(getVal(u, ["state", "State", "stateName"])) === drillState);
    if (drillCity) filtered = filtered.filter((u) => normalizeCity(getVal(u, ["cityArea", "city", "City", "Area", "area"])) === drillCity);
    return filtered;
  }, [employeeUsers, drillZone, drillState, drillCity]);

const filteredUsers = useMemo(() => {
  return contextUsers.filter((u) => {
    const text = [
      u.name,
      u.email,
      u.designation,
      u.zone,
      u.state,
      u.cityArea,
      getDepartmentName(u),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = text.includes(search.toLowerCase());

    const matchesDesignation =
      !designationFilter ||
      u.designation === designationFilter;

    const userDept = normalize(getDepartmentName(u));
    const myDept = normalize(departmentName);

    const matchesDepartment =
      departmentFilter === "all" ||
      (departmentFilter === "my" && userDept === myDept) ||
      (departmentFilter === "other" && userDept !== myDept);

    return (
      matchesSearch &&
      matchesDesignation &&
      matchesDepartment
    );
  });
}, [
  contextUsers,
  search,
  designationFilter,
  departmentFilter,
  departmentName,
]);

const designations = useMemo(() => [...new Set(contextUsers.map((u) => u.designation).filter(Boolean))].sort(), [contextUsers]);

  const bumpAnim = () => setAnimKey((k) => k + 1);

  const drillIntoZone = (zone) => { bumpAnim(); setDrillZone(zone); setDrillState(""); setDrillCity(""); setDrillLevel(zone ? "zone" : "overview"); setSearch(""); setDesignationFilter(""); };
  const drillIntoState = (state) => { bumpAnim(); setDrillState(state); setDrillCity(""); setDrillLevel(state ? "state" : "zone"); setSearch(""); setDesignationFilter(""); };
  const drillIntoCity = (city) => { bumpAnim(); setDrillCity(city); setDrillLevel(city ? "city" : "state"); setSearch(""); setDesignationFilter(""); };

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

  return getAssignedCourseEntries(selectedUser)
    .map(([courseId, assignment]) => {
      const course =
        allCourses.find(
          (c) => String(c.id) === String(courseId)
        ) ||
        courses.find(
          (c) => String(c.id) === String(courseId)
        );

      if (!course) return null;

      const completionRecord =
        getCourseCompletionRecord(
          selectedUser,
          courseId
        );

      const resultRecord =
        getCourseResultRecord(
          selectedUser,
          courseId
        );

      const status =
        getCourseStatus(
          selectedUser,
          courseId
        );

      const progressPercent =
        status === "completed"
          ? 100
          : getCourseProgressPercent(
              selectedUser,
              courseId
            );

      return {
        courseId,

        title:
          course?.title ||
          course?.courseTitle ||
          assignment?.courseTitle ||
          "Untitled Course",

   department:
  course?.departmentName ||
  course?.department ||
  course?.departmentType ||
  course?.deptName ||
  assignment?.departmentName ||
  assignment?.department ||
  assignment?.departmentType ||
  "Not specified",

        assignedAt:
          assignment?.assignedAt ||
          assignment?.createdAt ||
          "",

        status,
        progressPercent,

        certificate:
          resultRecord?.certificateUrl ||
          resultRecord?.certificateId ||
          completionRecord?.certificateUrl ||
          "",

        score:
          resultRecord?.percentage ??
          resultRecord?.scorePercentage ??
          "",
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b.assignedAt || 0).getTime() -
        new Date(a.assignedAt || 0).getTime()
    );
}, [
  selectedUser,
  allCourses,
  courses,
  deptCourses,
  assignments,
  completedCourses,
  results,
  courseProgress,
  videoProgress,
  currentUser,
  departmentName,
]);

  const formatDate = (value) => { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); };

  const selectedUserStats = useMemo(() => {
  if (!selectedUser) {
    return {
      assigned: 0,
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      certificates: 0,
      completion: 0,
    };
  }

  const rows = selectedUserCourseRows;

  const assigned = rows.length;
  const completed = rows.filter((course) => course.status === "completed").length;
  const inProgress = rows.filter((course) => course.status === "inProgress").length;
  const notStarted = rows.filter((course) => course.status === "notStarted").length;
  const certificates = getRealCertificateCount(selectedUser);
  return {
    assigned,
    completed,
    inProgress,
    notStarted,
    certificates,
    completion: getUserOverallProgress(selectedUser),
  };
}, [selectedUser, selectedUserCourseRows]);
  const downloadReport = () => {
    const rows = filteredUsers.map((u) => ({
      Name: u.name || "", Email: u.email || "", Designation: u.designation || "",
      Zone: getVal(u, ["zone", "Zone", "zoneName"]), State: getVal(u, ["state", "State", "stateName"]), City: getVal(u, ["cityArea", "city", "City", "Area", "area"]),
      "Assigned": getAssignedCount(u), "Completed": getCompletedCount(u),
      "Certificates": getCertificateCount(u), "Completion %": `${getUserOverallProgress(u)}%`,
    }));
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => `"${String(r[h] || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `dept-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  };

  const currentLabel = drillCity || drillState || drillZone || "All Zones";

  if (loading) return <div className="sa-page"><div className="sa-loading">Loading analytics...</div></div>;

  return (
    <div className="sa-page">
      {/* Hero */}
      <section className="sa-hero">
        <div className="sa-hero-left">
          <div className="sa-hero-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
          </div>
          <div>
            <h1>{departmentName || "Department"} Analytics</h1>
            <p>Zone → State → City drill-down for {departmentName || "your department"} users</p>
          </div>
        </div>
        <div className="sa-hero-right">
          <div className="sa-hero-stat"><strong>{overallStats.total}</strong><span>Real Users</span></div>
          <div className="sa-hero-stat"><strong>{overallStats.assigned}</strong><span>Assigned</span></div>
          <div className="sa-hero-stat"><strong>{overallStats.rate}%</strong><span>Completion</span></div>
          <div className="sa-hero-stat sa-hero-cert"><strong>{overallStats.certs}</strong><span>Certificates</span></div>
        </div>
      </section>

      {/* Selector Row */}
      <div className="sa-selector-row sa-fade-in" key={`sel-${animKey}`}>
        <div className="sa-select-group">
          <label>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Zone
          </label>
          <select value={drillZone} onChange={(e) => drillIntoZone(e.target.value)}>
            <option value="">— Select Zone —</option>
            {zones.map((z) => <option key={z.zone} value={z.zone}>{z.zone}</option>)}
          </select>
        </div>
        <div className={`sa-select-group ${!drillZone ? "sa-select-disabled" : ""}`}>
          <label>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            State
          </label>
          <select value={drillState} onChange={(e) => drillIntoState(e.target.value)} disabled={!drillZone}>
            <option value="">— Select State —</option>
            {states.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div className={`sa-select-group ${!drillState ? "sa-select-disabled" : ""}`}>
          <label>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            City
          </label>
          <select value={drillCity} onChange={(e) => drillIntoCity(e.target.value)} disabled={!drillState}>
            <option value="">— Select City —</option>
            {cities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Selected Cards Row */}
      <div className="sa-cards-row">
          {drillZone && (() => {
            const z = zones.find((x) => x.zone === drillZone);
            if (!z) return null;
            return (
              <div className="sa-detail-card" onClick={() => { setDrillLevel("zone"); setDrillState(""); setDrillCity(""); }}>
                <button className="sa-dcard-remove" onClick={(e) => { e.stopPropagation(); setDrillZone(""); setDrillState(""); setDrillCity(""); setSearch(""); setDesignationFilter(""); bumpAnim(); }}>×</button>
                <div className="sa-dcard-avatar" style={{ background: getAvatarColor(0).bg, color: getAvatarColor(0).color }}>{z.zone.charAt(0).toUpperCase()}</div>
                <div className="sa-dcard-body"><strong>{z.zone}</strong><span className="sa-dcard-tag">Zone</span><span className="sa-dcard-meta">{z.total} users • {z.rate}% completion</span></div>
              </div>
            );
          })()}
          {drillZone && drillState && <div className="sa-dcard-arrow"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></div>}
          {drillState && (() => {
            const s = states.find((x) => x.name === drillState);
            if (!s) return null;
            return (
              <div className="sa-detail-card" onClick={() => { setDrillLevel("state"); setDrillCity(""); }}>
                <button className="sa-dcard-remove" onClick={(e) => { e.stopPropagation(); setDrillState(""); setDrillCity(""); setSearch(""); setDesignationFilter(""); bumpAnim(); }}>×</button>
                <div className="sa-dcard-avatar" style={{ background: getAvatarColor(1).bg, color: getAvatarColor(1).color }}>{s.name.charAt(0).toUpperCase()}</div>
                <div className="sa-dcard-body"><strong>{s.name}</strong><span className="sa-dcard-tag">State</span><span className="sa-dcard-meta">{s.total} users • {s.rate}% completion</span></div>
              </div>
            );
          })()}
          {drillState && drillCity && <div className="sa-dcard-arrow"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></div>}
          {drillCity && (() => {
            const c = cities.find((x) => x.name === drillCity);
            if (!c) return null;
            return (
              <div className="sa-detail-card" onClick={() => setDrillLevel("city")}>
                <button className="sa-dcard-remove" onClick={(e) => { e.stopPropagation(); setDrillCity(""); setSearch(""); setDesignationFilter(""); bumpAnim(); }}>×</button>
                <div className="sa-dcard-avatar" style={{ background: getAvatarColor(2).bg, color: getAvatarColor(2).color }}>{c.name.charAt(0).toUpperCase()}</div>
                <div className="sa-dcard-body"><strong>{c.name}</strong><span className="sa-dcard-tag">City</span><span className="sa-dcard-meta">{c.total} users • {c.rate}% completion</span></div>
              </div>
            );
          })()}
      </div>

      {/* Bottom Section */}
        <div className="sa-stats-reveal">
          <div className="sa-kpi-row">
            <div className="sa-kpi sa-kpi-users sa-slide-up" style={{ animationDelay: "0ms" }}>
              <div className="sa-kpi-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
              <div><span>Real Users</span><strong>{filteredUsers.length}</strong></div>
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

          {/* User Table */}
          <div className="sa-users-final-section sa-fade-in" data-scope={`Users in selected ${drillCity ? "city" : drillState ? "state" : "zone"}`} style={{ animationDelay: "100ms" }}>
            <div className="sa-filters-card">
              <div className="sa-filters-row">
                <div className="sa-search-box">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  <input type="text" placeholder={`Search users in ${currentLabel}...`} value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select
  className="sa-filter-select"
  value={departmentFilter}
  onChange={(e) => setDepartmentFilter(e.target.value)}
>
  <option value="all">All Departments</option>
  <option value="my">My Department</option>
  <option value="other">Other Departments</option>
</select>
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
                  <h2>{drillCity ? "City User Report" : drillState ? "State User Report" : "Zone User Report"} — {currentLabel}</h2>
                  <p>{filteredUsers.length} real users • {filteredUsers.reduce((s, user) => s + getCompletedCount(user), 0)} completed</p>
                </div>
                <span className="sa-click-hint">Click a row to view details</span>
              </div>
              <div className="sa-table-wrap">
                <table>
                  <thead>
                  <tr>
  <th>#</th>
  <th>Name</th>
  <th>Department</th>
  <th>Email</th>
  <th>Designation</th>
  <th>Zone</th>
  <th>State</th>
  <th>City</th>
  <th>Assigned</th>
  <th>Completed</th>
  <th>Certs</th>
  <th>Completion</th>
</tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan="12" className="sa-empty">No users found.</td></tr>
                    ) : filteredUsers.map((u, idx) => {
                      const assigned = getAssignedCount(u);
                      const comp = getCompletedCount(u);
                      const pct = getUserOverallProgress(u);
                      return (
                        <tr key={u.id} className="sa-table-row-enter sa-user-clickable-row" style={{ animationDelay: `${idx * 30}ms` }} onClick={() => setSelectedUser(u)} role="button" tabIndex={0} aria-label={`View progress for ${u.name || "user"}`} title="Click to view user progress">
                          <td className="sa-td-idx">{idx + 1}</td>
<td className="sa-td-name">
  <strong className="sa-user-row-name">
    {u.name || "-"}
  </strong>
</td>

<td className="sa-td-department">
  {getDepartmentName(u) || "-"}
</td>
                          <td className="sa-td-email">{u.email || "-"}</td>
                          <td>{u.designation || "-"}</td>
                          <td>{getVal(u, ["zone", "Zone", "zoneName"]) || "-"}</td>
                          <td>{getVal(u, ["state", "State", "stateName"]) || "-"}</td>
                          <td>{getVal(u, ["cityArea", "city", "City", "Area", "area"]) || "-"}</td>
                          <td>{assigned}</td>
                          <td><strong>{comp}</strong></td>
                          <td>{getCertificateCount(u)}</td>
                          <td><div className="sa-pct-cell"><div className="sa-pct-bar"><span style={{ width: `${pct}%` }} /></div><strong>{pct}%</strong></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

      {/* User Detail Drawer */}
      {selectedUser && (
        <div className="sa-user-detail-backdrop" onClick={() => setSelectedUser(null)}>
          <aside className="sa-user-detail-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="sa-user-detail-header">
              <div className="sa-user-detail-profile">
                <div className="sa-user-detail-avatar">
                  {(selectedUser.name || selectedUser.email || "U").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2>{selectedUser.name || "Unnamed User"}</h2>
                  <p>{selectedUser.email || "Email not available"}</p>
                </div>
              </div>
              <button type="button" className="sa-user-detail-close" onClick={() => setSelectedUser(null)} aria-label="Close user progress">×</button>
            </div>
            <div className="sa-user-detail-body">
              <div className="sa-user-location-grid">
                <div><span>Designation</span><strong>{selectedUser.designation || "Not specified"}</strong></div>
                <div><span>Zone</span><strong>{getVal(selectedUser, ["zone", "Zone", "zoneName"]) || "Not assigned"}</strong></div>
                <div><span>State</span><strong>{getVal(selectedUser, ["state", "State", "stateName"]) || "Not assigned"}</strong></div>
                <div><span>City</span><strong>{getVal(selectedUser, ["cityArea", "city", "City", "Area", "area"]) || "Not assigned"}</strong></div>
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
                  <div><h3>Assigned Course Progress</h3><p>Course-wise progress for {selectedUser.name || "this user"}</p></div>
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
                            <div><h4>{course.title}</h4><p>{course.department}{course.assignedAt ? ` • Assigned ${formatDate(course.assignedAt)}` : ""}</p></div>
                            <span className={`sa-course-status ${course.status}`}>{course.status === "completed" ? "Completed" : course.status === "inProgress" ? "In Progress" : "Not Started"}</span>
                          </div>
                          <div className="sa-user-course-progress-row">
                            <div className="sa-user-course-progress-track"><span style={{ width: `${course.progressPercent}%` }} /></div>
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

export default DepartmentAnalytics;
