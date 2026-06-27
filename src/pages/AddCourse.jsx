import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, push, ref, set } from "firebase/database";
import * as XLSX from "xlsx";
import { auth, database } from "../firebase";
import "../styles/addvideo.css";

function AddCourse() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

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

  const steps = [
    { id: 1, label: "Course" },
    { id: 2, label: "Videos" },
    { id: 3, label: "Quiz" },
    { id: 4, label: "Save" },
  ];

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
if (userData.role === "departmentAdmin") {
  setDepartment(userData.department || "");
  setDepartmentType(userData.departmentType || "");
} else {
  setDepartment("");
  setDepartmentType("");
}
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

    const ownVideos = data.filter((video) => {
      return (
        video.createdBy === userData.id ||
        video.department === userData.department ||
        video.departmentType === userData.departmentType
      );
    });

    ownVideos.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    setVideoLibrary(ownVideos);
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
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok || !data.secure_url) {
      throw new Error(data?.error?.message || "Thumbnail upload failed");
    }

    return data.secure_url;
  };

  const organOptions = useMemo(() => {
    return [
      ...new Set(videoLibrary.map((video) => video.metadata?.organName).filter(Boolean)),
    ];
  }, [videoLibrary]);

  const filteredVideos = useMemo(() => {
    const searchValue = videoSearch.toLowerCase();

    return videoLibrary.filter((video) => {
      const organName = video.metadata?.organName || "";
      const videoType = video.metadata?.videoType || "";
      const genericName = video.metadata?.genericName || "";
      const typeSpecific = video.metadata?.typeSpecific || "";

      const combinedText = [
        video.title,
        video.description,
        organName,
        videoType,
        genericName,
        typeSpecific,
        ...(video.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        combinedText.includes(searchValue) &&
        (filterType ? videoType === filterType : true) &&
        (filterOrgan ? organName === filterOrgan : true)
      );
    });
  }, [videoLibrary, videoSearch, filterType, filterOrgan]);

  const selectedVideos = useMemo(() => {
    return selectedVideoIds
      .map((id) => videoLibrary.find((video) => video.id === id))
      .filter(Boolean);
  }, [selectedVideoIds, videoLibrary]);

  const allFilteredSelected =
    filteredVideos.length > 0 &&
    filteredVideos.every((video) => selectedVideoIds.includes(video.id));

  const toggleFilteredSelection = () => {
    const filteredIds = filteredVideos.map((video) => video.id);

    if (allFilteredSelected) {
      const filteredSet = new Set(filteredIds);
      setSelectedVideoIds((prev) => prev.filter((id) => !filteredSet.has(id)));
      return;
    }

    setSelectedVideoIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
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
    const worksheetData = [
      ["Question", "OptionA", "OptionB", "OptionC", "OptionD", "CorrectAnswer"],
      [
        "What is the main objective of this course?",
        "Understand the topic",
        "Review process",
        "Product learning",
        "None",
        "A",
      ],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");
    XLSX.writeFile(workbook, "Course_Quiz_Template.xlsx");
  };

  const handleExcelUpload = () => {
    if (!excelFile) {
      alert("Please choose Excel file first.");
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet);

        const uploadedQuestions = [];

        rows.forEach((row) => {
          const q = row.Question || row.question;
          const a = row.OptionA || row.optionA;
          const b = row.OptionB || row.optionB;
          const c = row.OptionC || row.optionC;
          const d = row.OptionD || row.optionD;
          const correct = row.CorrectAnswer || row.correctAnswer;

          if (!q || !a || !b || !c || !d || !correct) return;

          let finalCorrectAnswer = String(correct).trim();
          const key = String(correct).trim().toUpperCase();

          if (key === "A") finalCorrectAnswer = String(a).trim();
          if (key === "B") finalCorrectAnswer = String(b).trim();
          if (key === "C") finalCorrectAnswer = String(c).trim();
          if (key === "D") finalCorrectAnswer = String(d).trim();

          uploadedQuestions.push({
            question: String(q).trim(),
            options: [String(a).trim(), String(b).trim(), String(c).trim(), String(d).trim()],
            correctAnswer: finalCorrectAnswer,
            createdAt: new Date().toISOString(),
            uploadedVia: "excel",
          });
        });

        setQuestions((prev) => [...prev, ...uploadedQuestions]);
        setExcelFile(null);
        alert(`${uploadedQuestions.length} questions added.`);
      } catch (error) {
        alert("Failed to read Excel file.");
      }
    };

    reader.readAsArrayBuffer(excelFile);
  };

  const goNext = () => {
   if (step === 1 && (!department || !title.trim() || !overview.trim())) {
      alert("Please add course title and overview.");
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
        alert("Passing score must be between 0-100 and duration should be at least 5 seconds.");
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

      const uploadedThumbnailUrl = thumbnailFile
        ? await uploadImageToCloudinary(thumbnailFile)
        : "";

      const finalThumbnail =
        uploadedThumbnailUrl ||
        selectedVideos.find((video) => video.thumbnailUrl)?.thumbnailUrl ||
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
        selectedVideos.map((video, index) =>
          set(ref(database, `courseVideos/${courseId}/${video.id}`), {
            ...video,
            courseId,
            courseTitle: title.trim(),
            order: index + 1,
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
      navigate("/department-admin/courses");
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to save course.");
    } finally {
      setSaving(false);
      setUploadStatus("");
    }
  };

  if (loadingUser) {
    return <div className="admin-form-container">Loading...</div>;
  }

  return (
    <div className="admin-form-container course-wizard-page">
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
              className={`wizard-step-circle ${step === item.id ? "active" : ""} ${
                step > item.id ? "completed" : ""
              }`}
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
              <label className="admin-field-label">Department</label>
          {currentUser?.role === "departmentAdmin" ? (
  <input value={department} className="admin-form-input" disabled />
) : (
  <select
    value={department}
    onChange={(e) => setDepartment(e.target.value)}
    className="admin-form-input"
  >
    <option value="">Select Department</option>
    <option value="Sales">Sales</option>
    <option value="Marketing">Marketing</option>
    <option value="HR">HR</option>
    <option value="Production">Production</option>
    <option value="Accounts">Accounts</option>
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
                  <img src={thumbnailPreview} alt="Course thumbnail preview" />
                ) : (
                  <span>+ Upload Thumbnail</span>
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
                Continue
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
                placeholder="Search title, organ, type, generic, tags..."
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
                {organOptions.map((organ) => (
                  <option key={organ} value={organ}>
                    {organ}
                  </option>
                ))}
              </select>
            </div>

            <div className="bulk-select-row">
              <p>
                {selectedVideoIds.length} selected • {filteredVideos.length} showing
              </p>

              <button type="button" onClick={toggleFilteredSelection}>
                {allFilteredSelected ? "Unselect Filtered" : "Select Filtered"}
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
                      <p>{video.description || "No description added."}</p>

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
                  <p>Upload videos in Video Library first or change filters.</p>
                </div>
              )}
            </div>

            <div className="admin-form-submit-zone">
              <button type="button" className="btn-admin-back" onClick={() => setStep(1)}>
                Back
              </button>

              <button type="button" className="btn-admin-submit-form" onClick={goNext}>
                Continue
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
              <div>
                <h3>Bulk Add Questions</h3>
                <p>Download sample, fill it and upload questions.</p>
              </div>

              <div className="simple-quiz-actions">
                <button type="button" onClick={downloadTemplate}>
                  Download Sample
                </button>

                <label>
                  Choose Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                  />
                </label>

                <button type="button" onClick={handleExcelUpload}>
                  Add Questions
                </button>
              </div>

              {excelFile && <small>Selected: {excelFile.name}</small>}
            </div>

            <div className="manual-divider">
              <span>Or add one question manually</span>
            </div>

            <textarea
              placeholder="Question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="admin-form-textarea"
              rows="3"
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
              <option value="">Correct Answer</option>
              {optionA && <option value={optionA}>A: {optionA}</option>}
              {optionB && <option value={optionB}>B: {optionB}</option>}
              {optionC && <option value={optionC}>C: {optionC}</option>}
              {optionD && <option value={optionD}>D: {optionD}</option>}
            </select>

            <button type="button" className="btn-add-inline" onClick={addManualQuestion}>
              + Add Question
            </button>

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

            <div className="admin-form-submit-zone">
              <button type="button" className="btn-admin-back" onClick={() => setStep(2)}>
                Back
              </button>

              <button type="button" className="btn-admin-submit-form" onClick={goNext}>
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="wizard-section">
            <div className="section-mini-title">
              <span>Step 04</span>
              <h2>Ready to Save</h2>
            </div>

            <div className="review-box">
              <h3>{title}</h3>
              <p>{overview}</p>
              <p><strong>Videos:</strong> {selectedVideoIds.length}</p>
              <p><strong>Questions:</strong> {questions.length}</p>
              <p><strong>Passing Score:</strong> {passingScore}%</p>
              <p><strong>Quiz Duration:</strong> {testDuration} seconds</p>
              {uploadStatus && <p>{uploadStatus}</p>}
            </div>

            <div className="admin-form-submit-zone">
              <button type="button" className="btn-admin-back" onClick={() => setStep(3)}>
                Back
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
    </div>
  );
}

export default AddCourse;