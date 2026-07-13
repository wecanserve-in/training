import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, push, ref, set } from "firebase/database";
import * as XLSX from "xlsx";
import { auth, database } from "../firebase";
import "../styles/coursewizard.css";

function AddCourse() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState("");
  const [departmentType, setDepartmentType] = useState("");

  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");

  const [videoLibrary, setVideoLibrary] = useState([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState([]);

  const [videoSearch, setVideoSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterOrgan, setFilterOrgan] = useState("");

  const [passingScore, setPassingScore] = useState(70);
  const [testDuration, setTestDuration] = useState(60);

  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [questions, setQuestions] = useState([]);
  const [excelFile, setExcelFile] = useState(null);

  const [saving, setSaving] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const steps = [
    { id: 1, label: "Course" },
    { id: 2, label: "Videos" },
    { id: 3, label: "Quiz" },
    { id: 4, label: "Save" },
  ];

  const checkIsDeptAdmin = (user) => {
    const r = String(user?.role || "").trim().toLowerCase();
    return r === "departmentadmin" || r === "department admin" || r === "department_admin" || r === "deptadmin" || r === "dept admin";
  };

  const isDeptAdmin = checkIsDeptAdmin(currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) {
        navigate("/");
        return;
      }

      const userSnap = await get(ref(database, `users/${loggedUser.uid}`));

      if (!userSnap.exists()) {
        alert("User profile not found");
        navigate("/");
        return;
      }

      const userData = {
        id: loggedUser.uid,
        email: loggedUser.email,
        ...userSnap.val(),
      };

      setCurrentUser(userData);

      if (checkIsDeptAdmin(userData)) {
        setDepartment(userData.department || "");
        setDepartmentType(userData.departmentType || "");
      }

      await loadDepartments();
      await loadVideoLibrary(userData);
      setLoadingUser(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (thumbnailPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(thumbnailPreview);
      }
    };
  }, [thumbnailPreview]);

  const loadDepartments = async () => {
    try {
      const snap = await get(ref(database, "departments"));
      if (snap.exists()) {
        const data = Object.entries(snap.val()).map(([id, dept]) => ({
          id,
          ...dept,
        }));
        setDepartments(data);
      }
    } catch (e) {
      console.error("Failed to load departments:", e);
    }
  };

  const loadVideoLibrary = async (userData) => {
    const snap = await get(ref(database, "videoLibrary"));

    if (!snap.exists()) {
      setVideoLibrary([]);
      return;
    }

    const data = Object.entries(snap.val()).map(([id, video]) => ({
      id,
      ...video,
    }));

    let filtered;
    if (checkIsDeptAdmin(userData)) {
      filtered = data.filter(
        (v) =>
          v.department === userData.department ||
          v.departmentType === userData.departmentType ||
          v.createdBy === userData.id
      );
    } else {
      filtered = data;
    }

    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    setVideoLibrary(filtered);
  };

  const uploadImageToCloudinary = async (file) => {
    if (!file) return "";

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error("Cloudinary env variables missing.");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", `training-portal/course-thumbnails/${department || "General"}`);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: formData }
    );

    const data = await response.json();

    if (!response.ok || !data.secure_url) {
      throw new Error(data?.error?.message || "Thumbnail upload failed");
    }

    return data.secure_url;
  };

  const organOptions = useMemo(() => {
    return [
      ...new Set(videoLibrary.map((v) => v.metadata?.organName).filter(Boolean)),
    ];
  }, [videoLibrary]);

  const filteredVideos = useMemo(() => {
    const search = videoSearch.toLowerCase();
    return videoLibrary.filter((v) => {
      const organName = v.metadata?.organName || "";
      const videoType = v.metadata?.videoType || "";
      const genericName = v.metadata?.genericName || "";
      const typeSpecific = v.metadata?.typeSpecific || "";

      const text = [
        v.title, v.description, organName, videoType, genericName, typeSpecific,
        ...(v.tags || []),
      ].filter(Boolean).join(" ").toLowerCase();

      return (
        text.includes(search) &&
        (filterType ? videoType === filterType : true) &&
        (filterOrgan ? organName === filterOrgan : true)
      );
    });
  }, [videoLibrary, videoSearch, filterType, filterOrgan]);

  const selectedVideos = useMemo(() => {
    return selectedVideoIds
      .map((id) => videoLibrary.find((v) => v.id === id))
      .filter(Boolean);
  }, [selectedVideoIds, videoLibrary]);

  const allFilteredSelected =
    filteredVideos.length > 0 &&
    filteredVideos.every((v) => selectedVideoIds.includes(v.id));

  const toggleFilteredSelection = () => {
    const ids = filteredVideos.map((v) => v.id);
    if (allFilteredSelected) {
      const set = new Set(ids);
      setSelectedVideoIds((prev) => prev.filter((id) => !set.has(id)));
    } else {
      setSelectedVideoIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const toggleVideo = (videoId) => {
    setSelectedVideoIds((prev) =>
      prev.includes(videoId)
        ? prev.filter((id) => id !== videoId)
        : [...prev, videoId]
    );
  };

  const handleThumbnailChange = (file) => {
    setThumbnailFile(file || null);
    if (!file) {
      setThumbnailPreview("");
      return;
    }
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

  const addManualQuestion = () => {
    if (!question || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
      alert("Please complete question and all options.");
      return;
    }
    setQuestions((prev) => [
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

  const removeQuestion = (index) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Question", "OptionA", "OptionB", "OptionC", "OptionD", "CorrectAnswer"],
      [
        "What is the main objective of this course?",
        "Understand the topic",
        "Review process",
        "Product learning",
        "None",
        "A",
      ],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    XLSX.writeFile(wb, "Course_Quiz_Template.xlsx");
  };

  const handleExcelUpload = (selectedFile = excelFile) => {
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet);

        const uploaded = [];
        rows.forEach((row) => {
          const q = row.Question || row.question;
          const a = row.OptionA || row.optionA;
          const b = row.OptionB || row.optionB;
          const c = row.OptionC || row.optionC;
          const d = row.OptionD || row.optionD;
          const correct = row.CorrectAnswer || row.correctAnswer;

          if (!q || !a || !b || !c || !d || !correct) return;

          let finalAnswer = String(correct).trim();
          const key = finalAnswer.toUpperCase();
          if (key === "A") finalAnswer = String(a).trim();
          if (key === "B") finalAnswer = String(b).trim();
          if (key === "C") finalAnswer = String(c).trim();
          if (key === "D") finalAnswer = String(d).trim();

          uploaded.push({
            question: String(q).trim(),
            options: [String(a).trim(), String(b).trim(), String(c).trim(), String(d).trim()],
            correctAnswer: finalAnswer,
            createdAt: new Date().toISOString(),
            uploadedVia: "excel",
          });
        });

        setQuestions((prev) => [...prev, ...uploaded]);
        setExcelFile(null);
        setSuccessMessage(`${uploaded.length} questions imported successfully.`);
        setShowSuccessModal(true);
      } catch {
        setSuccessMessage("Unable to read Excel file.");
        setShowSuccessModal(true);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const goNext = () => {
    if (step === 1 && (!department || !title.trim() || !overview.trim())) {
      alert("Please fill course title, department and overview.");
      return;
    }
    if (step === 2 && selectedVideoIds.length === 0) {
      alert("Please select at least one video.");
      return;
    }
    if (step === 3) {
      const score = Number(passingScore);
      const duration = Number(testDuration);
      if (score < 0 || score > 100 || duration < 5) {
        alert("Passing score must be 0-100 and duration at least 5 seconds.");
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, 4));
  };

  const saveCourse = async () => {
    if (!title.trim() || !overview.trim() || selectedVideoIds.length === 0) {
      alert("Please complete course details and select videos.");
      return;
    }

    try {
      setSaving(true);
      setUploadStatus("Saving course...");

      const thumbUrl = thumbnailFile
        ? await uploadImageToCloudinary(thumbnailFile)
        : "";

      const finalThumbnail =
        thumbUrl ||
        selectedVideos.find((v) => v.thumbnailUrl)?.thumbnailUrl ||
        "";

      const courseRef = push(ref(database, "courses"));
      const courseId = courseRef.key;

      await set(courseRef, {
        title: title.trim(),
        description: overview.trim(),
        overview: overview.trim(),
        courseThumbnail: finalThumbnail,
        thumbnailUrl: finalThumbnail,
        department,
        departmentType,
        videoIds: selectedVideoIds,
        totalVideos: selectedVideoIds.length,
        passingScore: Number(passingScore),
        testDuration: Number(testDuration),
        totalQuestions: questions.length,
        createdBy: currentUser?.id || "",
        createdByName: currentUser?.name || "",
        createdByEmail: currentUser?.email || "",
        createdByRole: currentUser?.role || "",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await Promise.all(
        selectedVideos.map((video, i) =>
          set(ref(database, `courseVideos/${courseId}/${video.id}`), {
            ...video,
            courseId,
            courseTitle: title.trim(),
            order: i + 1,
            addedAt: new Date().toISOString(),
          })
        )
      );

      for (const q of questions) {
        await push(ref(database, `questions/${courseId}`), {
          department,
          departmentType,
          courseId,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          createdAt: q.createdAt || new Date().toISOString(),
          uploadedVia: q.uploadedVia || "manual",
        });
      }

      alert("Course created successfully.");
      const prefix = isDeptAdmin ? "/department-admin" : "/admin";
      navigate(`${prefix}/courses`);
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to save course.");
    } finally {
      setSaving(false);
      setUploadStatus("");
    }
  };

  if (loadingUser) {
    return (
      <div className="course-wizard-page" style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <p style={{ color: "#64748b" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="course-wizard-page">
      <div className="wizard-topbar">
        <button type="button" className="btn-admin-back" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <img src="/Logo.webp" alt="Logo" className="wizard-logo" />
      </div>

      <div className="admin-form-card wizard-card">
        <div className="wizard-header">
          <h1 className="admin-form-title">Create Course</h1>
          <p className="admin-form-subtitle">
            Fill details, choose uploaded videos, add quiz and save.
          </p>
        </div>

        <div className="wizard-progress">
          {steps.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`wizard-step-circle ${step === item.id ? "active" : ""} ${step > item.id ? "completed" : ""}`}
              onClick={() => item.id < step && setStep(item.id)}
            >
              <span className="circle-number">{step > item.id ? "✓" : item.id}</span>
              <span className="circle-label">{item.label}</span>
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="wizard-section">
            <div className="section-mini-title">
              <span>Step 01</span>
              <h2>Course Details</h2>
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">Department *</label>
              {isDeptAdmin ? (
                <input value={department} className="admin-form-input" disabled />
              ) : (
                <select
                  value={department}
                  onChange={(e) => {
                    const sel = departments.find((d) => d.departmentName === e.target.value);
                    setDepartment(e.target.value);
                    setDepartmentType(sel?.departmentType || "");
                  }}
                  className="admin-form-input"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.departmentName}>
                      {d.departmentName}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">Course Title *</label>
              <input
                placeholder="e.g., Breast Cancer Product Training"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="admin-form-input"
              />
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">Course Overview *</label>
              <textarea
                placeholder="Write a short overview of what this course covers..."
                value={overview}
                onChange={(e) => setOverview(e.target.value)}
                className="admin-form-textarea"
                rows="4"
              />
            </div>

            <div className="course-thumb-upload-box">
              <div>
                <h3>Course Thumbnail</h3>
                <p>Optional. If skipped, first selected video thumbnail will be used.</p>
              </div>
              <label className="course-thumb-picker">
                {thumbnailPreview ? (
                  <img src={thumbnailPreview} alt="Thumbnail preview" />
                ) : (
                  <span>+ Upload</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleThumbnailChange(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div className="admin-form-submit-zone">
              <button type="button" className="btn-admin-submit-form" onClick={goNext}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-section">
            <div className="section-mini-title">
              <span>Step 02</span>
              <h2>Select Videos</h2>
            </div>

            <div className="course-video-toolbar">
              <input
                type="text"
                placeholder="Search title, organ, type..."
                value={videoSearch}
                onChange={(e) => setVideoSearch(e.target.value)}
              />
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">All Types</option>
                <option value="Anatomy">Anatomy</option>
                <option value="Therapy">Therapy</option>
                <option value="Product">Product</option>
                <option value="Other">Other</option>
              </select>
              <select value={filterOrgan} onChange={(e) => setFilterOrgan(e.target.value)}>
                <option value="">All Organs</option>
                {organOptions.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            <div className="bulk-select-row">
              <p>{selectedVideoIds.length} selected • {filteredVideos.length} showing</p>
              <button type="button" onClick={toggleFilteredSelection}>
                {allFilteredSelected ? "Unselect All" : "Select All"}
              </button>
            </div>

            <div className="course-video-select-list">
              {filteredVideos.map((video) => {
                const selected = selectedVideoIds.includes(video.id);
                return (
                  <button
                    type="button"
                    key={video.id}
                    className={`course-video-select-card ${selected ? "selected" : ""}`}
                    onClick={() => toggleVideo(video.id)}
                  >
                    <div className="course-video-thumb">
                      {video.thumbnailUrl ? (
                        <img src={video.thumbnailUrl} alt={video.title} />
                      ) : (
                        <div>No Thumbnail</div>
                      )}
                    </div>
                    <div className="course-video-info">
                      <h3>{video.title}</h3>
                      <p>{video.description || "No description"}</p>
                      <div className="course-video-tags">
                        {video.metadata?.organName && <span>{video.metadata.organName}</span>}
                        {video.metadata?.videoType && <span>{video.metadata.videoType}</span>}
                        {video.metadata?.genericName && <span>{video.metadata.genericName}</span>}
                      </div>
                    </div>
                    <span className="select-check">{selected ? "✓" : ""}</span>
                  </button>
                );
              })}
              {filteredVideos.length === 0 && (
                <div className="empty-course-state">
                  <h3>No videos found</h3>
                  <p>Upload videos first or change filters.</p>
                </div>
              )}
            </div>

            <div className="admin-form-submit-zone">
              <button type="button" className="btn-admin-back" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button type="button" className="btn-admin-submit-form" onClick={goNext}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="wizard-section">
            <div className="section-mini-title">
              <span>Step 03</span>
              <h2>Quiz Setup</h2>
            </div>

            <div className="quiz-basic-box">
              <div className="admin-input-group">
                <label className="admin-field-label">Passing Score (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={passingScore}
                  onChange={(e) => setPassingScore(e.target.value)}
                  className="admin-form-input"
                />
              </div>
              <div className="admin-input-group">
                <label className="admin-field-label">Quiz Duration (Seconds)</label>
                <input
                  type="number"
                  min="5"
                  value={testDuration}
                  onChange={(e) => setTestDuration(e.target.value)}
                  className="admin-form-input"
                />
              </div>
            </div>

            <div className="simple-quiz-upload">
              <div className="simple-quiz-upload-top">
                <h3>Bulk Upload</h3>
                <div className="simple-quiz-actions">
                  <button type="button" onClick={downloadTemplate}>
                    Download Sample
                  </button>
                  <label>
                    Upload Excel
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setExcelFile(file);
                        handleExcelUpload(file);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="manual-divider">
              <span>Or add manually</span>
            </div>

            <textarea
              placeholder="Enter question..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="admin-form-textarea"
              rows="2"
            />

            <div className="admin-form-row-split">
              <input placeholder="Option A" value={optionA} onChange={(e) => setOptionA(e.target.value)} className="admin-form-input" />
              <input placeholder="Option B" value={optionB} onChange={(e) => setOptionB(e.target.value)} className="admin-form-input" />
            </div>

            <div className="admin-form-row-split">
              <input placeholder="Option C" value={optionC} onChange={(e) => setOptionC(e.target.value)} className="admin-form-input" />
              <input placeholder="Option D" value={optionD} onChange={(e) => setOptionD(e.target.value)} className="admin-form-input" />
            </div>

            <select
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              className="admin-form-input"
            >
              <option value="">Select Correct Answer</option>
              {optionA && <option value={optionA}>A: {optionA}</option>}
              {optionB && <option value={optionB}>B: {optionB}</option>}
              {optionC && <option value={optionC}>C: {optionC}</option>}
              {optionD && <option value={optionD}>D: {optionD}</option>}
            </select>

            <button type="button" className="btn-add-inline" onClick={addManualQuestion}>
              + Add Question
            </button>

            {questions.length > 0 && (
              <div className="added-list-box">
                <h3>Questions Added: {questions.length}</h3>
                {questions.map((item, index) => (
                  <div key={`${item.question}-${index}`} className="added-row">
                    <div>
                      <strong>{index + 1}. {item.question}</strong>
                      <p>Correct: {item.correctAnswer}</p>
                    </div>
                    <button type="button" onClick={() => removeQuestion(index)} className="btn-remove-small">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="admin-form-submit-zone">
              <button type="button" className="btn-admin-back" onClick={() => setStep(2)}>
                ← Back
              </button>
              <button type="button" className="btn-admin-submit-form" onClick={goNext}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="wizard-section">
            <div className="section-mini-title">
              <span>Step 04</span>
              <h2>Review & Save</h2>
            </div>

            <div className="review-box">
              <h3>{title}</h3>

              <div className="review-grid">
                <div className="review-item">
                  <span className="label">Department</span>
                  <span className="value">{department || "-"}</span>
                </div>
                <div className="review-item">
                  <span className="label">Videos</span>
                  <span className="value green">{selectedVideoIds.length}</span>
                </div>
                <div className="review-item">
                  <span className="label">Questions</span>
                  <span className="value yellow">{questions.length}</span>
                </div>
                <div className="review-item">
                  <span className="label">Passing Score</span>
                  <span className="value">{passingScore}%</span>
                </div>
                <div className="review-item">
                  <span className="label">Duration</span>
                  <span className="value">{testDuration}s</span>
                </div>
                <div className="review-item">
                  <span className="label">Thumbnail</span>
                  <span className="value">{thumbnailFile ? "Custom" : "Auto"}</span>
                </div>

                <div className="review-overview">
                  <span className="label">Overview</span>
                  <p className="value">{overview}</p>
                </div>
              </div>

              {uploadStatus && <p style={{ color: "#059669", fontSize: "0.82rem", margin: "6px 0 0" }}>{uploadStatus}</p>}
            </div>

            <div className="admin-form-submit-zone">
              <button type="button" className="btn-admin-back" onClick={() => setStep(3)}>
                ← Back
              </button>
              <button
                type="button"
                className="btn-admin-submit-form"
                onClick={saveCourse}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Course"}
              </button>
            </div>
          </div>
        )}
      </div>

      {showSuccessModal && (
        <div className="success-modal-overlay" onClick={() => setShowSuccessModal(false)}>
          <div className="success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="success-check">✓</div>
            <h3>Done</h3>
            <p>{successMessage}</p>
            <button type="button" onClick={() => setShowSuccessModal(false)}>
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AddCourse;
