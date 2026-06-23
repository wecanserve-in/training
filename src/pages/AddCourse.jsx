import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, push, ref, set } from "firebase/database";
import * as XLSX from "xlsx";
import { auth, database } from "../firebase";
import "../styles/addvideo.css";

function AddCourse() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [submittedStep, setSubmittedStep] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);

  const [currentUser, setCurrentUser] = useState(null);
  const [department, setDepartment] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [passingScore, setPassingScore] = useState(70);
  const [testDuration, setTestDuration] = useState(60);

  const [videos, setVideos] = useState([]);
  const [videoUploading, setVideoUploading] = useState(false);

  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [questions, setQuestions] = useState([]);

  const [excelFile, setExcelFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const steps = [
    { id: 1, label: "Course" },
    { id: 2, label: "Videos" },
    { id: 3, label: "Quiz" },
    { id: 4, label: "Review" },
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
        ...userSnap.val(),
      };

      if (userData.role !== "departmentAdmin") {
        alert("Only Department Admin can create department courses");
        navigate("/");
        return;
      }

      setCurrentUser(userData);
      setDepartment(userData.department || "");
      setLoadingUser(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const getInputClass = (value) =>
    submittedStep && !String(value).trim()
      ? "admin-form-input input-error"
      : "admin-form-input";

  const getTextareaClass = (value) =>
    submittedStep && !String(value).trim()
      ? "admin-form-textarea input-error"
      : "admin-form-textarea";

  const validateCourseStep = () => {
    return department && title.trim() && description.trim();
  };

  const validateVideoStep = () => videos.length > 0;

  const validateQuizSettings = () => {
    const score = Number(passingScore);
    const duration = Number(testDuration);

    return score >= 0 && score <= 100 && duration >= 5;
  };

  const goToStep = (targetStep) => {
    if (targetStep < step) {
      setSubmittedStep(false);
      setStep(targetStep);
    }
  };

  const handleNextFromCourse = () => {
    setSubmittedStep(true);

    if (!validateCourseStep()) {
      alert("Please fill all course details");
      return;
    }

    if (!validateQuizSettings()) {
      alert("Passing score must be 0-100 and duration must be at least 5 seconds");
      return;
    }

    setSubmittedStep(false);
    setStep(2);
  };

  const uploadSingleVideoToCloudinary = async (file) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error("Cloudinary env variables missing. Restart npm run dev.");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", `training-videos/${department || "General"}`);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok || !data.secure_url) {
      throw new Error(data?.error?.message || "Cloudinary upload failed");
    }

    return {
      title: file.name.replace(/\.[^/.]+$/, ""),
      description: "",
      videoFileName: file.name,
      videoUrl: data.secure_url,
      cloudinaryPublicId: data.public_id || "",
      createdAt: new Date().toISOString(),
    };
  };

  const handleMultipleVideoUpload = async (fileList) => {
  const files = Array.from(fileList || []).filter((file) => {
  return (
    file.type.startsWith("video/") ||
    /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(file.name)
  );
});
    if (files.length === 0) {
      alert("Please select video files only");
      return;
    }

    const existingNames = new Set(videos.map((video) => video.videoFileName));
    const newFiles = files.filter((file) => !existingNames.has(file.name));

    if (newFiles.length === 0) {
      alert("Selected videos are already added");
      return;
    }

    try {
      setVideoUploading(true);

      const uploadedVideos = [];

      for (const file of newFiles) {
        const uploadedVideo = await uploadSingleVideoToCloudinary(file);
        uploadedVideos.push(uploadedVideo);
      }

      setVideos((prev) => [...prev, ...uploadedVideos]);

      alert(`${uploadedVideos.length} video(s) uploaded successfully`);
    } catch (error) {
      console.error(error);
      alert(error.message || "Video upload failed");
    } finally {
      setVideoUploading(false);
    }
  };

  const updateVideoField = (index, field, value) => {
    setVideos((prev) =>
      prev.map((video, i) =>
        i === index
          ? {
              ...video,
              [field]: value,
            }
          : video
      )
    );
  };

  const removeVideo = (index) => {
    if (!window.confirm("Remove this video?")) return;

    setVideos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNextFromVideos = () => {
    setSubmittedStep(true);

    if (!validateVideoStep()) {
      alert("Please upload at least one video");
      return;
    }

    const incompleteVideo = videos.some((video) => !video.title.trim());

    if (incompleteVideo) {
      alert("Please add title for every video");
      return;
    }

    setSubmittedStep(false);
    setStep(3);
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
    setSubmittedStep(true);

    if (
      !question.trim() ||
      !optionA.trim() ||
      !optionB.trim() ||
      !optionC.trim() ||
      !optionD.trim() ||
      !correctAnswer
    ) {
      alert("Please fill complete question details");
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
    setSubmittedStep(false);
  };

  const removeQuestion = (index) => {
    if (!window.confirm("Remove this question?")) return;

    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const downloadTemplate = () => {
    const worksheetData = [
      ["Question", "OptionA", "OptionB", "OptionC", "OptionD", "CorrectAnswer"],
      [
        "What is oncology?",
        "Study of cancer",
        "Study of heart",
        "Study of bones",
        "Study of skin",
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
      alert("Please upload Excel file");
      return;
    }

    setUploading(true);

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet);

        if (rows.length === 0) {
          alert("Excel sheet is empty");
          setUploading(false);
          return;
        }

        let addedCount = 0;
        let skippedCount = 0;
        const uploadedQuestions = [];

        rows.forEach((row) => {
          const q = row.Question || row.question;
          const a = row.OptionA || row.optionA;
          const b = row.OptionB || row.optionB;
          const c = row.OptionC || row.optionC;
          const d = row.OptionD || row.optionD;
          const correct = row.CorrectAnswer || row.correctAnswer;

          if (!q || !a || !b || !c || !d || !correct) {
            skippedCount++;
            return;
          }

          let finalCorrectAnswer = String(correct).trim();
          const key = String(correct).trim().toUpperCase();

          if (key === "A") finalCorrectAnswer = String(a).trim();
          if (key === "B") finalCorrectAnswer = String(b).trim();
          if (key === "C") finalCorrectAnswer = String(c).trim();
          if (key === "D") finalCorrectAnswer = String(d).trim();

          uploadedQuestions.push({
            question: String(q).trim(),
            options: [
              String(a).trim(),
              String(b).trim(),
              String(c).trim(),
              String(d).trim(),
            ],
            correctAnswer: finalCorrectAnswer,
            createdAt: new Date().toISOString(),
            uploadedVia: "excel",
          });

          addedCount++;
        });

        setQuestions((prev) => [...prev, ...uploadedQuestions]);
        setExcelFile(null);

        alert(`Excel Upload Complete\nAdded: ${addedCount}\nSkipped: ${skippedCount}`);
      } catch (error) {
        console.error(error);
        alert("Failed to read Excel file");
      } finally {
        setUploading(false);
      }
    };

    reader.onerror = () => {
      alert("Failed to upload Excel file");
      setUploading(false);
    };

    reader.readAsArrayBuffer(excelFile);
  };

  const handleSaveCourse = async () => {
    if (!validateCourseStep()) {
      alert("Please complete course details");
      setStep(1);
      return;
    }

    if (!validateVideoStep()) {
      alert("Please upload at least one video");
      setStep(2);
      return;
    }

    if (!validateQuizSettings()) {
      alert("Please check passing score and quiz duration");
      setStep(1);
      return;
    }

    if (questions.length === 0) {
      const confirmSave = window.confirm(
        "No quiz questions added. Do you still want to save this course?"
      );

      if (!confirmSave) {
        setStep(3);
        return;
      }
    }

    try {
      const courseRef = push(ref(database, "courses"));
      const courseId = courseRef.key;

      await set(courseRef, {
        title: title.trim(),
        description: description.trim(),
        department,
        passingScore: Number(passingScore),
        testDuration: Number(testDuration),
        totalVideos: videos.length,
        totalQuestions: questions.length,
        createdBy: currentUser?.id || "",
        createdByName: currentUser?.name || "",
        createdByRole: "departmentAdmin",
        createdAt: new Date().toISOString(),
      });

      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        const videoRef = push(ref(database, "videos"));

        await set(videoRef, {
          title: video.title.trim(),
          description: video.description.trim(),
          department,
          courseId,
          courseTitle: title.trim(),
          videoFileName: video.videoFileName,
          videoUrl: video.videoUrl,
          cloudinaryPublicId: video.cloudinaryPublicId || "",
          order: i + 1,
          createdBy: currentUser?.id || "",
          createdAt: video.createdAt || new Date().toISOString(),
        });
      }

      for (const q of questions) {
        await push(ref(database, `questions/${courseId}`), {
          department,
          courseId,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          createdAt: q.createdAt || new Date().toISOString(),
          uploadedVia: q.uploadedVia || "manual",
        });
      }

      alert("Course saved successfully");
      navigate("/department-admin/courses");
    } catch (error) {
      console.error(error);
      alert("Failed to save course");
    }
  };

  if (loadingUser) {
    return <div className="admin-form-container">Loading...</div>;
  }

  return (
    <div className="admin-form-container course-wizard-page">
      <div className="wizard-topbar">
        <Link to="/department-admin" className="btn-admin-back">
          ← Back to Department Dashboard
        </Link>

        <img src="/Logo.webp" alt="Logo" className="wizard-logo" />
      </div>

      <div className="admin-form-card wizard-card">
        <div className="wizard-header">
          <h1 className="admin-form-title">Create Department Course</h1>
          <p className="admin-form-subtitle">
            Create course, upload multiple videos and add one overall course quiz.
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
              onClick={() => goToStep(item.id)}
            >
              <span className="circle-number">{step > item.id ? "✓" : item.id}</span>
              <span className="circle-label">{item.label}</span>
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="admin-core-form wizard-section">
            <div className="section-mini-title">
              <span>Step 01</span>
              <h2>Course Details</h2>
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">Department</label>
              <input value={department} className="admin-form-input" disabled />
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">Course Name *</label>
              <input
                placeholder="e.g., Product Training"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={getInputClass(title)}
              />
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">Course Description *</label>
              <textarea
                placeholder="Write short course summary..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={getTextareaClass(description)}
                rows="4"
              />
            </div>

            <div className="admin-form-row-split">
              <div className="admin-input-group">
                <label className="admin-field-label">Passing Score (%) *</label>
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
                <label className="admin-field-label">Quiz Duration (Seconds) *</label>
                <input
                  type="number"
                  min="5"
                  value={testDuration}
                  onChange={(e) => setTestDuration(e.target.value)}
                  className="admin-form-input"
                />
              </div>
            </div>

            <div className="admin-form-submit-zone">
              <button type="button" className="btn-admin-submit-form" onClick={handleNextFromCourse}>
                Next: Add Videos
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="admin-core-form wizard-section">
            <div className="section-mini-title">
              <span>Step 02</span>
              <h2>Upload Course Videos</h2>
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">Upload Multiple Videos / Folder *</label>

             <label className="admin-field-label">
  Upload Multiple Videos
</label>

<input
  type="file"
  accept="video/*"
  multiple
  onChange={(e) => handleMultipleVideoUpload(e.target.files)}
  className="admin-form-input"
  disabled={videoUploading}
/>

<small className="field-hint-text">
  Select multiple videos at once
</small>

<br />
<br />

<label className="admin-field-label">
  Upload Full Folder
</label>

<input
  type="file"
  multiple
  webkitdirectory=""
  directory=""
  onChange={(e) => handleMultipleVideoUpload(e.target.files)}
  className="admin-form-input"
  disabled={videoUploading}
/>

<small className="field-hint-text">
  Select a complete folder containing videos
</small>

              <small className="field-hint-text">
                You can select multiple videos or a full folder. Videos will upload one by one.
              </small>

              {videoUploading && <p>Uploading videos, please wait...</p>}
            </div>

            {videos.length > 0 && (
              <div className="added-list-box">
                <h3>Added Videos</h3>

                {videos.map((video, index) => (
                  <div key={`${video.videoFileName}-${index}`} className="added-row">
                    <div style={{ width: "100%" }}>
                      <strong>
                        {index + 1}. {video.videoFileName}
                      </strong>

                      <input
                        placeholder="Video title"
                        value={video.title}
                        onChange={(e) => updateVideoField(index, "title", e.target.value)}
                        className="admin-form-input"
                      />

                      <textarea
                        placeholder="Video description optional"
                        value={video.description}
                        onChange={(e) =>
                          updateVideoField(index, "description", e.target.value)
                        }
                        className="admin-form-textarea"
                        rows="2"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeVideo(index)}
                      className="btn-remove-small"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="admin-form-submit-zone">
              <button type="button" className="btn-admin-back" onClick={() => setStep(1)}>
                Back
              </button>

              <button
                type="button"
                className="btn-admin-submit-form"
                onClick={handleNextFromVideos}
                disabled={videoUploading}
              >
                Next: Add Overall Quiz
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="admin-core-form wizard-section">
            <div className="section-mini-title">
              <span>Step 03</span>
              <h2>Overall Course Quiz</h2>
            </div>

            <div className="excel-upload-card compact-excel">
              <h3>Bulk Upload Questions</h3>
              <p>
                Upload Excel with columns:
                <strong> Question, OptionA, OptionB, OptionC, OptionD, CorrectAnswer</strong>
              </p>

              <div className="excel-actions">
                <button type="button" onClick={downloadTemplate} className="btn-template-download">
                  Download Template
                </button>

                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                  className="excel-file-input"
                />

                <button
                  type="button"
                  onClick={handleExcelUpload}
                  className="btn-excel-upload"
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload Excel"}
                </button>
              </div>
            </div>

            <div className="manual-divider">
              <span>Or add manually</span>
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">Question *</label>
              <textarea
                placeholder="Type question..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className={getTextareaClass(question)}
                rows="3"
              />
            </div>

            <div className="admin-form-row-split">
              <input
                placeholder="Option A *"
                value={optionA}
                onChange={(e) => setOptionA(e.target.value)}
                className={getInputClass(optionA)}
              />

              <input
                placeholder="Option B *"
                value={optionB}
                onChange={(e) => setOptionB(e.target.value)}
                className={getInputClass(optionB)}
              />
            </div>

            <div className="admin-form-row-split">
              <input
                placeholder="Option C *"
                value={optionC}
                onChange={(e) => setOptionC(e.target.value)}
                className={getInputClass(optionC)}
              />

              <input
                placeholder="Option D *"
                value={optionD}
                onChange={(e) => setOptionD(e.target.value)}
                className={getInputClass(optionD)}
              />
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">Correct Answer *</label>

              <select
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                className={getInputClass(correctAnswer)}
              >
                <option value="">Select Correct Answer</option>
                {optionA && <option value={optionA}>Option A: {optionA}</option>}
                {optionB && <option value={optionB}>Option B: {optionB}</option>}
                {optionC && <option value={optionC}>Option C: {optionC}</option>}
                {optionD && <option value={optionD}>Option D: {optionD}</option>}
              </select>
            </div>

            <button type="button" className="btn-add-inline" onClick={addManualQuestion}>
              + Add Question
            </button>

            <div className="added-list-box">
              <h3>Questions Added: {questions.length}</h3>

              {questions.map((item, index) => (
                <div key={`${item.question}-${index}`} className="added-row">
                  <div>
                    <strong>
                      {index + 1}. {item.question}
                    </strong>
                    <p>Correct: {item.correctAnswer}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    className="btn-remove-small"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="admin-form-submit-zone">
              <button type="button" className="btn-admin-back" onClick={() => setStep(2)}>
                Back
              </button>

              <button
                type="button"
                className="btn-admin-submit-form"
                onClick={() => {
                  setSubmittedStep(false);
                  setStep(4);
                }}
              >
                Review Course
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="admin-core-form wizard-section">
            <div className="section-mini-title">
              <span>Step 04</span>
              <h2>Review & Save</h2>
            </div>

            <div className="review-box">
              <h3>{title}</h3>

              <p>
                <strong>Department:</strong> {department}
              </p>

              <p>
                <strong>Passing Score:</strong> {passingScore}%
              </p>

              <p>
                <strong>Quiz Duration:</strong> {testDuration} seconds
              </p>

              <p>{description}</p>

              <div className="review-video-list">
                {videos.map((video, index) => (
                  <div key={`${video.videoFileName}-${index}`} className="review-video-card">
                    <h4>
                      {index + 1}. {video.title}
                    </h4>
                    <p>{video.videoFileName}</p>
                  </div>
                ))}
              </div>

              <p>
                <strong>Total Questions:</strong> {questions.length}
              </p>
            </div>

            <div className="admin-form-submit-zone">
              <button type="button" className="btn-admin-back" onClick={() => setStep(3)}>
                Back
              </button>

              <button type="button" className="btn-admin-submit-form" onClick={handleSaveCourse}>
                Save Complete Course
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AddCourse;