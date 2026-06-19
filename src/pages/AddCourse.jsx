import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { push, ref, set } from "firebase/database";
import * as XLSX from "xlsx";
import { database } from "../firebase";
import "../styles/addvideo.css";

function AddCourse() {
  const navigate = useNavigate();

  const departments = ["Sales", "Marketing", "HR", "Production", "Accounts"];

  const [step, setStep] = useState(1);
  const [submittedStep, setSubmittedStep] = useState(false);

  const [department, setDepartment] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");

const [videoFile, setVideoFile] = useState(null);
const [videoUrl, setVideoUrl] = useState("");
const [videoUploading, setVideoUploading] = useState(false);


  const [passingScore, setPassingScore] = useState(70);
  const [testDuration, setTestDuration] = useState(60);
  const [videos, setVideos] = useState([]);

  const [selectedVideoIndex, setSelectedVideoIndex] = useState("");
  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");

  const [excelFile, setExcelFile] = useState(null);
  const [uploading, setUploading] = useState(false);

 
  const steps = [
    { id: 1, label: "Course" },
    { id: 2, label: "Videos" },
    { id: 3, label: "Questions" },
    { id: 4, label: "Review" },
  ];

const uploadVideoToCloudinary = async (file) => {
  if (!file) return;

  const cloudName =
    import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

  const uploadPreset =
    import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    alert(
      "Cloudinary env variables missing. Restart npm run dev."
    );
    return;
  }

  const formData = new FormData();

  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "training-videos");

  try {
    setVideoUploading(true);

    setVideoFile(file);
    setVideoUrl("");

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    console.log("Cloudinary Response:", data);

    if (!response.ok || !data.secure_url) {
      alert(
        data?.error?.message ||
          "Cloudinary upload failed"
      );
      return;
    }

    setVideoUrl(data.secure_url);

    alert(
      "Video uploaded successfully. Now click Add Video to Course."
    );
  } catch (err) {
    console.error(err);
    alert("Upload failed");
  } finally {
    setVideoUploading(false);
  }
};

  const getInputClass = (value) =>
    submittedStep && !String(value).trim()
      ? "admin-form-input input-error"
      : "admin-form-input";

  const getTextareaClass = (value) =>
    submittedStep && !String(value).trim()
      ? "admin-form-textarea input-error"
      : "admin-form-textarea";

  const goToStep = (targetStep) => {
    if (targetStep < step) {
      setSubmittedStep(false);
      setStep(targetStep);
    }
  };

  const validateCourseStep = () => {
    if (!department || !title.trim() || !description.trim()) return false;
    return true;
  };

  const validateVideoStep = () => videos.length > 0;

  const handleNextFromCourse = () => {
    setSubmittedStep(true);

    if (!validateCourseStep()) {
      alert("Please fill all course details");
      return;
    }

    setSubmittedStep(false);
    setStep(2);
  };

  const addVideoToCourse = () => {
    setSubmittedStep(true);

    if (!validateCourseStep()) {
      alert("Please complete course details first");
      return;
    }

   if (!videoTitle.trim() || !videoDescription.trim() || !videoUrl) {
      alert("Please fill all video details");
      return;
    }

const alreadyAdded = videos.some(
  (video) => video.videoUrl === videoUrl
);


    if (alreadyAdded) {
      alert("This video is already added in this course");
      return;
    }

  const newVideo = {
  title: videoTitle.trim(),
  description: videoDescription.trim(),
  videoFileName: videoFile?.name,
  videoUrl,

      passingScore: Number(passingScore),
      testDuration: Number(testDuration),
      questions: [],
    };

    setVideos((prev) => [...prev, newVideo]);

    setVideoTitle("");
    setVideoDescription("");
setVideoFile(null);
setVideoUrl("");
    setPassingScore(70);
    setTestDuration(60);
    setSubmittedStep(false);
  };

  const removeVideo = (index) => {
    const confirmDelete = window.confirm("Remove this video?");
    if (!confirmDelete) return;

    const updatedVideos = videos.filter((_, i) => i !== index);
    setVideos(updatedVideos);
    setSelectedVideoIndex("");
  };

  const handleNextFromVideos = () => {
    setSubmittedStep(true);

    if (!validateVideoStep()) {
      alert("Please add at least one video");
      return;
    }

    setSubmittedStep(false);
    setStep(3);
  };

  const addQuestionToVideo = () => {
    setSubmittedStep(true);

    if (selectedVideoIndex === "") {
      alert("Please select video");
      return;
    }

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

    const updatedVideos = [...videos];
    const index = Number(selectedVideoIndex);

    updatedVideos[index].questions.push({
      question: question.trim(),
      options: [optionA.trim(), optionB.trim(), optionC.trim(), optionD.trim()],
      correctAnswer,
      createdAt: new Date().toISOString(),
      uploadedVia: "manual",
    });

    setVideos(updatedVideos);

    setQuestion("");
    setOptionA("");
    setOptionB("");
    setOptionC("");
    setOptionD("");
    setCorrectAnswer("");
    setSubmittedStep(false);
  };

  const downloadTemplate = () => {
    const worksheetData = [
      ["Question", "OptionA", "OptionB", "OptionC", "OptionD", "CorrectAnswer"],
      ["What is oncology?", "Study of cancer", "Study of heart", "Study of bones", "Study of skin", "A"],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");
    XLSX.writeFile(workbook, "Question_Template.xlsx");
  };

  const handleExcelUpload = () => {
    if (selectedVideoIndex === "") {
      alert("Please select video first");
      return;
    }

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

          let finalCorrectAnswer = correct;
          const key = String(correct).toUpperCase();

          if (key === "A") finalCorrectAnswer = a;
          if (key === "B") finalCorrectAnswer = b;
          if (key === "C") finalCorrectAnswer = c;
          if (key === "D") finalCorrectAnswer = d;

          uploadedQuestions.push({
            question: String(q).trim(),
            options: [String(a).trim(), String(b).trim(), String(c).trim(), String(d).trim()],
            correctAnswer: String(finalCorrectAnswer).trim(),
            createdAt: new Date().toISOString(),
            uploadedVia: "excel",
          });

          addedCount++;
        });

        const updatedVideos = [...videos];
        updatedVideos[Number(selectedVideoIndex)].questions.push(...uploadedQuestions);

        setVideos(updatedVideos);
        setExcelFile(null);
        setUploading(false);

        alert(`Excel Upload Complete\nAdded: ${addedCount}\nSkipped: ${skippedCount}`);
      } catch (error) {
        console.error(error);
        alert("Failed to read Excel file");
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
      alert("Please add at least one video");
      setStep(2);
      return;
    }

    try {
      const courseRef = push(ref(database, "courses"));
      const courseId = courseRef.key;

      await set(courseRef, {
        title: title.trim(),
        description: description.trim(),
        department,
        createdAt: new Date().toISOString(),
      });

      for (const video of videos) {
        const videoRef = push(ref(database, "videos"));
        const videoId = videoRef.key;

        await set(videoRef, {
          title: video.title,
          description: video.description,
          department,
          courseId,
          courseTitle: title.trim(),
          videoFileName: video.videoFileName,
          videoUrl: video.videoUrl,
          passingScore: video.passingScore,
          testDuration: video.testDuration,
          createdAt: new Date().toISOString(),
        });

        for (const q of video.questions) {
          await push(ref(database, `questions/${videoId}`), {
            department,
            courseId,
            videoId,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            createdAt: q.createdAt || new Date().toISOString(),
            uploadedVia: q.uploadedVia || "manual",
          });
        }
      }

      alert("Course saved successfully");
      navigate("/admin/courses");
    } catch (error) {
      console.error(error);
      alert("Failed to save course");
    }
  };

  return (
    <div className="admin-form-container course-wizard-page">
      <div className="wizard-topbar">
        <Link to="/admin" className="btn-admin-back">
          ← Back to Admin Dashboard
        </Link>

        <img src="/Logo.webp" alt="Zuvius Lifesciences" className="wizard-logo" />
      </div>

      <div className="admin-form-card wizard-card">
        <div className="wizard-header">
          <h1 className="admin-form-title">Add New Course</h1>
          <p className="admin-form-subtitle">
            Create course, add videos and attach questions in one smooth flow.
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
              <label className="admin-field-label">Department *</label>
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setVideos([]);
                  setSelectedVideoIndex("");
                }}
                className={getInputClass(department)}
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">Course / Product Name *</label>
              <input
                placeholder="e.g., Breast Cancer Awareness"
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
              <h2>Add Videos</h2>
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">Video Title *</label>
              <input
                placeholder="e.g., Introduction Video"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                className={getInputClass(videoTitle)}
              />
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">Video Description *</label>
              <textarea
                placeholder="Short video description..."
                value={videoDescription}
                onChange={(e) => setVideoDescription(e.target.value)}
                className={getTextareaClass(videoDescription)}
                rows="3"
              />
            </div>

            <div className="admin-input-group">
             <div className="admin-input-group">
  <label className="admin-field-label">
    Upload Video *
  </label>

  <input
    type="file"
    accept="video/*"
    onChange={(e) =>
      uploadVideoToCloudinary(
        e.target.files?.[0]
      )
    }
    className="admin-form-input"
  />

  {videoUploading && (
    <p>Uploading Video...</p>
  )}

  {videoUrl && (
    <p>
      Uploaded:
      {" "}
      {videoFile?.name}
    </p>
  )}
</div>
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

       <button
  type="button"
  className="btn-add-inline"
  onClick={addVideoToCourse}
  disabled={videoUploading || !videoUrl}
>
  {videoUploading
    ? "Uploading Video..."
    : "+ Add Video to Course"}
</button>

            {videos.length > 0 && (
              <div className="added-list-box">
                <h3>Added Videos</h3>
                {videos.map((video, index) => (
                  <div key={`${video.videoFileName}-${index}`} className="added-row">
                    <div>
                      <strong>
                        {index + 1}. {video.title}
                      </strong>
                      <p>{video.videoFileName}</p>
                    </div>

                    <button type="button" onClick={() => removeVideo(index)} className="btn-remove-small">
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

              <button type="button" className="btn-admin-submit-form" onClick={handleNextFromVideos}>
                Next: Add Questions
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="admin-core-form wizard-section">
            <div className="section-mini-title">
              <span>Step 03</span>
              <h2>Add Questions</h2>
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">Select Video *</label>
              <select
                value={selectedVideoIndex}
                onChange={(e) => setSelectedVideoIndex(e.target.value)}
                className={getInputClass(selectedVideoIndex)}
              >
                <option value="">Select Video</option>
                {videos.map((video, index) => (
                  <option key={`${video.title}-${index}`} value={index}>
                    {video.title}
                  </option>
                ))}
              </select>
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

                <button type="button" onClick={handleExcelUpload} className="btn-excel-upload" disabled={uploading}>
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
              <input placeholder="Option A *" value={optionA} onChange={(e) => setOptionA(e.target.value)} className={getInputClass(optionA)} />
              <input placeholder="Option B *" value={optionB} onChange={(e) => setOptionB(e.target.value)} className={getInputClass(optionB)} />
            </div>

            <div className="admin-form-row-split">
              <input placeholder="Option C *" value={optionC} onChange={(e) => setOptionC(e.target.value)} className={getInputClass(optionC)} />
              <input placeholder="Option D *" value={optionD} onChange={(e) => setOptionD(e.target.value)} className={getInputClass(optionD)} />
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">Correct Answer *</label>
              <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} className={getInputClass(correctAnswer)}>
                <option value="">Select Correct Answer</option>
                {optionA && <option value={optionA}>Option A: {optionA}</option>}
                {optionB && <option value={optionB}>Option B: {optionB}</option>}
                {optionC && <option value={optionC}>Option C: {optionC}</option>}
                {optionD && <option value={optionD}>Option D: {optionD}</option>}
              </select>
            </div>

            <button type="button" className="btn-add-inline" onClick={addQuestionToVideo}>
              + Add Manual Question
            </button>

            <div className="added-list-box">
              <h3>Questions Summary</h3>
              {videos.map((video, index) => (
                <div key={`${video.title}-${index}`} className="added-row">
                  <div>
                    <strong>{video.title}</strong>
                    <p>{video.questions.length} questions added</p>
                  </div>
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
              <p>{description}</p>

              <div className="review-video-list">
                {videos.map((video, index) => (
                  <div key={`${video.videoFileName}-${index}`} className="review-video-card">
                    <h4>
                      {index + 1}. {video.title}
                    </h4>
                    <p>{video.videoFileName}</p>
                    <span>{video.questions.length} questions</span>
                  </div>
                ))}
              </div>
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