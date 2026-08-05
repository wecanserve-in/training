import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref, remove, set, update } from "firebase/database";
import { auth, database } from "../firebase";
import { uploadImageToCloudinary } from "../utils/cloudinaryUpload";
import "../styles/videolibrary.css";

function EditVideoLibrary() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [existingThumbnailUrl, setExistingThumbnailUrl] = useState("");

  const [quizQuestions, setQuizQuestions] = useState([]);
  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);

  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [videoData, setVideoData] = useState(null);

  const thumbnailInputRef = useRef(null);

  const getRole = (user) => String(user?.role || "").trim().toLowerCase();

  const getLibraryPath = () => {
    const role = getRole(currentUser);
    if (role === "superadmin") return "/super-admin/video-library";
    if (role === "admin") return "/admin/video-library";
    return "/department-admin/video-library";
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) {
        navigate("/");
        return;
      }
      const userSnap = await get(ref(database, `users/${loggedUser.uid}`));
      if (userSnap.exists()) {
        setCurrentUser({
          id: loggedUser.uid,
          email: loggedUser.email,
          ...userSnap.val(),
        });
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!id) return;

    const loadVideo = async () => {
      try {
        const snap = await get(ref(database, `videoLibrary/${id}`));
        if (!snap.exists()) {
          alert("Video not found");
          navigate(getLibraryPath());
          return;
        }
        const data = snap.val();
        setVideoData(data);
        setTitle(data.title || "");
        setDescription(data.description || "");
        setTags(Array.isArray(data.tags) ? data.tags : []);
        setExistingThumbnailUrl(data.thumbnailUrl || "");

        const quizSnap = await get(ref(database, `videoQuizzes/${id}`));
        if (quizSnap.exists()) {
          const quizData = quizSnap.val();
          const questionsSource = quizData.questions || quizData.quizQuestions || quizData;
          if (Array.isArray(questionsSource)) {
            setQuizQuestions(
              questionsSource.filter(Boolean).map((q) => ({
                question: q.question || q.questionText || "",
                options: Array.isArray(q.options) ? q.options : [q.optionA || "", q.optionB || "", q.optionC || "", q.optionD || ""],
                correctAnswer: q.correctAnswer || "",
              }))
            );
          } else if (typeof questionsSource === "object") {
            setQuizQuestions(
              Object.entries(questionsSource)
                .filter(([key]) => !["createdAt", "updatedAt", "videoId", "title", "description"].includes(key))
                .map(([, q]) => ({
                  question: q?.question || q?.questionText || "",
                  options: Array.isArray(q?.options) ? q.options : [q?.optionA || "", q?.optionB || "", q?.optionC || "", q?.optionD || ""],
                  correctAnswer: q?.correctAnswer || "",
                }))
            );
          }
        }
      } catch (error) {
        console.error("Failed to load video:", error);
        alert("Failed to load video details");
      } finally {
        setLoading(false);
      }
    };

    loadVideo();
  }, [id, navigate]);

  const handleTagInputKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tag) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleThumbnailChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const resetQuestionForm = () => {
    setQuestion("");
    setOptionA("");
    setOptionB("");
    setOptionC("");
    setOptionD("");
    setCorrectAnswer("");
  };

  const addQuizQuestion = () => {
    if (!question || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
      alert("Please complete question and all options.");
      return;
    }
    setQuizQuestions((prev) => [
      ...prev,
      {
        question: question.trim(),
        options: [optionA.trim(), optionB.trim(), optionC.trim(), optionD.trim()],
        correctAnswer,
        createdAt: new Date().toISOString(),
        uploadedVia: "manual",
      },
    ]);
    resetQuestionForm();
  };

  const removeQuizQuestion = (index) => {
    setQuizQuestions((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      resetQuestionForm();
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex((prev) => prev - 1);
    }
  };

  const startEditQuestion = (index) => {
    const q = quizQuestions[index];
    if (!q) return;
    setEditingIndex(index);
    setQuestion(q.question || "");
    const opts = q.options || [];
    setOptionA(opts[0] || "");
    setOptionB(opts[1] || "");
    setOptionC(opts[2] || "");
    setOptionD(opts[3] || "");
    setCorrectAnswer(q.correctAnswer || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveEditQuestion = () => {
    if (!question || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
      alert("Please complete question and all options.");
      return;
    }
    setQuizQuestions((prev) =>
      prev.map((q, i) =>
        i === editingIndex
          ? {
              ...q,
              question: question.trim(),
              options: [optionA.trim(), optionB.trim(), optionC.trim(), optionD.trim()],
              correctAnswer,
            }
          : q
      )
    );
    setEditingIndex(null);
    resetQuestionForm();
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    resetQuestionForm();
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      alert("Please enter a video title");
      return;
    }
    if (!description.trim()) {
      alert("Please enter a description");
      return;
    }

    try {
      setSaving(true);

      let thumbnailUrl = existingThumbnailUrl;
      if (thumbnailFile) {
        thumbnailUrl = await uploadImageToCloudinary(thumbnailFile, "training-portal/thumbnails");
      }

      await update(ref(database, `videoLibrary/${id}`), {
        title: title.trim(),
        description: description.trim(),
        tags,
        thumbnailUrl,
        totalQuizQuestions: quizQuestions.length,
        hasQuiz: quizQuestions.length > 0,
        updatedAt: new Date().toISOString(),
      });

      await remove(ref(database, `videoQuizzes/${id}`));

      for (const q of quizQuestions) {
        await set(
          ref(database, `videoQuizzes/${id}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
          {
            ...q,
            videoId: id,
            department: videoData?.department || "",
            departmentType: videoData?.departmentType || "",
            createdAt: q.createdAt || new Date().toISOString(),
          }
        );
      }

      setSuccessMessage("Video updated successfully!");
      setShowSuccess(true);
      window.setTimeout(() => {
        setShowSuccess(false);
        navigate(getLibraryPath(), { replace: true });
      }, 1200);
    } catch (error) {
      console.error("Update failed:", error);
      alert("Failed to update video: " + (error.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="video-library-page">
        <div className="vl-loading">Loading video details...</div>
      </div>
    );
  }

  const currentThumbnail = thumbnailPreview || existingThumbnailUrl;

  return (
    <div className="video-library-page">
      <div className="video-library-header">
        <Link to={getLibraryPath()} className="vl-back-link">
          &larr; Back to Video Library
        </Link>
        <span>
          <h1>Edit Video</h1>
          <p>Update title, description, thumbnail, and quiz questions.</p>
        </span>
      </div>

      <form onSubmit={handleSave} className="edit-video-form">
        {/* ─── Video Details Card ─── */}
        <div className="video-library-card edit-center-card">
          <div className="form-step-title">
            <span>1</span>
            <div>
              <h2>Video Details</h2>
              <p>Update basic information for this training video.</p>
            </div>
          </div>

          <div className="department-type-pill">
            <span>Department</span>
            <strong>{videoData?.department || "-"}</strong>
            <small>{videoData?.departmentType || ""}</small>
          </div>

          <input
            placeholder="Video Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <textarea
            placeholder="Short Description *"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="3"
          />

          <div className="tag-picker">
            <label>Tags</label>
            <div className="tag-input-container">
              <input
                type="text"
                placeholder="Type a tag and press Enter..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                className="tag-input"
              />
            </div>
            {tags.length > 0 && (
              <div className="selected-tags">
                {tags.map((tag) => (
                  <span key={tag} className="tag-chip">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)}>
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="suggested-tags">
              <span className="suggested-label">Suggested:</span>
              {["SOP", "Product", "Process", "Policy", "Internal Training", "Compliance", "Onboarding", "Safety", "Quality"].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`suggested-tag-btn ${tags.includes(tag) ? "active" : ""}`}
                  onClick={() => {
                    if (!tags.includes(tag)) setTags([...tags, tag]);
                  }}
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Thumbnail Card ─── */}
        <div className="video-library-card edit-center-card">
          <div className="form-step-title">
            <span>2</span>
            <div>
              <h2>Thumbnail</h2>
              <p>Update the video thumbnail image.</p>
            </div>
          </div>

          <div className="edit-thumbnail-section">
            {currentThumbnail && (
              <div className="edit-thumbnail-preview">
                <img src={currentThumbnail} alt="Current thumbnail" />
              </div>
            )}

            <label className="edit-thumbnail-upload-btn">
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/*"
                onChange={handleThumbnailChange}
                style={{ display: "none" }}
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {thumbnailFile ? "Change Thumbnail" : "Upload New Thumbnail"}
            </label>
            {thumbnailFile && (
              <span className="edit-thumbnail-file-name">{thumbnailFile.name}</span>
            )}
          </div>
        </div>

        {/* ─── Quiz Card ─── */}
        <div className="video-library-card edit-center-card">
          <div className="form-step-title">
            <span>3</span>
            <div>
              <h2>Learning Quiz</h2>
              <p>Edit questions or add new ones.</p>
            </div>
          </div>

          <div className="edit-quiz-form">
            <textarea
              placeholder="Question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows="2"
            />

            <div className="edit-options-grid">
              <div className="edit-option-field">
                <label>A</label>
                <input placeholder="Option A" value={optionA} onChange={(e) => setOptionA(e.target.value)} />
              </div>
              <div className="edit-option-field">
                <label>B</label>
                <input placeholder="Option B" value={optionB} onChange={(e) => setOptionB(e.target.value)} />
              </div>
              <div className="edit-option-field">
                <label>C</label>
                <input placeholder="Option C" value={optionC} onChange={(e) => setOptionC(e.target.value)} />
              </div>
              <div className="edit-option-field">
                <label>D</label>
                <input placeholder="Option D" value={optionD} onChange={(e) => setOptionD(e.target.value)} />
              </div>
            </div>

            <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)}>
              <option value="">Select Correct Answer</option>
              {optionA && <option value={optionA}>A: {optionA}</option>}
              {optionB && <option value={optionB}>B: {optionB}</option>}
              {optionC && <option value={optionC}>C: {optionC}</option>}
              {optionD && <option value={optionD}>D: {optionD}</option>}
            </select>

            {editingIndex !== null ? (
              <div className="edit-quiz-actions">
                <button type="button" className="add-question-btn" onClick={saveEditQuestion}>
                  Save Edit
                </button>
                <button type="button" className="edit-cancel-btn" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="add-question-btn" onClick={addQuizQuestion}>
                + Add This Question
              </button>
            )}
          </div>

          {quizQuestions.length > 0 && (
            <div className="edit-quiz-list">
              <h3>Questions ({quizQuestions.length})</h3>
              {quizQuestions.map((item, index) => {
                const opts = item.options || [];
                return (
                  <div className="edit-question-card" key={index}>
                    <div className="edit-question-header">
                      <span className="edit-question-num">{index + 1}</span>
                      <strong className="edit-question-text">{item.question}</strong>
                      <div className="edit-question-btns">
                        <button type="button" className="edit-question-edit" onClick={() => startEditQuestion(index)} title="Edit">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                        </button>
                        <button type="button" className="edit-question-remove" onClick={() => removeQuizQuestion(index)} title="Remove">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    </div>
                    <div className="edit-options-display">
                      {opts.map((opt, oi) => (
                        <div
                          key={oi}
                          className={`edit-option-item ${opt === item.correctAnswer ? "correct" : ""}`}
                        >
                          <span className="edit-option-label">{String.fromCharCode(65 + oi)}</span>
                          <span className="edit-option-text">{opt}</span>
                          {opt === item.correctAnswer && (
                            <span className="edit-correct-badge">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                              Correct
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Save Footer ─── */}
        <div className="save-video-footer">
          <Link to={getLibraryPath()} className="outline-action-btn" style={{ marginRight: 12 }}>
            Cancel
          </Link>
          <button type="submit" className="primary-library-btn final-save-btn" disabled={saving}>
            {saving ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>
      </form>

      {showSuccess && (
        <div className="success-modal-overlay">
          <div className="success-modal">
            <div className="success-check">&#10003;</div>
            <h3>Done</h3>
            <p>{successMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default EditVideoLibrary;
