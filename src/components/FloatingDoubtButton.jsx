import { useEffect, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, database } from "../firebase";
import {
  coursePath,
  videoPath,
  courseVideosForCoursePath,
} from "../services/dbPaths";
import {
  createDoubtThread,
  sendDoubtMessage,
  notifyAdminsOfNewDoubt,
} from "../services/doubtService";
import "../styles/floatingDoubtButton.css";

function FloatingDoubtButton() {
  const [open, setOpen] = useState(false);
  const [userData, setUserData] = useState(null);
  const [courses, setCourses] = useState([]);
  const [videos, setVideos] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [selectedCourseTitle, setSelectedCourseTitle] = useState("");
  const [selectedVideoTitle, setSelectedVideoTitle] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { courseId: cId, videoId: vId, id } = useParams();
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();

  const isCoursePage = /\/course\/(?!.*\/video\/)/.test(pathname) || pathname.includes("/course-overview/");
  const isCourseVideoPage = pathname.includes("/course/") && pathname.includes("/video/");
  const isQuizPage = pathname.includes("/quiz/");

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
          setSelectedCourseTitle(snap.val().title || snap.val().courseTitle || "");
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
    if (!open) { setVideos([]); return; }
    if (selectedCourseId && selectedCourseId !== "none") {
      get(ref(database, courseVideosForCoursePath(selectedCourseId))).then((snap) => {
        if (snap.exists()) {
          const videoList = Object.entries(snap.val()).map(([mappingId, v]) => ({
            id: v.videoId,
            title: v.videoTitle || v.title || v.videoId,
            mappingId,
            ...v,
          }));
          setVideos(videoList);
        } else {
          setVideos([]);
        }
      });
    } else {
      setVideos([]);
    }
  }, [open, selectedCourseId]);

  const handleCourseChange = (value) => {
    setSelectedCourseId(value);
    setSelectedVideoId("");
    setSelectedVideoTitle("");
    if (value && value !== "none") {
      const course = courses.find((c) => c.id === value);
      setSelectedCourseTitle(course ? (course.title || course.courseTitle || "") : "");
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
      alert("Please log in to ask a doubt.");
      return;
    }
    setSubmitting(true);
    try {
      const rawRole = String(userData.role || "")
        .toLowerCase()
        .replace(/[\s_-]/g, "");

      const finalCourseId = selectedCourseId && selectedCourseId !== "none" ? selectedCourseId : "";
      const finalCourseTitle = selectedCourseId && selectedCourseId !== "none" ? selectedCourseTitle : "";

      const subject = `${title.trim()}`;

      const threadData = {
        createdBy: userData.id,
        createdByName: userData.name || userData.email || "User",
        createdByRole: rawRole,
        departmentId: userData.departmentId || "",
        departmentName: userData.department || "",
        courseId: finalCourseId,
        courseTitle: finalCourseTitle,
        subject,
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
    } catch (err) {
      console.error(err);
      alert("Failed to submit doubt.");
    } finally {
      setSubmitting(false);
    }
  };

  const showVideoField = videos.length > 0;

  return (
    <>
      <button
        type="button"
        className="fab-doubt-btn"
        onClick={() => setOpen(true)}
        title="Ask a Doubt"
        aria-label="Ask a Doubt"
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

        <span>Ask Doubt</span>
      </button>

      {open && (
        <div className="fab-doubt-backdrop" onClick={() => setOpen(false)}>
          <div className="fab-doubt-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="fab-doubt-drawer-header">
              <h3>Ask a Doubt</h3>
              <button
                className="fab-doubt-drawer-close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="fab-doubt-drawer-body">
              <label>Title</label>
              <input
                type="text"
                placeholder="Brief title for your doubt"
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
                placeholder="Describe your doubt in detail..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="fab-doubt-drawer-footer">
              <button
                className="fab-doubt-cancel-btn"
                onClick={() => setOpen(false)}
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
          </div>
        </div>
      )}
    </>
  );
}

export default FloatingDoubtButton;
