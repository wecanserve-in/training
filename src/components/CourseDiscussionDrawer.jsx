import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, database } from "../firebase";
import {
  sendCourseDiscussionMessage,
  watchCourseDiscussionMessages,
  notifyCourseDiscussionParticipants,
} from "../services/doubtService";
import "../styles/doubtchat.css";

const GENERAL_CHANNEL = "_general";

function CourseDiscussionDrawer({
  open,
  onClose,
  courseId,
  courseTitle = "Course",
  videos = [],
  initialVideoId = null,
}) {
  const messagesEndRef = useRef(null);
  const [userData, setUserData] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(
    initialVideoId || GENERAL_CHANNEL
  );
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [assignmentData, setAssignmentData] = useState(null);

  const normalizedVideos = useMemo(
    () =>
      videos.map((video, index) => ({
        id: video.id || video.videoId || video.mappingId,
        title:
          video.title || video.videoTitle || `Video ${index + 1}`,
      })),
    [videos]
  );

  const selectedVideo = useMemo(
    () => normalizedVideos.find((video) => video.id === selectedChannel),
    [normalizedVideos, selectedChannel]
  );

  useEffect(() => {
    if (!open) return;
    setSelectedChannel(initialVideoId || GENERAL_CHANNEL);
  }, [open, initialVideoId, courseId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserData(null);
        return;
      }

      try {
        const snapshot = await get(ref(database, `users/${user.uid}`));
        setUserData(
          snapshot.exists()
            ? { id: user.uid, ...snapshot.val() }
            : { id: user.uid, email: user.email }
        );
      } catch (error) {
        console.error("Failed to load discussion user:", error);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!open || !courseId || !selectedChannel) return undefined;

    setLoading(true);
    const unsubscribe = watchCourseDiscussionMessages(
      courseId,
      selectedChannel,
      (nextMessages) => {
        setMessages(nextMessages);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [open, courseId, selectedChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!open || !courseId) {
      setAssignmentData(null);
      return undefined;
    }

    let cancelled = false;

    const fetchAssignment = async () => {
      try {
        const allSnapshot = await get(ref(database, "userAssignments"));
        if (cancelled || !allSnapshot.exists()) return;

        const allAssignments = allSnapshot.val();
        for (const uid of Object.keys(allAssignments)) {
          const courseEntry = allAssignments[uid]?.[courseId];
          if (courseEntry?.assignedBy) {
            setAssignmentData({
              assignedBy: courseEntry.assignedBy,
              assignedByName: courseEntry.assignedByName || "",
            });
            return;
          }
        }
      } catch (error) {
        console.error("Failed to load assignment data:", error);
      }
    };

    fetchAssignment();
    return () => { cancelled = true; };
  }, [open, courseId]);

  useEffect(() => {
    if (!open) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || sending || !userData || !courseId) return;

    setSending(true);
    try {
      const message = await sendCourseDiscussionMessage({
        courseId,
        channelId: selectedChannel,
        videoId:
          selectedChannel === GENERAL_CHANNEL ? null : selectedChannel,
        videoTitle:
          selectedChannel === GENERAL_CHANNEL ? "" : selectedVideo?.title || "",
        senderId: userData.id,
        senderName: userData.name || userData.email || "User",
        senderRole: String(userData.role || "user")
          .toLowerCase()
          .replace(/[\s_-]/g, ""),
        message: text,
      });

      setNewMessage("");

      notifyCourseDiscussionParticipants({
        courseId,
        courseTitle,
        channelId: selectedChannel,
        videoId: message.videoId,
        videoTitle: message.videoTitle,
        senderId: userData.id,
        senderName: message.senderName,
        message: text,
      }).catch((error) => {
        console.error("Discussion notification failed:", error);
      });
    } catch (error) {
      console.error("Failed to send discussion message:", error);
      alert("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateValue) => {
    if (!dateValue) return "";
    const date = new Date(dateValue);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!open) return null;

  return (
    <div className="discussion-drawer-layer" role="presentation">
      <button
        type="button"
        className="discussion-drawer-backdrop"
        aria-label="Close discussion"
        onClick={onClose}
      />

      <aside className="discussion-drawer" aria-label="Course discussion center">
        <header className="discussion-drawer-header">
          <div>
            <span className="discussion-eyebrow">Discussion Center</span>
            <h2>{courseTitle}</h2>
          </div>
          <button
            type="button"
            className="discussion-close-btn"
            onClick={onClose}
            aria-label="Close discussion"
          >
            ×
          </button>
        </header>

        <div className="discussion-channel-bar">
          <label htmlFor="discussion-channel">Discussion topic</label>
          <select
            id="discussion-channel"
            value={selectedChannel}
            onChange={(event) => setSelectedChannel(event.target.value)}
          >
            <option value={GENERAL_CHANNEL}>General Discussion</option>
            {normalizedVideos.map((video) => (
              <option key={video.id} value={video.id}>
                {video.title}
              </option>
            ))}
          </select>
          <p>
            {selectedChannel === GENERAL_CHANNEL
              ? "Chat about the complete course without selecting a video."
              : `Messages for ${selectedVideo?.title || "this video"}.`}
          </p>
        </div>

        <div className="discussion-messages">
          {loading ? (
            <div className="discussion-state">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="discussion-state discussion-empty-state">
              <span>💬</span>
              <strong>No messages yet</strong>
              <p>Start the discussion for this topic.</p>
            </div>
          ) : (
            messages.map((message) => {
              const isOwn = message.senderId === userData?.id;
              const isAssigner =
                assignmentData &&
                message.senderId === assignmentData.assignedBy &&
                !isOwn;
              return (
                <article
                  key={message.messageId}
                  className={`discussion-message ${isOwn ? "own" : "other"}${isAssigner ? " assigner-message" : ""}`}
                >
                  {!isOwn && (
                    <div className="discussion-avatar">
                      {(message.senderName || "U")
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}

                  <div className="discussion-bubble">
                    {!isOwn && (
                      <strong>
                        {message.senderName || "Unknown user"}
                        {isAssigner && (
                          <span className="assigner-badge">Assigner</span>
                        )}
                      </strong>
                    )}
                    <p>{message.message}</p>
                    <time>{formatTime(message.createdAt)}</time>
                  </div>
                </article>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <footer className="discussion-compose">
          <textarea
            rows="1"
            placeholder={
              selectedChannel === GENERAL_CHANNEL
                ? "Message the course discussion..."
                : `Ask about ${selectedVideo?.title || "this video"}...`
            }
            value={newMessage}
            onChange={(event) => setNewMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!newMessage.trim() || sending || !userData}
            aria-label="Send message"
          >
            {sending ? "…" : "➤"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

export default CourseDiscussionDrawer;
