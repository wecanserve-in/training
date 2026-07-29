import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaVideo, FaImage, FaFileExcel } from "react-icons/fa";
import { onAuthStateChanged } from "firebase/auth";
import { get, push, ref, set } from "firebase/database";
import * as XLSX from "xlsx";
import { auth, database } from "../firebase";
import { createNotification } from "../services/doubtService";
import "../styles/videolibrary.css";


const createSafeCloudinarySlug = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function DepartmentUploadVideo() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [department, setDepartment] = useState("");
  const [departmentType, setDepartmentType] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");

  const [tags, setTags] = useState([]);

  const [quizQuestions, setQuizQuestions] = useState([]);
  const [excelFile, setExcelFile] = useState(null);

  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");

  const [uploading, setUploading] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [modalMessage, setModalMessage] = useState("Preparing upload...");

  const [videoDragOver, setVideoDragOver] = useState(false);
  const [thumbnailDragOver, setThumbnailDragOver] = useState(false);
  const [excelDragOver, setExcelDragOver] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const videoInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);
  const excelInputRef = useRef(null);

  const isDeptAdmin = String(currentUser?.role || "").toLowerCase().replace(/[\s_-]/g, "") === "departmentadmin";
  const normalizedRole = String(currentUser?.role || "")
  .toLowerCase()
  .replace(/[\s_-]/g, "");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) return;

      const userSnap = await get(ref(database, `users/${loggedUser.uid}`));
      if (!userSnap.exists()) return;

      const userData = {
        id: loggedUser.uid,
        email: loggedUser.email,
        ...userSnap.val(),
      };

      setCurrentUser(userData);

      if (String(userData.role || "").toLowerCase().replace(/[\s_-]/g, "") === "departmentadmin") {
        let deptName = userData.department || "";
        let deptType = userData.departmentType || "";
        let deptId = userData.departmentId || "";

        if (!deptName || !deptType || !deptId) {
          const deptSnap = await get(ref(database, "departments"));
          if (deptSnap.exists()) {
            const depts = deptSnap.val();
            const match = Object.entries(depts).find(
              ([, d]) => d.departmentAdminId === loggedUser.uid
            );
            if (match) {
              deptId = deptId || match[0];
              deptName = deptName || match[1].departmentName || "";
              deptType = deptType || match[1].departmentType || "";
            }
          }
        }

        setDepartment(deptName);
        setDepartmentType(deptType);
        setSelectedDepartmentId(deptId);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (String(currentUser?.role || "").toLowerCase().replace(/[\s_-]/g, "") === "departmentadmin") return;

    const fetchDepartments = async () => {
      const snap = await get(ref(database, "departments"));
      if (!snap.exists()) return;

      const data = snap.val();
      const list = Object.entries(data).map(([id, dept]) => ({
        id,
        name: dept.departmentName,
        type: dept.departmentType,
      }));

      setDepartments(list);
    };

    fetchDepartments();
  }, [currentUser]);

  const handleDepartmentChange = (deptId) => {
    setSelectedDepartmentId(deptId);
    const dept = departments.find((d) => d.id === deptId);
    if (dept) {
      setDepartment(dept.name);
      setDepartmentType(dept.type);
    }
  };

  const getVideoDuration = (file) => {
    return new Promise((resolve) => {
      if (!file) return resolve(0);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(Math.round(video.duration || 0));
      };
      video.onerror = () => resolve(0);
      video.src = URL.createObjectURL(file);
    });
  };

  const buildCloudinaryThumbnail = (publicId) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    if (!cloudName || !publicId) return "";
    return `https://res.cloudinary.com/${cloudName}/video/upload/so_2,w_800,h_450,c_fill,q_auto,f_jpg/${publicId}.jpg`;
  };

  const uploadFileToCloudinary = async (file, resourceType, baseFolder, departmentName) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error("Cloudinary env variables missing.");
    }

    if (!file) {
      throw new Error("Please select a file before uploading.");
    }

    const safeDepartment =
      createSafeCloudinarySlug(departmentName) || "general";

    const safeFolder = `${baseFolder}/${safeDepartment}`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", safeFolder);

    /*
      Do not send a custom public_id from the frontend.
      Cloudinary will generate a valid public ID automatically.
    */

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const responseText = await response.text();

    let data = {};

    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error("Cloudinary did not return valid JSON.");
    }

    if (!response.ok || !data.secure_url) {
      throw new Error(
        data?.error?.message || `Upload failed (${response.status})`
      );
    }

    return data;
  };

  const uploadAssets = async () => {
    setUploadStatus("Uploading video...");
    setModalMessage("Uploading video...");

    const videoData = await uploadFileToCloudinary(
      videoFile,
      "video",
      "training-portal/videos",
      department
    );

    let thumbnailUrl = buildCloudinaryThumbnail(videoData.public_id);
    let thumbnailPublicId = "";

    if (thumbnailFile) {
      setUploadStatus("Uploading thumbnail...");
      setModalMessage("Uploading thumbnail...");
      const thumbnailData = await uploadFileToCloudinary(
        thumbnailFile,
        "image",
        "training-portal/thumbnails",
        department
      );
      thumbnailUrl = thumbnailData.secure_url;
      thumbnailPublicId = thumbnailData.public_id || "";
    }

    const durationSeconds = await getVideoDuration(videoFile);

    return {
      storageProvider: "cloudinary",
      provider: "cloudinary",
      assetType: "video",
      videoUrl: videoData.secure_url,
      playbackUrl: videoData.secure_url,
      providerPublicId: videoData.public_id || "",
      cloudinaryPublicId: videoData.public_id || "",
      thumbnailUrl,
      thumbnailProviderPublicId: thumbnailPublicId,
      durationSeconds,
      fileSizeBytes: videoFile?.size || 0,
      videoFileName: videoFile?.name || "",
      thumbnailFileName: thumbnailFile?.name || "",
      migrationReady: true,
    };
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
  };

  const downloadQuizTemplate = () => {
    const worksheetData = [
      ["Question", "OptionA", "OptionB", "OptionC", "OptionD", "CorrectAnswer"],
      ["What is the main objective of this video?", "Understand the topic", "Review company process", "Product learning", "None", "A"],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Quiz Questions");
    XLSX.writeFile(workbook, "Quiz_Template.xlsx");
  };

  const uploadQuizExcel = (selectedFile = excelFile) => {
    if (!selectedFile) { alert("Please select Excel file first."); return; }

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

        setQuizQuestions((prev) => [...prev, ...uploadedQuestions]);
        setExcelFile(null);
        setSuccessMessage(`${uploadedQuestions.length} questions imported successfully.`);
        setShowSuccessModal(true);
      } catch {
        setSuccessMessage("Unable to read Excel file.");
        setShowSuccessModal(true);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const saveVideo = async (e) => {
    e.preventDefault();

    if (!department) { alert("Please select a department."); return; }
    if (!title || !description || !videoFile) { alert("Please fill title, description and video file."); return; }

    if (quizQuestions.length === 0) {
      const confirmSave = window.confirm("No quiz questions added. Do you still want to save this video?");
      if (!confirmSave) return;
    }

    try {
      setUploading(true);
      setShowUploadModal(true);
      setUploadStatus("Preparing upload...");
      setModalMessage("Preparing upload...");

      const uploaded = await uploadAssets();

      setUploadStatus("Saving details...");
      setModalMessage("Saving details...");

      const videoRef = push(ref(database, "videoLibrary"));
      const videoId = videoRef.key;

      await set(videoRef, {
        title: title.trim(),
        description: description.trim(),
        department,
        departmentType,
        departmentId: selectedDepartmentId,
        tags,
        totalQuizQuestions: quizQuestions.length,
        hasQuiz: quizQuestions.length > 0,
        storageProvider: uploaded.storageProvider,
        provider: uploaded.provider,
        assetType: uploaded.assetType,
        videoUrl: uploaded.videoUrl,
        playbackUrl: uploaded.playbackUrl,
        thumbnailUrl: uploaded.thumbnailUrl,
        providerPublicId: uploaded.providerPublicId,
        cloudinaryPublicId: uploaded.cloudinaryPublicId,
        thumbnailProviderPublicId: uploaded.thumbnailProviderPublicId,
        durationSeconds: uploaded.durationSeconds,
        fileSizeBytes: uploaded.fileSizeBytes,
        videoFileName: uploaded.videoFileName,
        thumbnailFileName: uploaded.thumbnailFileName,
        migrationReady: true,
        createdBy: currentUser?.id || "",
        createdByName: currentUser?.name || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "active",
      });

      for (const q of quizQuestions) {
        await push(ref(database, `videoQuizzes/${videoId}`), {
          ...q,
          videoId,
          department,
          departmentType,
          createdAt: q.createdAt || new Date().toISOString(),
        });
      }

      try {
        const usersSnap = await get(ref(database, "users"));
        if (usersSnap.exists()) {
          const allUsers = usersSnap.val();
          const notifyPromises = [];
          Object.entries(allUsers).forEach(([uid, u]) => {
            if (uid === currentUser?.id) return;
            const userDept = String(u.department || "").trim();
            const videoDept = String(department || "").trim();
            if (userDept && videoDept && userDept === videoDept) {
              notifyPromises.push(
                createNotification(uid, {
                  type: "new_video",
                  title: "New Training Video",
                  message: `${currentUser?.name || "Admin"} uploaded a new training video "${title.trim()}" in ${department}`,
                })
              );
            }
          });
          await Promise.all(notifyPromises);
        }
      } catch (notifError) {
        console.error("Failed to send notifications:", notifError);
      }

      setTitle("");
      setDescription("");
      setVideoFile(null);
      setThumbnailFile(null);
      setTags([]);
      setQuizQuestions([]);
      setExcelFile(null);
      setUploadStatus("");
      resetQuestionForm();

      const libraryPath =
        normalizedRole === "superadmin"
          ? "/super-admin/video-library"
          : normalizedRole === "admin"
          ? "/admin/video-library"
          : "/department-admin/video-library";

      setSuccessMessage(
        "Training video saved successfully. Redirecting to the video library..."
      );
      setShowSuccessModal(true);

      window.setTimeout(() => {
        setShowSuccessModal(false);
        navigate(libraryPath, { replace: true });
      }, 1200);
    } catch (error) {
      setSuccessMessage(error.message || "Upload failed.");
      setShowSuccessModal(true);
    } finally {
      setUploading(false);
      setShowUploadModal(false);
    }
  };

  const handleDragOver = (e, setDragOver) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e, setDragOver) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e, setDragOver, setFile, acceptType) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith(acceptType + "/")) {
        setFile(file);
      }
    }
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  return (
    <div className="video-library-page">

      <div className="video-library-header">
        <div>
          <span>Upload Training</span>
          <h1>Add Training Video</h1>
          <p>Simple flow: details, filters, files, quiz, then save.</p>
        </div>
       <Link
  to={
    !currentUser
      ? "#"
      : normalizedRole === "superadmin"
      ? "/super-admin/video-library"
      : normalizedRole === "admin"
      ? "/admin/video-library"
      : "/department-admin/video-library"
  }
  className="view-library-btn"
  onClick={(e) => {
    if (!currentUser) e.preventDefault();
  }}
>
  View Library
</Link>
      </div>

      <form className="video-upload-layout" onSubmit={saveVideo}>
        <div className="video-library-card">
          <div className="form-step-title">
            <span>1</span>
            <div>
              <h2>Video Details</h2>
              <p>Add basic information for this training video.</p>
            </div>
          </div>

          {!isDeptAdmin ? (
            <div className="department-type-pill">
              <span>Department</span>
              <select
                value={selectedDepartmentId}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontWeight: 600,
                  color: "#059669",
                  fontSize: "0.85rem",
                  padding: 0,
                  flex: 1,
                }}
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.type})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="department-type-pill">
              <span>Department</span>
              <strong>{department || "-"}</strong>
              <small>{departmentType || "No department type selected"}</small>
            </div>
          )}

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
                      ×
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
                    if (!tags.includes(tag)) {
                      setTags([...tags, tag]);
                    }
                  }}
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="form-step-title">
            <span>2</span>
            <div>
              <h2>Upload Files</h2>
              <p>Thumbnail is optional. If skipped, it will be generated from the video.</p>
            </div>
          </div>

          <div className="upload-flow">
            <div className="upload-flow-item">
              <div className="upload-flow-content">
                <h3>Upload Training Video *</h3>
                <p>Select the main training video file.</p>
                <label className="vertical-upload-box">
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  />
                  <div
                    className={`upload-placeholder ${videoFile ? "has-file" : ""} ${videoDragOver ? "dragover" : ""}`}
                    onDragOver={(e) => handleDragOver(e, setVideoDragOver)}
                    onDragLeave={(e) => handleDragLeave(e, setVideoDragOver)}
                    onDrop={(e) => handleDrop(e, setVideoDragOver, setVideoFile, "video")}
                    onClick={() => videoInputRef.current?.click()}
                  >
                    <FaVideo />
                    <span>{videoFile ? videoFile.name : "Drag & drop or click to upload"}</span>
                    <small>MP4, MOV supported</small>
                  </div>
                </label>
              </div>
            </div>

            <div className="upload-flow-item">
              <div className="upload-flow-content">
                <h3>Upload Thumbnail (Optional)</h3>
                <p> System can auto-generate one.</p>
                <label className="vertical-upload-box">
                  <input
                    ref={thumbnailInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                  />
                  <div
                    className={`upload-placeholder ${thumbnailFile ? "has-file" : ""} ${thumbnailDragOver ? "dragover" : ""}`}
                    onDragOver={(e) => handleDragOver(e, setThumbnailDragOver)}
                    onDragLeave={(e) => handleDragLeave(e, setThumbnailDragOver)}
                    onDrop={(e) => handleDrop(e, setThumbnailDragOver, setThumbnailFile, "image")}
                    onClick={() => thumbnailInputRef.current?.click()}
                  >
                    <FaImage />
                    <span>{thumbnailFile ? thumbnailFile.name : "Drag & drop or click to upload"}</span>
                    <small>PNG, JPG supported</small>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {uploadStatus && <p className="upload-status">{uploadStatus}</p>}
        </div>

        <div className="video-library-card quiz-side-card">
          <div className="form-step-title">
            <span>3</span>
            <div>
              <h2>Learning Quiz</h2>
              <p>Upload Excel or add questions manually.</p>
            </div>
          </div>

          <div className="excel-upload-flow">
            <label className="vertical-upload-box">
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setExcelFile(file);
                  uploadQuizExcel(file);
                }}
              />
              <div
                className={`upload-placeholder ${excelFile ? "has-file" : ""} ${excelDragOver ? "dragover" : ""}`}
                onDragOver={(e) => handleDragOver(e, setExcelDragOver)}
                onDragLeave={(e) => handleDragLeave(e, setExcelDragOver)}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setExcelDragOver(false);
                  const files = e.dataTransfer.files;
                  if (files && files.length > 0) {
                    const file = files[0];
                    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv")) {
                      setExcelFile(file);
                      uploadQuizExcel(file);
                    }
                  }
                }}
                onClick={() => excelInputRef.current?.click()}
              >
                <FaFileExcel />
                <span>{excelFile ? excelFile.name : "Drag & drop or click to upload Excel"}</span>
                <small>.xlsx, .xls, .csv supported</small>
              </div>
            </label>
          </div>

          <button type="button" className="outline-action-btn" onClick={downloadQuizTemplate}>
            Download Sample Template
          </button>

          <textarea 
            placeholder="Question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows="2"
          />

          <div className="quiz-options-grid">
            <input placeholder="Option A" value={optionA} onChange={(e) => setOptionA(e.target.value)} />
            <input placeholder="Option B" value={optionB} onChange={(e) => setOptionB(e.target.value)} />
            <input placeholder="Option C" value={optionC} onChange={(e) => setOptionC(e.target.value)} />
            <input placeholder="Option D" value={optionD} onChange={(e) => setOptionD(e.target.value)} />
          </div>

          <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)}>
            <option value="">Select Correct Answer</option>
            {optionA && <option value={optionA}>A: {optionA}</option>}
            {optionB && <option value={optionB}>B: {optionB}</option>}
            {optionC && <option value={optionC}>C: {optionC}</option>}
            {optionD && <option value={optionD}>D: {optionD}</option>}
          </select>

          <button type="button" className="add-question-btn" onClick={addQuizQuestion}>
            + Add This Question
          </button>

          {quizQuestions.length > 0 && (
            <div className="library-question-list">
              <h3>Questions Added: {quizQuestions.length}</h3>
              {quizQuestions.map((item, index) => (
                <div className="library-question-row" key={index}>
                  <div>
                    <strong>{index + 1}. {item.question}</strong>
                    <p>Correct: {item.correctAnswer}</p>
                  </div>
                  <button type="button" onClick={() => removeQuizQuestion(index)}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="save-video-footer">
          <button type="submit" className="primary-library-btn final-save-btn" disabled={uploading}>
            {uploading ? "Saving Training Video..." : "Save Training Video"}
          </button>
        </div>
      </form>

      {showUploadModal && (
        <div className="upload-modal-overlay">
          <div className="upload-modal-card">
            <div className="circle-loader"></div>
            <h3>Uploading Training Video</h3>
            <p>{modalMessage}</p>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="success-modal-overlay">
          <div className="success-modal">
            <div className="success-check">✓</div>
            <h3>Done</h3>
            <p>{successMessage}</p>
            <button type="button" onClick={() => setShowSuccessModal(false)}>Okay</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DepartmentUploadVideo;
