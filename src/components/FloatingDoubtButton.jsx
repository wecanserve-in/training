import { useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useParams,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, database } from "../firebase";
import {
  coursePath,
  videoPath,
  courseVideosForCoursePath,
} from "../services/dbPaths";
import {
  watchThreads,
  createDoubtThread,
  sendDoubtMessage,
  notifyAdminsOfNewDoubt,
  markThreadRead,
} from "../services/doubtService";
import useBasePath from "../hooks/useBasePath";
import "../styles/floatingDoubtButton.css";

function FloatingDoubtButton() {
  const navigate = useNavigate();
  const basePath = useBasePath();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("list");
  const [userData, setUserData] = useState(null);
  const [threads, setThreads] = useState([]);
  const [courses, setCourses] = useState([]);
  const [videos, setVideos] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [selectedCourseTitle, setSelectedCourseTitle] = useState("");
  const [selectedVideoTitle, setSelectedVideoTitle] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [threadSearch, setThreadSearch] = useState("");

  const { courseId: cId, videoId: vId, id } = useParams();
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();

  const isCoursePage =
    /\/course\/(?!.*\/video\/)/.test(pathname) ||
    pathname.includes("/course-overview/");
  const isCourseVideoPage =
    pathname.includes("/course/") && pathname.includes("/video/");
  const isQuizPage = pathname.includes("/quiz/");

  const shouldShowButton = isCoursePage || isCourseVideoPage || isQuizPage;

  let detectedCourseId = null;
  let detectedVideoId = null;

  if (isCourseVideoPage && cId) {
    detectedCourseId = cId;
    detectedVideoId = vId || null;
  } else if (isCoursePage && id) {
    detectedCourseId = id;
  } else if (pathname.includes("/course-overview/") && id) {
    detectedCourseId = id;
  } else if (isQuizPage) {
    const isVideoQuiz = searchParams.get("type") === "video";
    if (isVideoQuiz) {
      detectedCourseId = searchParams.get("courseId") || id || null;
      detectedVideoId = searchParams.get("videoId") || null;
    } else {
      detectedCourseId = id || null;
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserData(null);
        return;
      }
      try {
        const snap = await get(ref(database, `users/${user.uid}`));
        setUserData(
          snap.exists()
            ? { id: user.uid, email: user.email || "", ...snap.val() }
            : {
                id: user.uid,
                email: user.email || "",
                name: user.displayName || "",
                role: "user",
              }
        );
      } catch {
        setUserData(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userData) return;
    const unsub = watchThreads(setThreads);
    return () => unsub();
  }, [userData]);

  useEffect(() => {
    if (!open) return;
    get(ref(database, "courses")).then((snap) => {
      if (snap.exists()) {
        setCourses(
          Object.entries(snap.val()).map(([id, c]) => ({
            id,
            ...c,
          }))
        );
      }
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setView("list");
    setThreadSearch("");
    setSelectedCourseId("");
    setSelectedVideoId("");
    setSelectedCourseTitle("");
    setSelectedVideoTitle("");
    setTitle("");
    setMessage("");
  }, [open]);

  useEffect(() => {
    if (detectedCourseId) {
      setSelectedCourseId(detectedCourseId);
      get(ref(database, coursePath(detectedCourseId))).then((snap) => {
        if (snap.exists()) {
          setSelectedCourseTitle(
            snap.val().title || snap.val().courseTitle || ""
          );
        }
      });
    }
    if (detectedVideoId) {
      setSelectedVideoId(detectedVideoId);
      get(ref(database, videoPath(detectedVideoId))).then((snap) => {
        if (snap.exists()) setSelectedVideoTitle(snap.val().title || "");
      });
    }
  }, [open, detectedCourseId, detectedVideoId]);

  useEffect(() => {
    if (!open) {
      setVideos([]);
      return;
    }
    if (selectedCourseId && selectedCourseId !== "none") {
      get(ref(database, courseVideosForCoursePath(selectedCourseId))).then(
        (snap) => {
          if (snap.exists()) {
            const videoList = Object.entries(snap.val()).map(
              ([mappingId, v]) => ({
                id: v.videoId,
                title: v.videoTitle || v.title || v.videoId,
                mappingId,
                ...v,
              })
            );
            setVideos(videoList);
          } else {
            setVideos([]);
          }
        }
      );
    } else {
      setVideos([]);
    }
  }, [open, selectedCourseId]);

  const rawRole = String(userData?.role || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  const isSuperAdmin = rawRole === "superadmin";
  const isAdmin = rawRole === "admin";
  const isDeptAdmin = rawRole === "departmentadmin";
  const canSeeAll = isSuperAdmin || isAdmin;

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (detectedCourseId && t.courseId && t.courseId !== detectedCourseId) {
        return false;
      }

      if (!canSeeAll) {
        if (isDeptAdmin) {
          const tDeptId = String(t.departmentId || "").trim();
          const myDeptId = String(userData?.departmentId || "").trim();
          const tDept = String(t.departmentName || "")
            .trim()
            .toLowerCase();
          const myDept = String(userData?.departmentName || "")
            .trim()
            .toLowerCase();

          const deptMatch =
            (tDeptId && myDeptId && tDeptId === myDeptId) ||
            (tDept && myDept && tDept === myDept);
          const ownThread = t.createdBy === userData?.id;

          if (!deptMatch && !ownThread) return false;
        } else {
          if (t.createdBy !== userData?.id) return false;
        }
      }

      if (threadSearch) {
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
        if (!text.includes(threadSearch.toLowerCase())) return false;
      }

      return true;
    });
  }, [threads, userData, canSeeAll, isDeptAdmin, threadSearch, detectedCourseId]);

  const handleCourseChange = (value) => {
    setSelectedCourseId(value);
    setSelectedVideoId("");
    setSelectedVideoTitle("");
    if (value && value !== "none") {
      const course = courses.find((c) => c.id === value);
      setSelectedCourseTitle(
        course ? course.title || course.courseTitle || "" : ""
      );
    } else {
      setSelectedCourseTitle("");
    }
  };

  const handleVideoChange = (value) => {
    setSelectedVideoId(value);
    if (value && value !== "none") {
      const video = videos.find((v) => v.id === value);
      setSelectedVideoTitle(video ? video.title : "");
    } else {
      setSelectedVideoTitle("");
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) {
      alert("Title and question are required.");
      return;
    }
    if (!userData) {
      alert("Please log in to start a chat.");
      return;
    }
    setSubmitting(true);
    try {
      const finalCourseId =
        selectedCourseId && selectedCourseId !== "none"
          ? selectedCourseId
          : "";
      const finalCourseTitle =
        selectedCourseId && selectedCourseId !== "none"
          ? selectedCourseTitle
          : "";

      const threadData = {
        createdBy: userData.id,
        createdByName: userData.name || userData.email || "User",
        createdByRole: rawRole,
        departmentId: userData.departmentId || "",
        departmentName: userData.department || "",
        courseId: finalCourseId,
        courseTitle: finalCourseTitle,
        subject: title.trim(),
      };

      const threadId = await createDoubtThread(threadData);

      await sendDoubtMessage(threadId, {
        senderId: userData.id,
        senderName: userData.name || userData.email || "User",
        senderRole: rawRole,
        departmentId: userData.departmentId || "",
        message: message.trim(),
        currentUnreadCount: 0,
      });

      const fullThread = {
        threadId,
        ...threadData,
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessage: message.trim(),
        lastMessageBy: userData.name || userData.email || "User",
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
      };

      await notifyAdminsOfNewDoubt(fullThread);

      setOpen(false);
      navigate(`${basePath}/doubts/${threadId}`);
    } catch (err) {
      console.error(err);
      alert("Failed to submit chat.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleThreadClick = (thread) => {
    markThreadRead(thread.threadId);
    setOpen(false);
    navigate(`${basePath}/doubts/${thread.threadId}`);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHrs < 24) return `${diffHrs}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
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

  const showVideoField = videos.length > 0;

  return (
    <>
      {shouldShowButton && (
        <button
          type="button"
          className="fab-doubt-btn"
          onClick={() => setOpen(true)}
          title="Chat with others"
          aria-label="Chat with others"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>

          <span>Chat with others</span>
        </button>
      )}

      {open && (
        <div className="fab-doubt-backdrop" onClick={() => setOpen(false)}>
          <div
            className="fab-doubt-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fab-doubt-drawer-header">
              {view === "list" ? (
                <>
                  <h3>Chats</h3>
                  <div className="fab-doubt-header-actions">
                    <button
                      className="fab-doubt-new-chat-btn"
                      onClick={() => setView("create")}
                    >
                      + New
                    </button>
                    <button
                      className="fab-doubt-drawer-close"
                      onClick={() => setOpen(false)}
                    >
                      ×
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    className="fab-doubt-back-btn"
                    onClick={() => setView("list")}
                  >
                    ←
                  </button>
                  <h3>New Chat</h3>
                  <button
                    className="fab-doubt-drawer-close"
                    onClick={() => setOpen(false)}
                  >
                    ×
                  </button>
                </>
              )}
            </div>

            {view === "list" ? (
              <div className="fab-doubt-drawer-body fab-thread-list-body">
                <input
                  type="text"
                  className="fab-thread-search"
                  placeholder="Search chats..."
                  value={threadSearch}
                  onChange={(e) => setThreadSearch(e.target.value)}
                />

                <div className="fab-thread-list">
                  {filteredThreads.length === 0 ? (
                    <div className="fab-thread-empty">
                      <div className="fab-thread-empty-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                      <p>No chats for this course yet</p>
                      <button
                        className="fab-thread-empty-btn"
                        onClick={() => setView("create")}
                      >
                        Start a chat
                      </button>
                    </div>
                  ) : (
                    filteredThreads.map((thread) => (
                      <div
                        key={thread.threadId}
                        className={`fab-thread-card ${thread.unreadCount > 0 ? "unread" : ""}`}
                        onClick={() => handleThreadClick(thread)}
                      >
                        <div className="fab-thread-avatar">
                          {(thread.createdByName || "U")
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="fab-thread-info">
                          <div className="fab-thread-top">
                            <span className="fab-thread-subject">
                              {thread.subject}
                            </span>
                            <span className="fab-thread-time">
                              {formatTime(thread.updatedAt)}
                            </span>
                          </div>
                          <p className="fab-thread-preview">
                            <strong>{thread.lastMessageBy}:</strong>{" "}
                            {thread.lastMessage || "No messages yet"}
                          </p>
                          <div className="fab-thread-meta">
                            <span className={`fab-thread-status ${thread.status}`}>
                              {thread.status === "open"
                                ? "Open"
                                : thread.status === "in_progress"
                                ? "In Progress"
                                : "Resolved"}
                            </span>
                            {thread.courseTitle && (
                              <span className="fab-thread-course">
                                {thread.courseTitle}
                              </span>
                            )}
                          </div>
                        </div>
                        {thread.unreadCount > 0 && (
                          <span className="fab-thread-unread">
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="fab-doubt-drawer-body fab-create-body">
                <label>Title</label>
                <input
                  type="text"
                  placeholder="Brief title for your question"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                <label>Course</label>
                <select
                  value={selectedCourseId || "none"}
                  onChange={(e) => handleCourseChange(e.target.value)}
                >
                  <option value="none">No specific course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title || c.courseTitle || c.id}
                    </option>
                  ))}
                </select>

                {showVideoField && (
                  <>
                    <label>Video</label>
                    <select
                      value={selectedVideoId || "none"}
                      onChange={(e) => handleVideoChange(e.target.value)}
                    >
                      <option value="none">No specific video</option>
                      {videos.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.title}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                <label>Your Question</label>
                <textarea
                  rows={5}
                  placeholder="Describe your question in detail..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            )}

            {view === "create" && (
              <div className="fab-doubt-drawer-footer">
                <button
                  className="fab-doubt-cancel-btn"
                  onClick={() => setView("list")}
                >
                  Cancel
                </button>
                <button
                  className="fab-doubt-submit-btn"
                  onClick={handleSubmit}
                  disabled={submitting || !title.trim() || !message.trim()}
                >
                  {submitting ? "Sending..." : "Send"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default FloatingDoubtButton;
