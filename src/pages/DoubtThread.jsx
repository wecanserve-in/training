import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { useParams, useNavigate } from "react-router-dom";
import { auth, database } from "../firebase";
import {
  getThread,
  watchThreadMessages,
  sendDoubtMessage,
  updateThreadStatus,
  deleteDoubtThread,
  markThreadRead,
  notifyThreadOwner,
  notifyOtherParticipants,
} from "../services/doubtService";
import useBasePath from "../hooks/useBasePath";
import "../styles/doubtchat.css";

function DoubtThread() {
  const { id: threadId } = useParams();
  const navigate = useNavigate();
  const basePath = useBasePath();
  const messagesEndRef = useRef(null);

  const [userData, setUserData] = useState(null);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!threadId) return;
    const loadThread = async () => {
      const t = await getThread(threadId);
      setThread(t);
    };
    loadThread();
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    const unsub = watchThreadMessages(threadId, setMessages);
    return () => unsub();
  }, [threadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!threadId || !userData) return;
    markThreadRead(threadId);
  }, [threadId, userData, messages]);

  const rawRole = String(userData?.role || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  const isSuperAdmin = rawRole === "superadmin";
  const isAdmin = rawRole === "admin";
  const isDeptAdmin = rawRole === "departmentadmin";
  const canChangeStatus = isSuperAdmin || isAdmin || isDeptAdmin;
  const canReply = isSuperAdmin || isAdmin || isDeptAdmin;
  const canDeleteThread = isSuperAdmin || isAdmin || isDeptAdmin;

  const handleSend = async () => {
    if (!newMsg.trim() || sending) return;
    setSending(true);
    try {
      await sendDoubtMessage(threadId, {
        senderId: userData.id,
        senderName: userData.name || userData.email || "User",
        senderRole: rawRole,
        departmentId: userData.departmentId || "",
        message: newMsg.trim(),
        currentUnreadCount: thread?.unreadCount || 0,
      });

      const updatedThread = await getThread(threadId);
      setThread(updatedThread);

      if (thread) {
        const senderName = userData.name || userData.email || "User";
        if (thread.createdBy !== userData.id) {
          await notifyThreadOwner(thread, senderName, newMsg.trim());
        }
        await notifyOtherParticipants(
          thread,
          userData.id,
          senderName,
          newMsg.trim()
        );
      }

      setNewMsg("");
    } catch (err) {
      console.error(err);
      alert("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await updateThreadStatus(threadId, newStatus);
      setThread((prev) => ({ ...prev, status: newStatus }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteThread = async () => {
    if (!window.confirm("Delete this chat and all its messages? This cannot be undone.")) return;
    try {
      await deleteDoubtThread(threadId);
      navigate(`${basePath}/doubts`);
    } catch (err) {
      console.error(err);
      alert("Failed to delete chat.");
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
        <div className="doubt-loading">Loading...</div>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="doubt-page">
        <div className="doubt-empty">Thread not found.</div>
        <button
          className="doubt-back-btn"
          onClick={() => navigate(`${basePath}/doubts`)}
        >
          ← Back to Chats
        </button>
      </div>
    );
  }

  return (
    <div className="doubt-thread-page">
      <div className="doubt-thread-header">
        <button
          className="doubt-back-btn"
          onClick={() => navigate(`${basePath}/doubts`)}
        >
          ← Back
        </button>
        <div className="doubt-thread-header-info">
          <h2>{thread.subject}</h2>
          <div className="doubt-thread-header-meta">
            <span>by {thread.createdByName}</span>
            {thread.courseTitle && <span>• {thread.courseTitle}</span>}
            {thread.departmentName && (
              <span>• {thread.departmentName}</span>
            )}
            <span>• {formatTime(thread.createdAt)}</span>
          </div>
        </div>
        {canChangeStatus && (
          <select
            className={`doubt-status-select ${thread.status}`}
            value={thread.status}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        )}
        {canDeleteThread && (
          <button
            className="doubt-delete-btn doubt-delete-header"
            title="Delete chat"
            onClick={handleDeleteThread}
          >
            ×
          </button>
        )}
      </div>

      <div className="doubt-messages-area">
        {messages.length === 0 ? (
          <div className="doubt-empty">No messages yet.</div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === userData?.id;
            return (
              <div
                key={msg.messageId}
                className={`doubt-message ${isOwn ? "own" : "other"}`}
              >
                <div className="doubt-msg-avatar">
                  {(msg.senderName || "U")
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="doubt-msg-content">
                  <div className="doubt-msg-header">
                    <strong>{msg.senderName || "Unknown"}</strong>
                    <span className="doubt-msg-role">
                      {formatRole(msg.senderRole)}
                    </span>
                    <span className="doubt-msg-time">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  <div className="doubt-msg-text">{msg.message}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {canReply && thread.status !== "resolved" && (
        <div className="doubt-reply-bar">
          <input
            type="text"
            placeholder="Type your reply..."
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button
            className="doubt-send-btn"
            onClick={handleSend}
            disabled={sending || !newMsg.trim()}
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      )}

      {!canReply && thread.status !== "resolved" && (
        <div className="doubt-reply-bar">
          <input
            type="text"
            placeholder="Type your reply..."
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button
            className="doubt-send-btn"
            onClick={handleSend}
            disabled={sending || !newMsg.trim()}
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      )}

      {thread.status === "resolved" && (
        <div className="doubt-resolved-banner">
          This chat has been resolved.
        </div>
      )}
    </div>
  );
}

export default DoubtThread;
