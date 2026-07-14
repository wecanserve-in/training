import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref, remove } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/assignedusers.css";

const AVATAR_COLORS = [
  { bg: "#fef3c7", color: "#b45309" },
  { bg: "#dbeafe", color: "#1d4ed8" },
  { bg: "#dcfce7", color: "#15803d" },
  { bg: "#ede9fe", color: "#6d28d9" },
  { bg: "#fce7f3", color: "#be185d" },
  { bg: "#e0f2fe", color: "#0369a1" },
  { bg: "#fff7ed", color: "#c2410c" },
  { bg: "#f0fdf4", color: "#047857" },
];

function AssignedUsers() {
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [completedCourses, setCompletedCourses] = useState({});
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) { setLoading(false); return; }
      try {
        const userSnap = await get(ref(database, `users/${loggedUser.uid}`));
        const loggedUserData = userSnap.exists() ? { id: loggedUser.uid, ...userSnap.val() } : null;
        const rawRole = String(loggedUserData?.role || "").toLowerCase().replace(/[\s_-]/g, "");
        const isSuperAdmin = rawRole === "superadmin";
        const isAdmin = rawRole === "admin";
        const isDeptAdmin = rawRole === "departmentadmin";
        let userDepartment = loggedUserData?.department || "";
        let userDepartmentId = loggedUserData?.departmentId || "";

        if (isDeptAdmin) {
          const deptSnap = await get(ref(database, "departments"));
          if (deptSnap.exists()) {
            const match = Object.entries(deptSnap.val()).find(
              ([, d]) => d.departmentAdminId === loggedUser.uid
            );
            if (match) {
              userDepartmentId = userDepartmentId || match[0];
              userDepartment = userDepartment || match[1].departmentName || "";
            }
          }
        }

        const [coursesSnap, usersSnap, assignmentsSnap, completedSnap, progressSnap] = await Promise.allSettled([
          get(ref(database, "courses")),
          get(ref(database, "users")),
          get(ref(database, "userAssignments")),
          get(ref(database, "completedCourses")),
          get(ref(database, "progress")),
        ]);

        if (coursesSnap.status === "fulfilled" && coursesSnap.value.exists()) {
          const allCourses = Object.entries(coursesSnap.value.val()).map(([id, c]) => ({ id, ...c }));
          if (isDeptAdmin) {
            setCourses(allCourses.filter((c) => {
              if (c.createdBy === loggedUser.uid) return true;
              if (userDepartment && c.department === userDepartment) return true;
              if (userDepartmentId && c.departmentId === userDepartmentId) return true;
              return false;
            }));
          } else {
            setCourses(allCourses);
          }
        }

        if (usersSnap.status === "fulfilled" && usersSnap.value.exists()) {
          const allUsers = Object.entries(usersSnap.value.val()).map(([id, u]) => ({ id, uid: u.uid || id, ...u }));
          const getField = (obj, keys) => {
            for (const k of keys) { if (obj?.[k]) return String(obj[k]).trim(); }
            return "";
          };
          const visibleUsers = allUsers.filter((u) => {
            const role = getField(u, ["role"]).toLowerCase().replace(/[\s_-]/g, "");
            if (isSuperAdmin) return true;
            if (isAdmin) return role !== "superadmin";
            if (isDeptAdmin) {
              if (["superadmin", "admin", "departmentadmin"].includes(role)) return false;
              return true;
            }
            return true;
          });
          setUsers(visibleUsers);
        }

        if (assignmentsSnap.status === "fulfilled" && assignmentsSnap.value.exists()) setAssignments(assignmentsSnap.value.val());
        if (completedSnap.status === "fulfilled" && completedSnap.value.exists()) setCompletedCourses(completedSnap.value.val());
        if (progressSnap.status === "fulfilled" && progressSnap.value.exists()) setProgress(progressSnap.value.val());
      } catch (e) { console.error(e); } finally { setLoading(false); }
    });
    return () => unsubscribe();
  }, []);

  const getVal = (obj, keys) => {
    for (const k of keys) { if (obj?.[k]) return String(obj[k]).trim(); }
    return "";
  };

  const getUserCourseStatus = (userId, courseId) => {
    const completed = completedCourses?.[userId]?.[courseId];
    if (completed?.passed || completed?.completed) return "completed";
    const prog = progress?.[userId]?.[courseId];
    if (prog && (prog.started || prog.lastAccessed || prog.videoProgress || prog.quizAttempted)) return "inProgress";
    return "notStarted";
  };

  // Build course cards with stats
  const courseCards = useMemo(() => {
    return courses.map((course) => {
      let assigned = 0, completed = 0, inProgress = 0, notStarted = 0;
      const assignedUsers = [];

      Object.entries(assignments).forEach(([userId, userAssignments]) => {
        const a = userAssignments?.[course.id];
        if (a?.assigned) {
          assigned++;
          const status = getUserCourseStatus(userId, course.id);
          if (status === "completed") completed++;
          else if (status === "inProgress") inProgress++;
          else notStarted++;

          const user = users.find((u) => u.id === userId || u.uid === userId);
          if (user) {
            assignedUsers.push({ ...user, status, userId });
          }
        }
      });

      const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
      return { ...course, assigned, completed, inProgress, notStarted, rate, assignedUsers };
    }).sort((a, b) => b.assigned - a.assigned);
  }, [courses, users, assignments, completedCourses, progress]);

  const selectedCourse = useMemo(() => courseCards.find((c) => c.id === selectedCourseId), [courseCards, selectedCourseId]);

  const filteredUsers = useMemo(() => {
    if (!selectedCourse) return [];
    return selectedCourse.assignedUsers.filter((u) => {
      const text = [u.name, u.email, u.designation, u.zone, u.state, u.cityArea].filter(Boolean).join(" ").toLowerCase();
      return (
        text.includes(search.toLowerCase()) &&
        (!statusFilter || u.status === statusFilter)
      );
    });
  }, [selectedCourse, search, statusFilter]);

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
    } catch (e) {
      console.error(e);
      alert("Failed to unassign.");
    }
  };

  const goBack = () => { setSelectedCourseId(""); setSearch(""); setStatusFilter(""); setAnimKey((k) => k + 1); };

  if (loading) return <div className="au-page"><div className="au-loading">Loading assigned users...</div></div>;

  const getStatusLabel = (s) => s === "completed" ? "Completed" : s === "inProgress" ? "In Progress" : "Not Started";

  return (
    <div className="au-page">

      {/* Hero */}
      <section className="au-hero">
        <div className="au-hero-left">
          <div className="au-hero-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <h1>{selectedCourse ? selectedCourse.title : "Assigned Users"}</h1>
            <p>{selectedCourse ? `${selectedCourse.assigned} users assigned — ${selectedCourse.completed} completed` : "Click a course to see who it's assigned to"}</p>
          </div>
        </div>
        <div className="au-hero-right">
          {selectedCourse ? (
            <>
              <div className="au-hero-stat"><strong>{selectedCourse.assigned}</strong><span>Assigned</span></div>
              <div className="au-hero-stat au-stat-done"><strong>{selectedCourse.completed}</strong><span>Done</span></div>
              <div className="au-hero-stat au-stat-prog"><strong>{selectedCourse.inProgress}</strong><span>In Progress</span></div>
              <div className="au-hero-stat au-stat-wait"><strong>{selectedCourse.notStarted}</strong><span>Not Started</span></div>
            </>
          ) : (
            <>
              <div className="au-hero-stat"><strong>{courseCards.length}</strong><span>Courses</span></div>
              <div className="au-hero-stat"><strong>{courseCards.reduce((s, c) => s + c.assigned, 0)}</strong><span>Total Assigned</span></div>
              <div className="au-hero-stat au-stat-done"><strong>{courseCards.reduce((s, c) => s + c.completed, 0)}</strong><span>Completed</span></div>
            </>
          )}
        </div>
      </section>

      {/* ─── COURSE LIST (overview) ─── */}
      {!selectedCourseId && (
        <div key={`courses-${animKey}`} className="au-fade-in">
          <div className="au-section-head">
            <h2>All Courses</h2>
            <p>{courseCards.length} courses — click to view assigned users</p>
          </div>
          <div className="au-course-list">
            {courseCards.map((course, idx) => {
              const av = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              const initial = (course.title || "C").charAt(0).toUpperCase();
              return (
                <div className="au-course-row au-card-enter" key={course.id} style={{ animationDelay: `${idx * 50}ms` }} onClick={() => { setSelectedCourseId(course.id); setAnimKey((k) => k + 1); }}>
                  <div className="au-course-avatar" style={{ background: av.bg, color: av.color }}>{initial}</div>
                  <div className="au-course-info">
                    <h3>{course.title}</h3>
                    <span>{course.assigned} Assigned • {course.completed} Done • {course.inProgress} In Progress</span>
                  </div>
                  <div className="au-course-progress-wrap">
                    <div className="au-course-progress-bar"><span style={{ width: `${course.rate}%` }} /></div>
                    <strong>{course.rate}%</strong>
                  </div>
                </div>
              );
            })}
            {courseCards.length === 0 && <p className="au-empty">No courses found.</p>}
          </div>
        </div>
      )}

      {/* ─── USER TABLE (course selected) ─── */}
      {selectedCourse && (
        <>
          {/* Back + Filters */}
          <div className="au-toolbar au-fade-in">
            <button className="au-back-btn" onClick={goBack}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
              All Courses
            </button>
            <div className="au-filters">
              <div className="au-search-box">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input type="text" placeholder="Search name, email..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="au-status-pills">
                <button className={`au-pill ${statusFilter === "" ? "active" : ""}`} onClick={() => setStatusFilter("")}>All</button>
                <button className={`au-pill au-pill-notstarted ${statusFilter === "notStarted" ? "active" : ""}`} onClick={() => setStatusFilter("notStarted")}>Not Started</button>
                <button className={`au-pill au-pill-progress ${statusFilter === "inProgress" ? "active" : ""}`} onClick={() => setStatusFilter("inProgress")}>In Progress</button>
                <button className={`au-pill au-pill-done ${statusFilter === "completed" ? "active" : ""}`} onClick={() => setStatusFilter("completed")}>Completed</button>
              </div>
            </div>
          </div>

          {/* Status summary bar */}
          <div className="au-status-bar au-fade-in">
            <div className="au-status-chip au-chip-all" onClick={() => setStatusFilter("")}>
              <strong>{selectedCourse.assigned}</strong><span>All</span>
            </div>
            <div className="au-status-chip au-chip-notstarted" onClick={() => setStatusFilter("notStarted")}>
              <strong>{selectedCourse.notStarted}</strong><span>Not Started</span>
            </div>
              <div className="au-status-chip au-chip-progress" onClick={() => setStatusFilter("inProgress")}>
              <strong>{selectedCourse.inProgress}</strong><span>In Progress</span></div>
            <div className="au-status-chip au-chip-done" onClick={() => setStatusFilter("completed")}>
              <strong>{selectedCourse.completed}</strong><span>Completed</span>
            </div>
          </div>

          {/* User Table */}
          <div className="au-card au-fade-in" style={{ animationDelay: "100ms" }}>
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
                    <tr key={u.id} className="au-table-row-enter" style={{ animationDelay: `${idx * 30}ms` }}>
                      <td className="au-td-idx">{idx + 1}</td>
                      <td className="au-td-name"><strong>{u.name || "-"}</strong></td>
                      <td className="au-td-email">{u.email || "-"}</td>
                      <td>{u.designation || "-"}</td>
                      <td>{getVal(u, ["zone", "Zone"]) || "-"}</td>
                      <td>{getVal(u, ["state", "State"]) || "-"}</td>
                      <td>
                        <span className={`au-status-badge au-status-${u.status}`}>
                          {getStatusLabel(u.status)}
                        </span>
                      </td>
                      <td>
                        <button className="au-unassign-btn" onClick={(e) => { e.stopPropagation(); unassignUser(u.id, selectedCourseId, u.name || "this user"); }}>
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
        </>
      )}

    </div>
  );
}

export default AssignedUsers;
