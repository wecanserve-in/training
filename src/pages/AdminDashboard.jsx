import { useEffect, useMemo, useState } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "../firebase";
import "../styles/admindashboard.css";

function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [completedCourses, setCompletedCourses] = useState({});
  const [results, setResults] = useState({});
  const [userAssignments, setUserAssignments] = useState({});
  const [oldAssignments, setOldAssignments] = useState({});
  const [coursesData, setCoursesData] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  const objectToArray = (data) => {
    if (!data || typeof data !== "object") return [];
    return Object.entries(data).map(([id, value]) => ({
      id,
      ...(value && typeof value === "object" ? value : { value }),
    }));
  };

  const getTime = (value) => {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  };

  useEffect(() => {
    const loadedPaths = new Set();

    const markLoaded = (path) => {
      loadedPaths.add(path);
      if (loadedPaths.size === 8) setLoading(false);
    };

    const watchPath = (path, handler) => {
      return onValue(
        ref(database, path),
        (snapshot) => {
          handler(snapshot);
          markLoaded(path);
        },
        (error) => {
          console.error(`Firebase error at ${path}:`, error);
          markLoaded(path);
        }
      );
    };

    const unsubUsers = watchPath("users", (s) => {
      setUsers(s.exists() ? objectToArray(s.val()) : []);
    });

    const unsubDepartments = watchPath("departments", (s) => {
      setDepartments(s.exists() ? objectToArray(s.val()) : []);
    });

    const unsubCompletedCourses = watchPath("completedCourses", (s) => {
      setCompletedCourses(s.exists() ? s.val() : {});
    });

    const unsubResults = watchPath("results", (s) => {
      setResults(s.exists() ? s.val() : {});
    });

    const unsubUserAssignments = watchPath("userAssignments", (s) => {
      setUserAssignments(s.exists() ? s.val() : {});
    });

    const unsubOldAssignments = watchPath("assignments", (s) => {
      setOldAssignments(s.exists() ? s.val() : {});
    });

    const unsubCourses = watchPath("courses", (s) => {
      setCoursesData(s.exists() ? objectToArray(s.val()) : []);
    });

    const unsubAttempts = watchPath("attempts", (s) => {
      const val = s.val() || {};
      const list = [];
      Object.entries(val).forEach(([uid, userAttempts]) => {
        Object.entries(userAttempts || {}).forEach(([attemptId, attempt]) => {
          list.push({ id: attemptId, userId: uid, ...attempt });
        });
      });
      setAttempts(
        list.sort(
          (a, b) =>
            getTime(b.submittedAt || b.createdAt || b.date) -
            getTime(a.submittedAt || a.createdAt || a.date)
        )
      );
    });

    return () => {
      unsubUsers();
      unsubDepartments();
      unsubCompletedCourses();
      unsubResults();
      unsubUserAssignments();
      unsubOldAssignments();
      unsubCourses();
      unsubAttempts();
    };
  }, []);

  const getRole = (user) => String(user?.role || "").trim().toLowerCase();

  const learners = useMemo(() => users.filter((u) => getRole(u) === "user"), [users]);

  const departmentAdmins = useMemo(
    () =>
      users.filter((u) => {
        const r = getRole(u);
        return r === "departmentadmin" || r === "department admin" || r === "department_admin" || r === "deptadmin" || r === "dept admin";
      }),
    [users]
  );

  const assignments = useMemo(() => {
    const merged = {};
    const add = (source) => {
      if (!source || typeof source !== "object") return;
      Object.entries(source).forEach(([userId, data]) => {
        if (!merged[userId]) merged[userId] = {};
        if (Array.isArray(data)) {
          data.forEach((cId) => { if (cId) merged[userId][cId] = true; });
          return;
        }
        if (data && typeof data === "object") merged[userId] = { ...merged[userId], ...data };
      });
    };
    add(oldAssignments);
    add(userAssignments);
    return merged;
  }, [oldAssignments, userAssignments]);

  const learnerIds = useMemo(() => new Set(learners.map((u) => String(u.id))), [learners]);

  const countValid = (data) => {
    if (!data) return 0;
    if (Array.isArray(data)) return data.filter(Boolean).length;
    if (typeof data !== "object") return 0;
    return Object.values(data).filter((v) => v !== false && v !== null && v !== undefined).length;
  };

  const getAssignedCount = (userId) => countValid(assignments?.[userId]);
  const getCompletedCount = (userId) => countValid(completedCourses?.[userId]);

  const getCertCount = (userId) => {
    const r = results?.[userId];
    if (!r || typeof r !== "object") return 0;
    return Object.values(r).filter((v) => {
      if (v === true) return true;
      if (!v || typeof v !== "object") return false;
      return v.passed === true || v.isPassed === true || String(v.status || "").toLowerCase() === "passed";
    }).length;
  };

  const totalAssigned = useMemo(
    () => learners.reduce((t, u) => t + getAssignedCount(u.id), 0),
    [learners, assignments]
  );

  const totalCompleted = useMemo(
    () => learners.reduce((t, u) => t + getCompletedCount(u.id), 0),
    [learners, completedCourses]
  );

  const totalCerts = useMemo(
    () => learners.reduce((t, u) => t + getCertCount(u.id), 0),
    [learners, results]
  );

  const pendingCourses = Math.max(totalAssigned - totalCompleted, 0);
  const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;
  const safeRate = Math.min(Math.max(completionRate, 0), 100);

  const usersNeedingAttention = useMemo(
    () =>
      learners
        .map((u) => {
          const a = getAssignedCount(u.id);
          const c = getCompletedCount(u.id);
          return { ...u, assigned: a, completed: c, pending: Math.max(a - c, 0), completion: a > 0 ? Math.round((c / a) * 100) : 0 };
        })
        .filter((u) => u.assigned > 0 && u.completion < 100)
        .sort((a, b) => b.pending - a.pending)
        .slice(0, 5),
    [learners, assignments, completedCourses]
  );

  const departmentSummary = useMemo(
    () =>
      departments.slice(0, 5).map((dept) => {
        const name = dept.departmentName || dept.name || dept.title || "";
        const deptUsers = learners.filter(
          (u) =>
            (dept.id && u.departmentId === dept.id) ||
            String(u.department || "").trim().toLowerCase() === String(name).trim().toLowerCase()
        );
        const a = deptUsers.reduce((t, u) => t + getAssignedCount(u.id), 0);
        const c = deptUsers.reduce((t, u) => t + getCompletedCount(u.id), 0);
        return { ...dept, deptName: name, users: deptUsers.length, assigned: a, completed: c, completion: a > 0 ? Math.round((c / a) * 100) : 0 };
      }),
    [departments, learners, assignments, completedCourses]
  );

  const courseWiseProgress = useMemo(() => {
    return coursesData.slice(0, 5).map((course) => {
      let assigned = 0;
      let courseCompleted = 0;

      Object.values(assignments).forEach((userAssignments) => {
        if (userAssignments?.[course.id]?.assigned) assigned += 1;
      });

      Object.values(completedCourses).forEach((userCourses) => {
        if (userCourses?.[course.id]) courseCompleted += 1;
      });

      const progress = assigned > 0 ? Math.min(Math.round((courseCompleted / assigned) * 100), 100) : 0;

      return {
        id: course.id,
        title: course.title || course.name || "Untitled Course",
        assigned,
        completed: courseCompleted,
        progress,
      };
    });
  }, [coursesData, assignments, completedCourses]);

  const recentActivity = useMemo(
    () =>
      attempts
        .filter((att) => {
          const uid = String(att.userId || "");
          if (!uid) return true;
          return learnerIds.has(uid);
        })
        .slice(0, 5),
    [attempts, learnerIds]
  );

  if (loading) {
    return (
      <div className="admin-loading-box">
        <h2>Loading dashboard...</h2>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-page">
      <section className="admin-hero">
        <div className="hero-content">
          <span className="hero-badge">Admin Overview</span>
          <h1>Training Dashboard</h1>
          <p>Course-wise overview of users, assignments, completions and certificates.</p>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <strong>{learners.length}</strong>
                <span>Users</span>
              </div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-icon admins-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </div>
              <div>
                <strong>{departmentAdmins.length}</strong>
                <span>Dept Admins</span>
              </div>
            </div>
          </div>
        </div>
        <div className="hero-decoration">
          <div className="hero-circle-1"></div>
          <div className="hero-circle-2"></div>
        </div>
      </section>

      <section className="admin-stat-cards">
        <div className="stat-card stat-users">
          <div className="stat-card-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Total Users</span>
            <strong>{learners.length}</strong>
          </div>
        </div>

        <div className="stat-card stat-dept-admins">
          <div className="stat-card-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Dept Admins</span>
            <strong>{departmentAdmins.length}</strong>
          </div>
        </div>

        <div className="stat-card stat-assigned">
          <div className="stat-card-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Assigned</span>
            <strong>{totalAssigned}</strong>
          </div>
        </div>

        <div className="stat-card stat-pending">
          <div className="stat-card-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Pending</span>
            <strong>{pendingCourses}</strong>
          </div>
        </div>

        <div className="stat-card stat-completed">
          <div className="stat-card-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Completed</span>
            <strong>{totalCompleted}</strong>
          </div>
        </div>

        <div className="stat-card stat-rate">
          <div className="stat-card-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
          </div>
          <div className="stat-card-info">
            <span>Completion</span>
            <strong>{completionRate}%</strong>
          </div>
        </div>
      </section>

      <section className="admin-main-grid">
        <div className="admin-panel progress-panel">
          <div className="admin-panel-head">
            <span>Progress</span>
            <h2>Overall Training Status</h2>
          </div>

          <div className="progress-donut-wrap">
            <svg className="progress-donut" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#e8f5ee" strokeWidth="12" />
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke="#22c55e"
                strokeWidth="12"
                strokeDasharray={`${safeRate * 3.14} ${314 - safeRate * 3.14}`}
                strokeDashoffset="78.5"
                strokeLinecap="round"
              />
            </svg>
            <div className="progress-donut-center">
              <strong>{completionRate}%</strong>
            </div>
          </div>

          <p>{totalCompleted} of {totalAssigned} assigned courses completed.</p>

          <div className="mini-stats">
            <div>
              <span>Completed</span>
              <strong>{totalCompleted}</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong>{pendingCourses}</strong>
            </div>
            <div>
              <span>Certificates</span>
              <strong>{totalCerts}</strong>
            </div>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <span>Attention</span>
            <h2>Users Needing Follow-up</h2>
          </div>

          <div className="admin-user-list">
            {usersNeedingAttention.length === 0 ? (
              <p className="admin-empty-text">No pending user follow-up found.</p>
            ) : (
              usersNeedingAttention.map((user) => (
                <div className="admin-user-row" key={user.id}>
                  <div>
                    <strong>{user.name || "Unnamed User"}</strong>
                    <span>{user.designation || "User"} &bull; Pending {user.pending}</span>
                  </div>
                  <b>{user.completion}%</b>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="admin-gradient-cards">
        <div className="gradient-card gradient-yellow">
          <div className="gradient-card-content">
            <strong>{totalCompleted}+</strong>
            <span>Completed Courses</span>
            <p>Finished by users</p>
          </div>
          <div className="gradient-card-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
        </div>

        <div className="gradient-card gradient-red">
          <div className="gradient-card-content">
            <strong>{totalCerts}+</strong>
            <span>Certificates Earned</span>
            <p>Passed assessments</p>
          </div>
          <div className="gradient-card-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
          </div>
        </div>
      </section>

      <section className="admin-bottom-grid">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <span>Courses</span>
            <h2>Course-wise Progress</h2>
          </div>

          <div className="course-list">
            {courseWiseProgress.length === 0 ? (
              <p className="admin-empty-text">No course data available yet.</p>
            ) : (
              courseWiseProgress.map((course, i) => {
                const colors = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"];
                const letter = course.title?.charAt(0)?.toUpperCase() || "C";
                return (
                  <div className="course-row" key={course.id}>
                    <div className="course-avatar" style={{ background: colors[i % colors.length] }}>
                      {letter}
                    </div>
                    <div className="course-info">
                      <h3>{course.title}</h3>
                      <span>{course.assigned} Assigned &bull; {course.completed} Done</span>
                    </div>
                    <div className="course-progress-wrap">
                      <div className="course-progress-bar">
                        <span style={{ width: `${course.progress}%` }}></span>
                      </div>
                      <strong>{course.progress}%</strong>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <span>Departments</span>
            <h2>Department-wise Status</h2>
          </div>

          {departmentSummary.length === 0 ? (
            <p className="admin-empty-text">No departments created yet.</p>
          ) : (
            departmentSummary.map((dept, index) => (
              <div className="dept-row" key={dept.id}>
                <div>
                  <span>{index + 1}. {dept.deptName || "-"}</span>
                  <strong>{dept.completion}%</strong>
                </div>
                <div className="dept-track">
                  <span style={{ width: `${dept.completion}%` }}></span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <span>Activity</span>
            <h2>Recent Course Attempts</h2>
          </div>

          <div className="admin-user-list">
            {recentActivity.length === 0 ? (
              <p className="admin-empty-text">No recent attempts found.</p>
            ) : (
              recentActivity.map((attempt) => (
                <div className="admin-user-row" key={attempt.id}>
                  <div>
                    <strong>{attempt.userName || "Unnamed User"}</strong>
                    <span>{attempt.courseTitle || attempt.courseName || attempt.videoTitle || "Untitled Course"}</span>
                  </div>
                  <b className={attempt.passed ? "pass-text" : "fail-text"}>
                    {attempt.passed ? "Passed" : "Failed"}
                  </b>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;
