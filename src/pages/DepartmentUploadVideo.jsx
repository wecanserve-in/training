import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaVideo, FaImage } from "react-icons/fa";
import { onAuthStateChanged } from "firebase/auth";
import { get, push, ref, set } from "firebase/database";
import * as XLSX from "xlsx";
import { auth, database } from "../firebase";
import "../styles/videolibrary.css";

function DepartmentUploadVideo() {
  const [currentUser, setCurrentUser] = useState(null);
  const [department, setDepartment] = useState("");
  const [departmentType, setDepartmentType] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");

  const [metadata, setMetadata] = useState({});
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

const defaultConfig = {
  label: "Training Filters",
  fields: [
    {
      key: "trainingType",
      label: "Training Type",
      required: true,
      options: ["SOP", "Product Training", "Process Training", "Policy", "Software", "Other"],
    },
  ],
  tagOptions: ["SOP", "Product", "Process", "Policy", "Internal Training"],
};

  const departmentFieldConfig = {
    "Production & Manufacturing": {
      label: "PMT Filters",
      fields: [
        {
          key: "organName",
          label: "Organ Name",
          required: true,
          options: [
            "Breast",
            "Lung",
            "Colon",
            "Rectum",
            "Liver",
            "Kidney",
            "Prostate",
            "Cervix",
            "Ovary",
            "Brain",
            "Blood",
            "Bone",
            "Skin",
            "Head & Neck",
            "Stomach",
            "Pancreas",
            "General Oncology",
            "Other",
          ],
        },
        {
          key: "videoType",
          label: "Video Type",
          required: true,
          options: ["Anatomy", "Therapy", "Product", "Other"],
        },
        {
          key: "typeSpecific",
          label: "Specify",
          required: true,
          options: [
            "Cancer Overview",
            "Disease Understanding",
            "Organ Structure",
            "Chemotherapy",
            "Targeted Therapy",
            "Immunotherapy",
            "Hormonal Therapy",
            "Supportive Care",
            "Product Introduction",
            "Dosage",
            "Storage",
            "Handling",
            "FAQs",
            "Other",
          ],
        },
        {
          key: "genericName",
          label: "Product Generic Name",
          required: false,
          options: [
            "Abiraterone",
            "Paclitaxel",
            "Docetaxel",
            "Carboplatin",
            "Cisplatin",
            "Capecitabine",
            "Gemcitabine",
            "Oxaliplatin",
            "Irinotecan",
            "Etoposide",
            "Doxorubicin",
            "Cyclophosphamide",
            "Methotrexate",
            "Imatinib",
            "Temozolomide",
            "Other",
          ],
        },
        {
          key: "productForm",
          label: "Product Form",
          required: false,
          options: ["Tablets", "Capsules", "Injections", "Lyophilized Injections", "Injectables", "Other"],
        },
      ],
      tagOptions: ["Anatomy", "Therapy", "Product", "Doctor Education", "Sales Support", "Internal Training", "GMP"],
    },

    "Sales & Marketing": {
      label: "Sales Training Filters",
      fields: [
        {
          key: "trainingType",
          label: "Training Type",
          required: true,
          options: ["Product Training", "Doctor Pitch", "Objection Handling", "Market Training", "Other"],
        },
        
      ],
      tagOptions: ["Sales", "Marketing", "Product", "Doctor Pitch", "Objection Handling"],
    },

    "Quality Assurance & Quality Control": {
      label: "QA/QC Filters",
      fields: [
        {
          key: "trainingType",
          label: "Training Type",
          required: true,
          options: ["QA", "QC", "Documentation", "Audit", "SOP", "Other"],
        },
       
      ],
      tagOptions: ["QA", "QC", "SOP", "Audit", "Compliance"],
    },

    "Research & Development": {
      label: "R&D Filters",
      fields: [
        {
          key: "trainingType",
          label: "Training Type",
          required: true,
          options: ["Research", "Formulation", "Clinical", "Product Science", "Other"],
        },
   
      ],
      tagOptions: ["Research", "Formulation", "Clinical", "Innovation"],
    },

    "Admin & Operations": defaultConfig,
  };

  const activeConfig = departmentFieldConfig[departmentType] || defaultConfig;

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
      setDepartment(userData.department || "");
      setDepartmentType(userData.departmentType || "");
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setMetadata({});
    setTags([]);
  }, [departmentType]);

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

  const uploadFileToCloudinary = async (file, resourceType, folderName) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error("Cloudinary env variables missing.");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", folderName);

    console.log("Cloud Name:", cloudName);
console.log("Upload Preset:", uploadPreset);
console.log("Resource Type:", resourceType);
console.log("Folder:", folderName);
console.log("File:", file);
console.log(
  `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`
);

const response = await fetch(
  `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
  {
    method: "POST",
    body: formData,
  }
);

const responseText = await response.text();

console.log("Raw Cloudinary Response:", responseText);

let data = {};

try {
  data = JSON.parse(responseText);
} catch (e) {
  console.error(e);
  throw new Error("Cloudinary did not return valid JSON.");
}

console.log("Cloudinary Response:", data);
console.log("HTTP Status:", response.status);

if (!response.ok || !data.secure_url) {
  console.error(data);

  throw new Error(
    data?.error?.message ||
    `Upload failed (${response.status})`
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
      `training-portal/videos/${department || "General"}`
    );

    let thumbnailUrl = buildCloudinaryThumbnail(videoData.public_id);
    let thumbnailPublicId = "";

    if (thumbnailFile) {
      setUploadStatus("Uploading thumbnail...");
setModalMessage("Uploading thumbnail...");

      const thumbnailData = await uploadFileToCloudinary(
        thumbnailFile,
        "image",
        `training-portal/thumbnails/${department || "General"}`
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
  const updateMetadata = (key, value) => {
    setMetadata((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const toggleTag = (tag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
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
      [
        "What is the main objective of this video?",
        "Understand the topic",
        "Review company process",
        "Product learning",
        "None",
        "A",
      ],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Quiz Questions");
    XLSX.writeFile(workbook, "Quiz_Template.xlsx");
  };

const uploadQuizExcel = (selectedFile = excelFile) => {
if (!selectedFile) {
      alert("Please select Excel file first.");
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

        setQuizQuestions((prev) => [...prev, ...uploadedQuestions]);
        setExcelFile(null);

      setSuccessMessage(
 `${uploadedQuestions.length} questions imported successfully.`
);

setShowSuccessModal(true);
      } catch (error) {
       setSuccessMessage(
 "Unable to read Excel file."
);

setShowSuccessModal(true);
      }
    };

   reader.readAsArrayBuffer(selectedFile);
  };

  const validateMetadata = () => {
    const missingField = activeConfig.fields.find((field) => {
      return field.required && !metadata[field.key];
    });

    if (missingField) {
      alert(`Please select ${missingField.label}.`);
      return false;
    }

    return true;
  };

  const saveVideo = async (e) => {
    e.preventDefault();

    if (!title || !description || !videoFile) {
      alert("Please fill title, description and video file.");
      return;
    }

    if (!validateMetadata()) return;

    if (quizQuestions.length === 0) {
      const confirmSave = window.confirm(
        "No quiz questions added. Do you still want to save this video?"
      );

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
        metadata,
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

      alert("Training video saved successfully.");
    

      setTitle("");
      setDescription("");
      setVideoFile(null);
      setThumbnailFile(null);
      setMetadata({});
      setTags([]);
      setQuizQuestions([]);
      setExcelFile(null);
      setUploadStatus("");
      resetQuestionForm();
    } catch (error) {
  alert(error.message);
} finally {
  setUploading(false);
  setShowUploadModal(false);
}
  };

  const selectedTags = useMemo(() => tags.join(", "), [tags]);

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
    currentUser?.role === "superAdmin"
      ? "/super-admin/video-library"
      : currentUser?.role === "admin"
      ? "/admin/video-library"
      : "/department-admin/video-library"
  }
  className="view-library-btn"
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

          <div className="department-type-pill">
            <span>Department</span>
            <strong>{department || "-"}</strong>
            <small>{departmentType || "No department type selected"}</small>
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

          <div className="form-step-title">
            <span>2</span>
            <div>
              <h2>{activeConfig.label}</h2>
              <p>Only select what is useful for finding this video later.</p>
            </div>
          </div>

          <div className="video-form-grid">
            {activeConfig.fields.map((field) => (
              <select
                key={field.key}
                value={metadata[field.key] || ""}
                onChange={(e) => updateMetadata(field.key, e.target.value)}
                required={field.required}
              >
                <option value="">
                  {field.required ? `Select ${field.label} *` : `Select ${field.label}`}
                </option>

                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ))}
          </div>

          <div className="tag-picker">
            <label>Tags</label>

            <div>
              {activeConfig.tagOptions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={tags.includes(tag) ? "selected" : ""}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>

            {selectedTags && <p>Selected: {selectedTags}</p>}
          </div>

          <div className="form-step-title">
            <span>3</span>
            <div>
              <h2>Upload Files</h2>
              <p>Thumbnail is optional. If skipped, it will be generated from the video.</p>
            </div>
          </div>

     <div className="upload-flow">

  <div className="upload-flow-item">

    <div className="upload-step-no">1</div>

    <div className="upload-flow-content">
      <h3>Upload Training Video *</h3>
      <p>Select the main training video file.</p>

      <label className="vertical-upload-box">
        <input
          type="file"
          accept="video/*"
          onChange={(e) =>
            setVideoFile(e.target.files?.[0] || null)
          }
        />

        <div className="upload-placeholder">
          <FaVideo />

          <span>
            {videoFile
              ? videoFile.name
              : "Click to upload video"}
          </span>

          <small>MP4, MOV supported</small>
        </div>
      </label>
    </div>

  </div>

  <div className="upload-divider"></div>

  <div className="upload-flow-item">

    <div className="upload-step-no">2</div>

    <div className="upload-flow-content">

      <h3>Upload Thumbnail</h3>

      <p>Optional. System can auto-generate one.</p>

      <label className="vertical-upload-box">
        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            setThumbnailFile(e.target.files?.[0] || null)
          }
        />

        <div className="upload-placeholder">
          <FaImage />

          <span>
            {thumbnailFile
              ? thumbnailFile.name
              : "Click to upload thumbnail"}
          </span>

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
            <span>4</span>
            <div>
              <h2>Learning Quiz</h2>
              <p>Add manually or upload Excel questions.</p>
            </div>
          </div>

     <div className="quiz-flow-container">

  <div className="quiz-step-card">

    <div className="step-badge">1</div>

    <div className="step-info">
      <h4>Download Sample</h4>
      <p>Download the sample Excel format.</p>

      <button
        type="button"
        className="outline-action-btn"
        onClick={downloadQuizTemplate}
      >
        Download Sample
      </button>
    </div>

  </div>

  <div className="quiz-step-card">

    <div className="step-badge">2</div>

    <div className="step-info">

      <h4>Upload Filled Excel</h4>

      <label className="excel-upload-box">

      <input
  type="file"
  accept=".xlsx,.xls,.csv"
  onChange={(e) => {

    const file = e.target.files?.[0];

    if (!file) return;

    setExcelFile(file);

    uploadQuizExcel(file);

  }}
/>
        <span>
          {excelFile
            ? excelFile.name
            : "Click here to choose Excel file"}
        </span>

      </label>

    </div>

  </div>

 
</div>

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
                    <strong>
                      {index + 1}. {item.question}
                    </strong>
                    <p>Correct: {item.correctAnswer}</p>
                  </div>

                  <button type="button" onClick={() => removeQuizQuestion(index)}>
                    Remove
                  </button>
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

            <div className="success-check">
              ✓
            </div>

            <h3>Done</h3>

            <p>{successMessage}</p>

            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
            >
              Okay
            </button>

          </div>

        </div>
      )}

    </div>
  );
}

export default DepartmentUploadVideo;