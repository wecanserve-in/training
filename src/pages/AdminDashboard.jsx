import { useEffect, useMemo, useState } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "../firebase";
import "../styles/admindashboard.css";

function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [completedCourses, setCompletedCourses] = useState({});
  const [results, setResults] = useState({});
  const [userAssignments, setUserAssignments] = useState({});
  const [oldAssignments, setOldAssignments] = useState({});
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
      if (loadedPaths.size === 8) {
        setLoading(false);
      }
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

    const unsubUsers = watchPath("users", (snapshot) => {
      setUsers(snapshot.exists() ? objectToArray(snapshot.val()) : []);
    });

    const unsubDepartments = watchPath("departments", (snapshot) => {
      setDepartments(snapshot.exists() ? objectToArray(snapshot.val()) : []);
    });

    const unsubCourses = watchPath("courses", (snapshot) => {
      setCourses(snapshot.exists() ? objectToArray(snapshot.val()) : []);
    });

    const unsubCompletedCourses = watchPath("completedCourses", (snapshot) => {
      setCompletedCourses(snapshot.exists() ? snapshot.val() : {});
    });

    const unsubResults = watchPath("results", (snapshot) => {
      setResults(snapshot.exists() ? snapshot.val() : {});
    });

    const unsubUserAssignments = watchPath("userAssignments", (snapshot) => {
      setUserAssignments(snapshot.exists() ? snapshot.val() : {});
    });

    const unsubOldAssignments = watchPath("assignments", (snapshot) => {
      setOldAssignments(snapshot.exists() ? snapshot.val() : {});
    });

    const unsubAttempts = watchPath("attempts", (snapshot) => {
      const list = snapshot.exists() ? objectToArray(snapshot.val()) : [];

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
      unsubCourses();
      unsubCompletedCourses();
      unsubResults();
      unsubUserAssignments();
      unsubOldAssignments();
      unsubAttempts();
    };
  }, []);

  const getRole = (user) => {
    return String(user?.role || "").trim().toLowerCase();
  };

  const learners = useMemo(() => {
    return users.filter((user) => getRole(user) === "user");
  }, [users]);

  const departmentAdmins = useMemo(() => {
    return users.filter((user) => {
      const role = getRole(user);
      return (
        role === "departmentadmin" ||
        role === "department admin" ||
        role === "department_admin" ||
        role === "deptadmin" ||
        role === "dept admin"
      );
    });
  }, [users]);

  const assignments = useMemo(() => {
    const merged = {};

    const addAssignments = (source) => {
      if (!source || typeof source !== "object") return;

      Object.entries(source).forEach(([userId, assignedData]) => {
        if (!merged[userId]) {
          merged[userId] = {};
        }

        if (Array.isArray(assignedData)) {
          assignedData.forEach((courseId) => {
            if (courseId) {
              merged[userId][courseId] = true;
            }
          });
          return;
        }

        if (assignedData && typeof assignedData === "object") {
          merged[userId] = {
            ...merged[userId],
            ...assignedData,
          };
        }
      });
    };

    addAssignments(oldAssignments);
    addAssignments(userAssignments);

    return merged;
  }, [oldAssignments, userAssignments]);

  const learnerIds = useMemo(() => {
    return new Set(learners.map((user) => String(user.id)));
  }, [learners]);

  const countValidItems = (data) => {
    if (!data) return 0;

    if (Array.isArray(data)) {
      return data.filter(Boolean).length;
    }

    if (typeof data !== "object") return 0;

    return Object.values(data).filter(
      (value) => value !== false && value !== null && value !== undefined
    ).length;
  };

  const getAssignedCourseCount = (userId) => {
    return countValidItems(assignments?.[userId]);
  };

  const getCompletedCourseCount = (userId) => {
    return countValidItems(completedCourses?.[userId]);
  };

  const getCertificateCount = (userId) => {
    const userResults = results?.[userId];

    if (!userResults || typeof userResults !== "object") return 0;

    return Object.values(userResults).filter((result) => {
      if (result === true) return true;

      if (!result || typeof result !== "object") return false;

      return (
        result.passed === true ||
        result.isPassed === true ||
        String(result.status || "").toLowerCase() === "passed"
      );
    }).length;
  };

  const totalAssignedCourses = useMemo(() => {
    return learners.reduce(
      (total, user) => total + getAssignedCourseCount(user.id),
      0
    );
  }, [learners, assignments]);

  const totalCompletedCourses = useMemo(() => {
    return learners.reduce(
      (total, user) => total + getCompletedCourseCount(user.id),
      0
    );
  }, [learners, completedCourses]);

  const totalCertificates = useMemo(() => {
    return learners.reduce(
      (total, user) => total + getCertificateCount(user.id),
      0
    );
  }, [learners, results]);

  const pendingCourses = Math.max(
    totalAssignedCourses - totalCompletedCourses,
    0
  );

  const completionRate =
    totalAssignedCourses > 0
      ? Math.round((totalCompletedCourses / totalAssignedCourses) * 100)
      : 0;

  const safeCompletionRate = Math.min(Math.max(completionRate, 0), 100);
  const progressDegrees = safeCompletionRate * 3.6;

  const usersNeedingAttention = useMemo(() => {
    return learners
      .map((user) => {
        const assigned = getAssignedCourseCount(user.id);
        const completed = getCompletedCourseCount(user.id);

        return {
          ...user,
          assigned,
          completed,
          pending: Math.max(assigned - completed, 0),
          completion:
            assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
        };
      })
      .filter((user) => user.assigned > 0 && user.completion < 100)
      .sort((a, b) => b.pending - a.pending)
      .slice(0, 6);
  }, [learners, assignments, completedCourses]);

  const departmentSummary = useMemo(() => {
    return departments.slice(0, 6).map((dept) => {
      const deptName = dept.departmentName || dept.name || dept.title || "";

      const deptUsers = learners.filter(
        (user) =>
          String(user.department || "").trim().toLowerCase() ===
          String(deptName).trim().toLowerCase()
      );

      const assigned = deptUsers.reduce(
        (total, user) => total + getAssignedCourseCount(user.id),
        0
      );

      const completed = deptUsers.reduce(
        (total, user) => total + getCompletedCourseCount(user.id),
        0
      );

      return {
        ...dept,
        deptName,
        users: deptUsers.length,
        assigned,
        completed,
        completion: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
      };
    });
  }, [departments, learners, assignments, completedCourses]);

  const recentActivity = useMemo(() => {
    return attempts
      .filter((attempt) => {
        const attemptUserId = String(
          attempt.userId ||
            attempt.uid ||
            attempt.employeeId ||
            attempt.learnerId ||
            ""
        );

        if (!attemptUserId) return true;

        return learnerIds.has(attemptUserId);
      })
      .slice(0, 6);
  }, [attempts, learnerIds]);

  if (loading) {
    return (
      <div className="admin-loading-box">
        <h2>Loading dashboard...</h2>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-page">
      <div className="admin-topbar">
        <div>
          <span>Admin Overview</span>
          <h1>Training Dashboard</h1>
          <p>
            Course-wise overview of normal users, assignments, completions and
            certificates.
          </p>
        </div>

        <img src="/Logo.webp" alt="Logo" />
      </div>

      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <span>Total Users</span>
          <h2>{learners.length}</h2>
          <p>Only role user counted</p>
        </div>

        <div className="admin-kpi-card">
          <span>Department Admins</span>
          <h2>{departmentAdmins.length}</h2>
          <p>Not included in user stats</p>
        </div>

        <div className="admin-kpi-card">
          <span>Active Courses</span>
          <h2>{courses.length}</h2>
          <p>Created training courses</p>
        </div>

        <div className="admin-kpi-card">
          <span>Assigned Courses</span>
          <h2>{totalAssignedCourses}</h2>
          <p>Assigned only to users</p>
        </div>

        <div className="admin-kpi-card danger">
          <span>Pending Courses</span>
          <h2>{pendingCourses}</h2>
          <p>Yet to be completed</p>
        </div>

        <div className="admin-kpi-card primary">
          <span>Completion Rate</span>
          <h2>{completionRate}%</h2>
          <p>User course completion</p>
        </div>
      </div>

      <div className="admin-main-grid no-actions">
        <div className="admin-panel progress-panel">
          <div className="admin-panel-head">
            <span>Progress</span>
            <h2>Overall Training Status</h2>
          </div>

          <div
            className="progress-circle"
            style={{
              background: `conic-gradient(
                #4285f4 0deg ${progressDegrees}deg,
                #e8f0fe ${progressDegrees}deg 360deg
              )`,
            }}
          >
            <div>{completionRate}%</div>
          </div>

          <p>
            {totalCompletedCourses} of {totalAssignedCourses} assigned courses
            completed.
          </p>

          <div className="mini-stats">
            <div>
              <span>Completed</span>
              <strong>{totalCompletedCourses}</strong>
            </div>

            <div>
              <span>Pending</span>
              <strong>{pendingCourses}</strong>
            </div>

            <div>
              <span>Certificates</span>
              <strong>{totalCertificates}</strong>
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
                    <span>
                      {user.designation || "User"} • Pending {user.pending}
                    </span>
                  </div>

                  <b>{user.completion}%</b>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="admin-bottom-grid">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <span>Departments</span>
            <h2>Department-wise Course Status</h2>
          </div>

          <div className="admin-user-list">
            {departmentSummary.length === 0 ? (
              <p className="admin-empty-text">No departments created yet.</p>
            ) : (
              departmentSummary.map((dept) => (
                <div className="admin-user-row dept-row" key={dept.id}>
                  <div>
                    <strong>{dept.deptName || "-"}</strong>
                    <span>
                      Users {dept.users} • Assigned {dept.assigned} • Completed{" "}
                      {dept.completed}
                    </span>
                  </div>

                  <b>{dept.completion}%</b>
                </div>
              ))
            )}
          </div>
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
                    <span>
                      {attempt.courseTitle ||
                        attempt.courseName ||
                        attempt.videoTitle ||
                        "Untitled Course"}
                    </span>
                  </div>

                  <b className={attempt.passed ? "pass-text" : "fail-text"}>
                    {attempt.passed ? "Passed" : "Failed"}
                  </b>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;