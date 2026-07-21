import { useEffect, useMemo, useState } from "react";
import { ref, get } from "firebase/database";
import { database } from "../firebase";
import "../styles/superanalytics.css";

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

const BAR_COLORS = [
  "#f59e0b", "#2563eb", "#16a34a", "#7c3aed", "#db2777",
  "#0284c7", "#ea580c", "#059669", "#be185d", "#6d28d9",
];

function getAvatarColor(i) { return AVATAR_COLORS[i % AVATAR_COLORS.length]; }
function getBarColor(i) { return BAR_COLORS[i % BAR_COLORS.length]; }
function getRole(user) { return String(user?.role || "").trim().toLowerCase(); }
function isSuperAdmin(user) { return getRole(user) === "superadmin"; }
function getVal(user, keys) {
  for (const k of keys) { if (user?.[k]) return String(user[k]).trim(); }
  return "";
}

function SuperAdminAnalytics() {
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
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

  useEffect(() => {
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
        ] = await Promise.all([
          get(ref(database, "users")),
          get(ref(database, "courses")),
          get(ref(database, "completedCourses")),
          get(ref(database, "results")),
          get(ref(database, "userAssignments")),
          get(ref(database, "courseProgress")),
          get(ref(database, "videoProgress")),
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
      } catch (e) { console.error("Analytics fetch error:", e); } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const employeeUsers = useMemo(() => users.filter((u) => !isSuperAdmin(u)), [users]);

  const getUserKeys = (userOrId) => {
    if (!userOrId) return [];

    if (typeof userOrId === "string") {
      return [userOrId];
    }

    return [...new Set([userOrId.id, userOrId.uid].filter(Boolean))];
  };

  const mergeUserNode = (root, userOrId) => {
    return getUserKeys(userOrId).reduce(
      (merged, key) => ({
        ...merged,
        ...(root?.[key] || {}),
      }),
      {}
    );
  };

  const isAssignmentActive = (assignment) => {
    return (
      assignment === true ||
      assignment?.assigned === true ||
      assignment?.active === true ||
      String(assignment?.status || "").toLowerCase() === "assigned" ||
      String(assignment?.status || "").toLowerCase() === "active"
    );
  };

  const isCompletedRecord = (record) => {
    return (
      record === true ||
      record?.completed === true ||
      record?.passed === true ||
      record?.isCompleted === true ||
      record?.isPassed === true ||
      String(record?.status || "").toLowerCase() === "completed" ||
      String(record?.status || "").toLowerCase() === "passed"
    );
  };

  const getCompletedCount = (userOrId) => {
    const userCompleted = mergeUserNode(completedCourses, userOrId);

    return Object.values(userCompleted).filter(isCompletedRecord).length;
  };

  const getCertificateCount = (userOrId) => {
    const userResults = mergeUserNode(results, userOrId);

    return Object.values(userResults).filter(
      (record) =>
        record?.certificateUrl ||
        record?.certificateId ||
        record?.certificateIssued ||
        record?.passed ||
        record?.isPassed ||
        String(record?.status || "").toLowerCase() === "passed"
    ).length;
  };

  const getAssignedCourseEntries = (userOrId) => {
    const userAssignments = mergeUserNode(assignments, userOrId);

    return Object.entries(userAssignments).filter(([, assignment]) =>
      isAssignmentActive(assignment)
    );
  };

  const getAssignedCount = (userOrId) => {
    return getAssignedCourseEntries(userOrId).length;
  };

  const getCourseProgressPercent = (userOrId, courseId) => {
    const directCourseProgress =
      mergeUserNode(courseProgress, userOrId)?.[courseId] || {};

    const directCandidates = [
      directCourseProgress.percentage,
      directCourseProgress.progress,
      directCourseProgress.progressPercent,
      directCourseProgress.completionPercent,
      directCourseProgress.completedPercent,
      directCourseProgress.watchedPercent,
    ];

    const directValue = directCandidates
      .map(Number)
      .find((value) => Number.isFinite(value) && value >= 0);

    if (directValue !== undefined) {
      return Math.max(0, Math.min(100, Math.round(directValue)));
    }

    const courseVideos =
      mergeUserNode(videoProgress, userOrId)?.[courseId] || {};

    const progressValues = Object.values(courseVideos)
      .map((video) => {
        if (video?.completed) return 100;

        const value = Number(
          video?.watchedPercent ??
            video?.progressPercent ??
            video?.progress ??
            0
        );

        return Number.isFinite(value)
          ? Math.max(0, Math.min(100, value))
          : 0;
      });

    if (progressValues.length === 0) return 0;

    return Math.round(
      progressValues.reduce((sum, value) => sum + value, 0) /
        progressValues.length
    );
  };

  const getCourseCompletionRecord = (userOrId, courseId) => {
    return mergeUserNode(completedCourses, userOrId)?.[courseId];
  };

  const getCourseResultRecord = (userOrId, courseId) => {
    const userResults = mergeUserNode(results, userOrId);

    return (
      userResults?.[courseId] ||
      Object.values(userResults).find(
        (result) => String(result?.courseId || "") === String(courseId)
      )
    );
  };

  const getCourseStatus = (userOrId, courseId) => {
    const completedRecord = getCourseCompletionRecord(userOrId, courseId);

    if (isCompletedRecord(completedRecord)) {
      return "completed";
    }

    const progressPercent = getCourseProgressPercent(userOrId, courseId);

    return progressPercent > 0 ? "inProgress" : "notStarted";
  };

  const getUserCompletion = (userOrId) => {
    const assigned = getAssignedCount(userOrId);
    const completed = getCompletedCount(userOrId);

    return assigned > 0
      ? Math.min(100, Math.round((completed / assigned) * 100))
      : 0;
  };

  const getGroupStats = (groupUsers) => {
    const total = groupUsers.length;
    const completed = groupUsers.reduce((s, u) => s + getCompletedCount(u), 0);
    const certs = groupUsers.reduce((s, u) => s + getCertificateCount(u), 0);
    const assigned = groupUsers.reduce((s, u) => s + getAssignedCount(u), 0);
    const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
    return { total, completed, certs, assigned, rate };
  };

  // Aggregations
  const zones = useMemo(() => {
    const map = {};
    employeeUsers.forEach((u) => {
      const z = getVal(u, ["zone", "Zone", "zoneName"]) || "Unassigned";
      if (!map[z]) map[z] = [];
      map[z].push(u);
    });
    return Object.entries(map).map(([name, list]) => ({ name, ...getGroupStats(list) })).sort((a, b) => b.rate - a.rate);
  }, [employeeUsers, courses, completedCourses, results, assignments]);

  const states = useMemo(() => {
    const filtered = drillZone ? employeeUsers.filter((u) => (getVal(u, ["zone", "Zone", "zoneName"]) || "Unassigned") === drillZone) : employeeUsers;
    const map = {};
    filtered.forEach((u) => {
      const s = getVal(u, ["state", "State", "stateName"]) || "Unassigned";
      if (!map[s]) map[s] = [];
      map[s].push(u);
    });
    return Object.entries(map).map(([name, list]) => ({ name, ...getGroupStats(list) })).sort((a, b) => b.rate - a.rate);
  }, [employeeUsers, drillZone, courses, completedCourses, results, assignments]);

  const cities = useMemo(() => {
    let filtered = employeeUsers;
    if (drillZone) filtered = filtered.filter((u) => (getVal(u, ["zone", "Zone", "zoneName"]) || "Unassigned") === drillZone);
    if (drillState) filtered = filtered.filter((u) => (getVal(u, ["state", "State", "stateName"]) || "Unassigned") === drillState);
    const map = {};
    filtered.forEach((u) => {
      const c = getVal(u, ["cityArea", "city", "City", "Area", "area"]) || "Unassigned";
      if (!map[c]) map[c] = [];
      map[c].push(u);
    });
    return Object.entries(map).map(([name, list]) => ({ name, ...getGroupStats(list) })).sort((a, b) => b.rate - a.rate);
  }, [employeeUsers, drillZone, drillState, courses, completedCourses, results, assignments]);

  const contextUsers = useMemo(() => {
    let filtered = employeeUsers;
    if (drillZone) filtered = filtered.filter((u) => (getVal(u, ["zone", "Zone", "zoneName"]) || "Unassigned") === drillZone);
    if (drillState) filtered = filtered.filter((u) => (getVal(u, ["state", "State", "stateName"]) || "Unassigned") === drillState);
    if (drillCity) filtered = filtered.filter((u) => (getVal(u, ["cityArea", "city", "City", "Area", "area"]) || "Unassigned") === drillCity);
    return filtered;
  }, [employeeUsers, drillZone, drillState, drillCity]);

  const filteredUsers = useMemo(() => {
    return contextUsers.filter((u) => {
      const text = [u.name, u.email, u.designation, u.zone, u.state, u.cityArea].filter(Boolean).join(" ").toLowerCase();
      return text.includes(search.toLowerCase()) && (!designationFilter || u.designation === designationFilter);
    });
  }, [contextUsers, search, designationFilter]);

  const designations = useMemo(() => [...new Set(contextUsers.map((u) => u.designation).filter(Boolean))].sort(), [contextUsers]);

  const bumpAnim = () => setAnimKey((k) => k + 1);

  const drillIntoZone = (zone) => { bumpAnim(); setDrillZone(zone); setDrillState(""); setDrillCity(""); setDrillLevel("zone"); setSearch(""); setDesignationFilter(""); };
  const drillIntoState = (state) => { bumpAnim(); setDrillState(state); setDrillCity(""); setDrillLevel("state"); setSearch(""); setDesignationFilter(""); };
  const drillIntoCity = (city) => { bumpAnim(); setDrillCity(city); setDrillLevel("city"); setSearch(""); setDesignationFilter(""); };

  const goBack = () => {
    bumpAnim();
    if (drillLevel === "city") { setDrillCity(""); setDrillLevel("state"); }
    else if (drillLevel === "state") { setDrillState(""); setDrillLevel("zone"); }
    else if (drillLevel === "zone") { setDrillZone(""); setDrillLevel("overview"); }
    setSearch(""); setDesignationFilter("");
  };

  const resetAll = () => { bumpAnim(); setDrillLevel("overview"); setDrillZone(""); setDrillState(""); setDrillCity(""); setSearch(""); setDesignationFilter(""); };

  const breadcrumbs = [];
  if (drillLevel !== "overview") {
    breadcrumbs.push({ label: "All Zones", onClick: resetAll });
    if (drillZone) breadcrumbs.push({ label: drillZone, onClick: () => { bumpAnim(); setDrillState(""); setDrillCity(""); setDrillLevel("zone"); } });
    if (drillState && drillLevel !== "zone") breadcrumbs.push({ label: drillState, onClick: () => { bumpAnim(); setDrillCity(""); setDrillLevel("state"); } });
    if (drillCity && drillLevel === "city") breadcrumbs.push({ label: drillCity, onClick: null });
  }

  const overallStats = useMemo(() => getGroupStats(employeeUsers), [employeeUsers, courses, completedCourses, results, assignments]);

  const selectedUserCourseRows = useMemo(() => {
    if (!selectedUser) return [];

    const assignedEntries = getAssignedCourseEntries(selectedUser);

    return assignedEntries
      .map(([courseId, assignment]) => {
        const course = courses.find(
          (item) => String(item.id) === String(courseId)
        );

        const completionRecord = getCourseCompletionRecord(
          selectedUser,
          courseId
        );

        const resultRecord = getCourseResultRecord(
          selectedUser,
          courseId
        );

        const status = getCourseStatus(selectedUser, courseId);
        const progressPercent =
          status === "completed"
            ? 100
            : getCourseProgressPercent(selectedUser, courseId);

        return {
          courseId,
          title:
            course?.title ||
            course?.courseTitle ||
            course?.courseName ||
            course?.name ||
            assignment?.courseTitle ||
            "Untitled Course",
          department:
            course?.departmentName ||
            course?.department ||
            assignment?.departmentName ||
            assignment?.department ||
            "Not specified",
          assignedAt:
            assignment?.assignedAt ||
            assignment?.createdAt ||
            assignment?.dateAssigned ||
            "",
          status,
          progressPercent,
          certificate:
            resultRecord?.certificateUrl ||
            resultRecord?.certificateId ||
            completionRecord?.certificateUrl ||
            completionRecord?.certificateId ||
            "",
          score:
            resultRecord?.percentage ??
            resultRecord?.scorePercentage ??
            resultRecord?.marksPercentage ??
            "",
        };
      })
      .sort((a, b) => {
        const aTime = new Date(a.assignedAt || 0).getTime();
        const bTime = new Date(b.assignedAt || 0).getTime();
        return bTime - aTime;
      });
  }, [
    selectedUser,
    courses,
    assignments,
    completedCourses,
    results,
    courseProgress,
    videoProgress,
  ]);

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

    const assigned = selectedUserCourseRows.length;
    const completed = selectedUserCourseRows.filter(
      (course) => course.status === "completed"
    ).length;
    const inProgress = selectedUserCourseRows.filter(
      (course) => course.status === "inProgress"
    ).length;
    const notStarted = selectedUserCourseRows.filter(
      (course) => course.status === "notStarted"
    ).length;

    return {
      assigned,
      completed,
      inProgress,
      notStarted,
      certificates: getCertificateCount(selectedUser),
      completion:
        assigned > 0
          ? Math.round((completed / assigned) * 100)
          : 0,
    };
  }, [selectedUser, selectedUserCourseRows, results]);

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const downloadReport = () => {
    const rows = filteredUsers.map((u) => ({
      Name: u.name || "", Email: u.email || "", Role: getRole(u), Designation: u.designation || "",
      Zone: getVal(u, ["zone", "Zone"]), State: getVal(u, ["state", "State"]), City: getVal(u, ["cityArea", "city", "City"]),
      "Assigned": getAssignedCount(u), "Completed": getCompletedCount(u),
      "Certificates": getCertificateCount(u), "Completion %": `${getUserCompletion(u)}%`,
    }));
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => `"${String(r[h] || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `analytics-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  };

  if (loading) return <div className="sa-page"><div className="sa-loading">Loading analytics...</div></div>;

  const currentLabel = drillCity || drillState || drillZone || "All Zones";

  // Reusable card renderer
  const renderCards = (items, level) => {
    const nextLabel = level === "overview" ? "zones" : level === "zone" ? "states" : level === "state" ? "cities" : "users";
    const sectionTitle = level === "overview" ? "Zone-wise Overview" : level === "zone" ? `States in ${drillZone}` : `Cities in ${drillState}`;
    const sectionHint = level === "overview" ? "Click any zone to see states" : level === "zone" ? "Click any state to see cities" : "Click any city to see users";

    return (
      <div key={`${level}-${animKey}`} className="sa-fade-in">
        <div className="sa-section-head">
          <h2>{sectionTitle}</h2>
          <p>{items.length} {nextLabel} — {sectionHint}</p>
        </div>
        <div className="sa-course-list">
          {items.map((item, idx) => {
            const av = getAvatarColor(idx);
            const barColor = getBarColor(idx);
            const initial = item.name.charAt(0).toUpperCase();
            return (
              <div className="sa-course-row sa-card-enter" key={item.name} style={{ animationDelay: `${idx * 50}ms` }} onClick={() => {
                if (level === "overview") drillIntoZone(item.name);
                else if (level === "zone") drillIntoState(item.name);
                else drillIntoCity(item.name);
              }}>
                <div className="sa-course-avatar" style={{ background: av.bg, color: av.color }}>{initial}</div>
                <div className="sa-course-info">
                  <h3>{item.name}</h3>
                  <span>{item.assigned} Assigned • {item.completed} Done</span>
                </div>
                <div className="sa-course-progress-wrap">
                  <div className="sa-course-progress-bar"><span style={{ width: `${item.rate}%`, background: barColor }} /></div>
                  <strong style={{ color: barColor }}>{item.rate}%</strong>
                </div>
              </div>
            );
          })}
          {items.length === 0 && <p className="sa-empty">No {nextLabel} found.</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="sa-page">

      {/* Hero */}
      <section className="sa-hero">
        <div className="sa-hero-left">
          <div className="sa-hero-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
          </div>
          <div>
            <h1>Training Analytics</h1>
            <p>Drill down: Zone → State → City → Users</p>
          </div>
        </div>
        <div className="sa-hero-right">
          <div className="sa-hero-stat"><strong>{overallStats.total}</strong><span>Users</span></div>
          <div className="sa-hero-stat"><strong>{overallStats.assigned}</strong><span>Assigned</span></div>
          <div className="sa-hero-stat"><strong>{overallStats.rate}%</strong><span>Completion</span></div>
          <div className="sa-hero-stat sa-hero-cert"><strong>{overallStats.certs}</strong><span>Certificates</span></div>
        </div>
      </section>

      {/* Breadcrumb */}
      {drillLevel !== "overview" && (
        <div className="sa-breadcrumb sa-fade-in">
          <button className="sa-back-btn" onClick={goBack}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            Back
          </button>
          <div className="sa-breadcrumbs">
            {breadcrumbs.map((b, i) => (
              <span key={i}>
                {b.onClick ? <button className="sa-crumb-link" onClick={b.onClick}>{b.label}</button> : <span className="sa-crumb-current">{b.label}</span>}
                {i < breadcrumbs.length - 1 && <span className="sa-crumb-sep">/</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* KPI Row */}
      <div className="sa-kpi-row" key={`kpi-${drillLevel}-${drillZone}-${drillState}-${drillCity}`}>
        <div className="sa-kpi sa-kpi-users sa-kpi-enter" style={{ animationDelay: "0ms" }}>
          <div className="sa-kpi-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
          <div><span>Users</span><strong>{filteredUsers.length}</strong></div>
        </div>
        <div className="sa-kpi sa-kpi-completed sa-kpi-enter" style={{ animationDelay: "60ms" }}>
          <div className="sa-kpi-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg></div>
          <div><span>Completed</span><strong>{filteredUsers.reduce((s, u) => s + getCompletedCount(u), 0)}</strong></div>
        </div>
        <div className="sa-kpi sa-kpi-certs sa-kpi-enter" style={{ animationDelay: "120ms" }}>
          <div className="sa-kpi-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15l-2 5l9-13h-5l2-5-9 13h5z"/></svg></div>
          <div><span>Certificates</span><strong>{filteredUsers.reduce((s, u) => s + getCertificateCount(u), 0)}</strong></div>
        </div>
        <div className="sa-kpi sa-kpi-rate sa-kpi-enter" style={{ animationDelay: "180ms" }}>
          <div className="sa-kpi-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
          <div><span>Rate</span><strong>{filteredUsers.length > 0 ? Math.round((filteredUsers.reduce((s, u) => s + getCompletedCount(u), 0) / (filteredUsers.reduce((s, u) => s + getAssignedCount(u), 0) || 1)) * 100) : 0}%</strong></div>
        </div>
      </div>

      {/* Filters */}
      <div className="sa-filters-card sa-fade-in" style={{ animationDelay: "200ms" }}>
        <div className="sa-filters-row">
          <div className="sa-search-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input type="text" placeholder="Search name, email, designation..." value={search} onChange={(e) => setSearch(e.target.value)} />
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

      {/* ─── Drill-down cards ─── */}
      {drillLevel === "overview" && renderCards(zones, "overview")}
      {drillLevel === "zone" && renderCards(states, "zone")}
      {drillLevel === "state" && renderCards(cities, "state")}

      {/* ─── USER TABLE ─── */}
      {(drillLevel === "city" || drillLevel === "state" || drillLevel === "zone") && (
        <div className="sa-card sa-fade-in" style={{ animationDelay: "100ms" }}>
          <div className="sa-table-head">
            <div>
              <h2>User Training Report — {currentLabel}</h2>
              <p>{filteredUsers.length} users • {filteredUsers.reduce((s, u) => s + getCompletedCount(u), 0)} completed</p>
            </div>
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
                  <th>City</th>
                  <th>Assigned</th>
                  <th>Completed</th>
                  <th>Certs</th>
                  <th>Completion</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan="11" className="sa-empty">No users found.</td></tr>
                ) : filteredUsers.map((u, idx) => {
                  const assigned = getAssignedCount(u);
                  const comp = getCompletedCount(u);
                  const pct = getUserCompletion(u);
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
                      aria-label={`View complete progress for ${
                        u.name || "this user"
                      }`}
                      title="Click anywhere in this row to view complete user progress"
                    >
                      <td className="sa-td-idx">{idx + 1}</td>
                      <td className="sa-td-name">
                        <strong className="sa-user-row-name">
                          {u.name || "-"}
                        </strong>
                      </td>
                      <td className="sa-td-email">{u.email || "-"}</td>
                      <td>{u.designation || "-"}</td>
                      <td>{getVal(u, ["zone", "Zone"]) || "-"}</td>
                      <td>{getVal(u, ["state", "State"]) || "-"}</td>
                      <td>{getVal(u, ["cityArea", "city", "City"]) || "-"}</td>
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
      )}

      {selectedUser && (
        <div
          className="sa-user-detail-backdrop"
          onClick={() => setSelectedUser(null)}
        >
          <aside
            className="sa-user-detail-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sa-user-detail-header">
              <div className="sa-user-detail-profile">
                <div className="sa-user-detail-avatar">
                  {(selectedUser.name || selectedUser.email || "U")
                    .split(" ")
                    .map((word) => word[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <div>
                  <h2>{selectedUser.name || "Unnamed User"}</h2>
                  <p>{selectedUser.email || "Email not available"}</p>
                </div>
              </div>

              <button
                type="button"
                className="sa-user-detail-close"
                onClick={() => setSelectedUser(null)}
                aria-label="Close user progress"
              >
                ×
              </button>
            </div>

            <div className="sa-user-detail-body">
              <div className="sa-user-location-grid">
                <div>
                  <span>Designation</span>
                  <strong>{selectedUser.designation || "Not specified"}</strong>
                </div>

                <div>
                  <span>Zone</span>
                  <strong>
                    {getVal(selectedUser, ["zone", "Zone", "zoneName"]) ||
                      "Not assigned"}
                  </strong>
                </div>

                <div>
                  <span>State</span>
                  <strong>
                    {getVal(selectedUser, ["state", "State", "stateName"]) ||
                      "Not assigned"}
                  </strong>
                </div>

                <div>
                  <span>City</span>
                  <strong>
                    {getVal(selectedUser, [
                      "cityArea",
                      "city",
                      "City",
                      "Area",
                      "area",
                    ]) || "Not assigned"}
                  </strong>
                </div>
              </div>

              <div className="sa-user-progress-summary">
                <div className="sa-user-summary-card assigned">
                  <strong>{selectedUserStats.assigned}</strong>
                  <span>Assigned</span>
                </div>

                <div className="sa-user-summary-card completed">
                  <strong>{selectedUserStats.completed}</strong>
                  <span>Completed</span>
                </div>

                <div className="sa-user-summary-card progress">
                  <strong>{selectedUserStats.inProgress}</strong>
                  <span>In Progress</span>
                </div>

                <div className="sa-user-summary-card pending">
                  <strong>{selectedUserStats.notStarted}</strong>
                  <span>Not Started</span>
                </div>

                <div className="sa-user-summary-card certificate">
                  <strong>{selectedUserStats.certificates}</strong>
                  <span>Certificates</span>
                </div>

                <div className="sa-user-summary-card rate">
                  <strong>{selectedUserStats.completion}%</strong>
                  <span>Completion</span>
                </div>
              </div>

              <div className="sa-user-course-section">
                <div className="sa-user-course-head">
                  <div>
                    <h3>Assigned Course Progress</h3>
                    <p>
                      Course-wise progress for {selectedUser.name || "this user"}
                    </p>
                  </div>

                  <span>{selectedUserCourseRows.length} courses</span>
                </div>

                <div className="sa-user-course-list">
                  {selectedUserCourseRows.length === 0 ? (
                    <div className="sa-user-no-courses">
                      No courses are currently assigned to this user.
                    </div>
                  ) : (
                    selectedUserCourseRows.map((course, index) => (
                      <div
                        className="sa-user-course-card"
                        key={course.courseId}
                      >
                        <div className="sa-user-course-number">
                          {index + 1}
                        </div>

                        <div className="sa-user-course-content">
                          <div className="sa-user-course-title-row">
                            <div>
                              <h4>{course.title}</h4>
                              <p>
                                {course.department}
                                {course.assignedAt
                                  ? ` • Assigned ${formatDate(
                                      course.assignedAt
                                    )}`
                                  : ""}
                              </p>
                            </div>

                            <span
                              className={`sa-course-status ${course.status}`}
                            >
                              {course.status === "completed"
                                ? "Completed"
                                : course.status === "inProgress"
                                ? "In Progress"
                                : "Not Started"}
                            </span>
                          </div>

                          <div className="sa-user-course-progress-row">
                            <div className="sa-user-course-progress-track">
                              <span
                                style={{
                                  width: `${course.progressPercent}%`,
                                }}
                              />
                            </div>

                            <strong>{course.progressPercent}%</strong>
                          </div>

                          {(course.score !== "" || course.certificate) && (
                            <div className="sa-user-course-extra">
                              {course.score !== "" && (
                                <span>Test score: {course.score}%</span>
                              )}

                              {course.certificate && (
                                <span>Certificate issued</span>
                              )}
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

export default SuperAdminAnalytics;
