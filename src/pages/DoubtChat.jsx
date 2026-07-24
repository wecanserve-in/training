import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { useNavigate } from "react-router-dom";
import { auth, database } from "../firebase";
import {
  watchThreads,
  createDoubtThread,
  deleteDoubtThread,
  notifyAdminsOfNewDoubt,
  markThreadRead,
} from "../services/doubtService";
import useBasePath from "../hooks/useBasePath";
import "../styles/doubtchat.css";

function DoubtChat() {
  const navigate = useNavigate();
  const basePath = useBasePath();

  const [userData, setUserData] = useState(null);
  const [threads, setThreads] = useState([]);
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newCourseId, setNewCourseId] = useState("");
  const [creating, setCreating] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const snap = await get(ref(database, `users/${user.uid}`));
        const profile = snap.exists()
          ? { id: user.uid, ...snap.val() }
          : { id: user.uid, email: user.email };

        const rawRole = String(profile.role || "")
          .toLowerCase()
          .replace(/[\s_-]/g, "");

        let departmentId = profile.departmentId || "";
        let departmentName = profile.department || "";

        if (rawRole === "departmentadmin") {
          const deptSnap = await get(ref(database, "departments"));
          if (deptSnap.exists()) {
            const match = Object.entries(deptSnap.val()).find(
              ([, d]) => d.departmentAdminId === user.uid
            );
            if (match) {
              departmentId = departmentId || match[0];
              departmentName =
                departmentName || match[1].departmentName || "";
            }
          }
        }

        setUserData({ ...profile, departmentId, departmentName });

        const [coursesSnap, deptSnap] = await Promise.all([
          get(ref(database, "courses")),
          get(ref(database, "departments")),
        ]);

        if (coursesSnap.exists()) {
          const allCourses = Object.entries(coursesSnap.val()).map(
            ([id, c]) => ({ id, ...c })
          );
          const visibleCourses = allCourses.filter((c) => {
            if (rawRole === "superadmin" || rawRole === "admin")
              return true;
            if (c.createdBy === user.uid) return true;
            if (
              departmentId &&
              String(c.departmentId || "").trim() ===
                String(departmentId).trim()
            )
              return true;
            if (
              departmentName &&
              String(c.department || "")
                .trim()
                .toLowerCase() ===
                String(departmentName).trim().toLowerCase()
            )
              return true;
            return false;
          });
          setCourses(visibleCourses);
        }

        if (deptSnap.exists()) {
          setDepartments(
            Object.entries(deptSnap.val()).map(([id, d]) => ({
              id,
              ...d,
            }))
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userData) return;
    const unsub = watchThreads(setThreads);
    return () => unsub();
  }, [userData]);

  const rawRole = String(userData?.role || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  const isSuperAdmin = rawRole === "superadmin";
  const isAdmin = rawRole === "admin";
  const isDeptAdmin = rawRole === "departmentadmin";
  const canSeeAll = isSuperAdmin || isAdmin;
  const canDeleteThread = isSuperAdmin || isAdmin || isDeptAdmin;

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (!canSeeAll) {
        if (isDeptAdmin) {
          const tDeptId = String(t.departmentId || "").trim();
          const myDeptId = String(userData?.departmentId || "").trim();
          const tDept = String(t.departmentName || "").trim().toLowerCase();
          const myDept = String(userData?.departmentName || "").trim().toLowerCase();

          if (
            tDeptId &&
            myDeptId &&
            tDeptId === myDeptId
          ) {
            // match
          } else if (
            tDept &&
            myDept &&
            tDept === myDept
          ) {
            // match
          } else if (t.createdBy === userData?.id) {
            // user's own thread
          } else {
            return false;
          }
        } else {
          if (t.createdBy !== userData?.id) return false;
        }
      }

      if (statusFilter && t.status !== statusFilter) return false;

      if (deptFilter) {
        const tDeptId = String(t.departmentId || "").trim();
        if (tDeptId !== deptFilter) return false;
      }

      if (courseFilter && t.courseId !== courseFilter) return false;

      if (search) {
        const text = [
          t.subject,
          t.createdByName,
          t.lastMessage,
          t.courseTitle,
          t.departmentName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!text.includes(search.toLowerCase())) return false;
      }

      return true;
    });
  }, [
    threads,
    userData,
    canSeeAll,
    isDeptAdmin,
    search,
    statusFilter,
    deptFilter,
    courseFilter,
  ]);

  const handleDeleteThread = async (e, threadId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this chat and all its messages? This cannot be undone.")) return;
    try {
      await deleteDoubtThread(threadId);
    } catch (err) {
      console.error(err);
      alert("Failed to delete chat.");
    }
  };

  const handleCreate = async () => {
    if (!newSubject.trim() || !newMessage.trim()) {
      alert("Subject and message are required.");
      return;
    }
    setCreating(true);
    try {
      const selectedCourse = courses.find((c) => c.id === newCourseId);

      const threadData = {
        createdBy: userData.id,
        createdByName: userData.name || userData.email || "User",
        createdByRole: rawRole,
        departmentId: userData.departmentId || "",
        departmentName: userData.departmentName || "",
        courseId: newCourseId,
        courseTitle: selectedCourse
          ? selectedCourse.title || selectedCourse.courseTitle || ""
          : "",
        subject: newSubject.trim(),
      };

      const threadId = await createDoubtThread(threadData);

      const { sendDoubtMessage } = await import(
        "../services/doubtService"
      );
      await sendDoubtMessage(threadId, {
        senderId: userData.id,
        senderName: userData.name || userData.email || "User",
        senderRole: rawRole,
        departmentId: userData.departmentId || "",
        message: newMessage.trim(),
        currentUnreadCount: 0,
      });

      const fullThread = {
        threadId,
        ...threadData,
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessage: newMessage.trim(),
        lastMessageBy: userData.name || userData.email || "User",
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
      };

      await notifyAdminsOfNewDoubt(fullThread);

      setShowCreate(false);
      setNewSubject("");
      setNewMessage("");
      setNewCourseId("");
      navigate(`${basePath}/doubts/${threadId}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create chat.");
    } finally {
      setCreating(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  };

  const formatRole = (role) => {
    const r = String(role || "")
      .toLowerCase()
      .replace(/[\s_-]/g, "");
    if (r === "superadmin") return "Super Admin";
    if (r === "admin") return "Admin";
    if (r === "departmentadmin") return "Dept Admin";
    return "User";
  };

  if (loading) {
    return (
      <div className="doubt-page">
        <div className="doubt-loading">Loading chats...</div>
      </div>
    );
  }

  return (
    <div className="doubt-page">
      <div className="doubt-header">
        <div>
          <h1>Chat with others</h1>
          <p>
            {canSeeAll
              ? "Manage chats from all users."
              : isDeptAdmin
              ? "Chats from your department."
              : "Your chat threads."}
          </p>
        </div>
        <button
          className="doubt-new-btn"
          onClick={() => setShowCreate(true)}
        >
          + New Chat
        </button>
      </div>

      <div className="doubt-filters">
        <input
          type="text"
          placeholder="Search chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
        {canSeeAll && (
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.departmentName || d.name || d.id}
              </option>
            ))}
          </select>
        )}
        {canSeeAll && (
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title || c.courseTitle || c.id}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="doubt-thread-list">
        {filteredThreads.length === 0 ? (
          <div className="doubt-empty">
            No chats found.
          </div>
        ) : (
          filteredThreads.map((thread) => (
            <div
              key={thread.threadId}
              className={`doubt-thread-card ${thread.unreadCount > 0 ? "unread" : ""}`}
              onClick={() => {
                markThreadRead(thread.threadId);
                navigate(`${basePath}/doubts/${thread.threadId}`);
              }}
            >
              <div className="doubt-thread-left">
                <div className="doubt-thread-avatar">
                  {(thread.createdByName || "U")
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="doubt-thread-info">
                  <div className="doubt-thread-top">
                    <h3>{thread.subject}</h3>
                    {thread.unreadCount > 0 && (
                      <span className="doubt-unread-badge">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="doubt-thread-preview">
                    <strong>{thread.lastMessageBy}:</strong>{" "}
                    {thread.lastMessage || "No messages yet"}
                  </p>
                  <div className="doubt-thread-meta">
                    <span>{formatRole(thread.createdByRole)}</span>
                    {thread.courseTitle && (
                      <span>• {thread.courseTitle}</span>
                    )}
                    {thread.departmentName && (
                      <span>• {thread.departmentName}</span>
                    )}
                    <span>• {formatTime(thread.updatedAt)}</span>
                  </div>
                </div>
              </div>
              <div className="doubt-thread-right">
                <span
                  className={`doubt-status-badge ${thread.status}`}
                >
                  {thread.status === "open"
                    ? "Open"
                    : thread.status === "in_progress"
                    ? "In Progress"
                    : "Resolved"}
                </span>
                {canDeleteThread && (
                  <button
                    className="doubt-delete-btn"
                    title="Delete chat"
                    onClick={(e) => handleDeleteThread(e, thread.threadId)}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <div className="doubt-modal-backdrop">
          <div className="doubt-modal">
            <div className="doubt-modal-header">
              <h2>Chat with others</h2>
              <button
                className="doubt-modal-close"
                onClick={() => setShowCreate(false)}
              >
                ×
              </button>
            </div>
            <div className="doubt-modal-body">
              <label>Subject</label>
              <input
                type="text"
                placeholder="Brief subject"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
              <label>Course (optional)</label>
              <select
                value={newCourseId}
                onChange={(e) => setNewCourseId(e.target.value)}
              >
                <option value="">No specific course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title || c.courseTitle || c.id}
                  </option>
                ))}
              </select>
              <label>Message</label>
              <textarea
                rows={5}
                placeholder="Describe your question in detail..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
            </div>
            <div className="doubt-modal-footer">
              <button
                className="doubt-cancel-btn"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                className="doubt-submit-btn"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DoubtChat;
