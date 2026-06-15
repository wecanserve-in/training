import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ref, get, push } from "firebase/database";
import * as XLSX from "xlsx";
import { database } from "../firebase";
import "../styles/addquestion.css";

function AddQuestion() {
  const departments = ["Sales", "Marketing", "HR", "Production", "Accounts"];

  const [courses, setCourses] = useState([]);
  const [videos, setVideos] = useState([]);

  const [filteredCourses, setFilteredCourses] = useState([]);
  const [filteredVideos, setFilteredVideos] = useState([]);

  const [department, setDepartment] = useState("");
  const [courseId, setCourseId] = useState("");
  const [videoId, setVideoId] = useState("");

  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");

  const [excelFile, setExcelFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const coursesSnap = await get(ref(database, "courses"));

      if (coursesSnap.exists()) {
        const data = coursesSnap.val();

        const courseArray = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));

        setCourses(courseArray);
      }

      const videosSnap = await get(ref(database, "videos"));

      if (videosSnap.exists()) {
        const data = videosSnap.val();

        const videoArray = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));

        setVideos(videoArray);
      }
    };

    fetchData();
  }, []);

  const handleDepartmentChange = (e) => {
    const selectedDepartment = e.target.value;

    setDepartment(selectedDepartment);
    setCourseId("");
    setVideoId("");
    setFilteredVideos([]);

    const matchedCourses = courses.filter(
      (course) => course.department === selectedDepartment
    );

    setFilteredCourses(matchedCourses);
  };

  const handleCourseChange = (e) => {
    const selectedCourseId = e.target.value;

    setCourseId(selectedCourseId);
    setVideoId("");

    const matchedVideos = videos.filter(
      (video) => video.courseId === selectedCourseId
    );

    setFilteredVideos(matchedVideos);
  };

  const downloadTemplate = () => {
    const worksheetData = [
      ["Question", "OptionA", "OptionB", "OptionC", "OptionD", "CorrectAnswer"],
      ["What is React?", "Library", "Database", "Server", "Browser", "A"],
      [
        "Which company created React?",
        "Google",
        "Microsoft",
        "Meta",
        "Amazon",
        "C",
      ],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");
    XLSX.writeFile(workbook, "Question_Template.xlsx");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!department) {
      alert("Please select department");
      return;
    }

    if (!courseId) {
      alert("Please select course");
      return;
    }

    if (!videoId) {
      alert("Please select video");
      return;
    }

    if (!correctAnswer) {
      alert("Please select correct answer");
      return;
    }

    const options = [optionA, optionB, optionC, optionD];

    await push(ref(database, `questions/${videoId}`), {
      department,
      courseId,
      videoId,
      question,
      options,
      correctAnswer,
      createdAt: new Date().toISOString(),
    });

    alert("Question Added Successfully");

    setQuestion("");
    setOptionA("");
    setOptionB("");
    setOptionC("");
    setOptionD("");
    setCorrectAnswer("");
  };

  const handleExcelUpload = async () => {
    if (!department) {
      alert("Please select department first");
      return;
    }

    if (!courseId) {
      alert("Please select course first");
      return;
    }

    if (!videoId) {
      alert("Please select video first");
      return;
    }

    if (!excelFile) {
      alert("Please upload an Excel file");
      return;
    }

    setUploading(true);

    try {
      const reader = new FileReader();

      reader.onload = async (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rows = XLSX.utils.sheet_to_json(worksheet);

        if (rows.length === 0) {
          alert("Excel sheet is empty");
          setUploading(false);
          return;
        }

        let addedCount = 0;
        let skippedCount = 0;

        for (const row of rows) {
          const q = row.Question || row.question;
          const a = row.OptionA || row.optionA;
          const b = row.OptionB || row.optionB;
          const c = row.OptionC || row.optionC;
          const d = row.OptionD || row.optionD;
          const correct = row.CorrectAnswer || row.correctAnswer;

          if (!q || !a || !b || !c || !d || !correct) {
            skippedCount++;
            continue;
          }

          const options = [a, b, c, d];
          let finalCorrectAnswer = correct;

          if (["A", "B", "C", "D"].includes(String(correct).toUpperCase())) {
            const key = String(correct).toUpperCase();

            if (key === "A") finalCorrectAnswer = a;
            if (key === "B") finalCorrectAnswer = b;
            if (key === "C") finalCorrectAnswer = c;
            if (key === "D") finalCorrectAnswer = d;
          }

          await push(ref(database, `questions/${videoId}`), {
            department,
            courseId,
            videoId,
            question: q,
            options,
            correctAnswer: finalCorrectAnswer,
            createdAt: new Date().toISOString(),
            uploadedVia: "excel",
          });

          addedCount++;
        }

        alert(
          `Excel Upload Complete\nAdded: ${addedCount}\nSkipped: ${skippedCount}`
        );

        setExcelFile(null);
        setUploading(false);
      };

      reader.readAsArrayBuffer(excelFile);
    } catch (error) {
      console.error(error);
      alert("Failed to upload Excel questions");
      setUploading(false);
    }
  };

  return (
    <div className="admin-question-container">
      <div className="admin-nav-back-row">
        <Link to="/admin" className="btn-admin-back">
          ← Back to Admin Console
        </Link>
      </div>

      <div className="admin-question-card">
        <h1 className="admin-question-title">Create Assessment Question</h1>

        <p className="admin-question-subtitle">
          Select department, course, and video before adding questions.
        </p>

        <div className="admin-input-group">
          <label className="admin-field-label">Department</label>

          <select
            value={department}
            onChange={handleDepartmentChange}
            className="admin-form-select"
            required
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
          <label className="admin-field-label">Course / Product / Topic</label>

          <select
            value={courseId}
            onChange={handleCourseChange}
            className="admin-form-select"
            disabled={!department}
            required
          >
            <option value="">
              {department ? "Select Course" : "Select Department First"}
            </option>

            {filteredCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>

          {department && filteredCourses.length === 0 && (
            <small className="field-hint-text">
              No courses found for this department.
            </small>
          )}
        </div>

        <div className="admin-input-group">
          <label className="admin-field-label">Target Video</label>

          <select
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            className="admin-form-select"
            disabled={!courseId}
            required
          >
            <option value="">
              {courseId ? "Select Video" : "Select Course First"}
            </option>

            {filteredVideos.map((video) => (
              <option key={video.id} value={video.id}>
                {video.title}
              </option>
            ))}
          </select>

          {courseId && filteredVideos.length === 0 && (
            <small className="field-hint-text">
              No videos found for this course.
            </small>
          )}
        </div>

        <div className="excel-upload-card">
          <h3>Bulk Upload Questions</h3>

          <p>
            Upload an Excel file with columns:
            <strong>
              {" "}
              Question, OptionA, OptionB, OptionC, OptionD, CorrectAnswer
            </strong>
          </p>

          <button
            type="button"
            onClick={downloadTemplate}
            className="btn-template-download"
          >
            Download Excel Template
          </button>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setExcelFile(e.target.files[0])}
            className="excel-file-input"
          />

          <button
            type="button"
            onClick={handleExcelUpload}
            className="btn-excel-upload"
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload Excel Questions"}
          </button>

          <small className="field-hint-text">
            CorrectAnswer can be actual answer text or A / B / C / D.
          </small>
        </div>

        <div className="manual-divider">
          <span>Or add manually</span>
        </div>

        <form onSubmit={handleSubmit} className="admin-core-form">
          <div className="admin-input-group">
            <label className="admin-field-label">Question Text</label>

            <textarea
              placeholder="Type the question content clearly..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="admin-form-textarea"
              rows="3"
              required
            />
          </div>

          <div className="admin-options-card">
            <h3 className="options-group-title">
              Configure Multiple Choice Answers
            </h3>

            <div className="options-input-grid">
              <div className="admin-input-group">
                <label className="admin-field-label choice-indicator text-a">
                  Option A
                </label>

                <input
                  placeholder="First possible option"
                  value={optionA}
                  onChange={(e) => setOptionA(e.target.value)}
                  className="admin-form-input"
                  required
                />
              </div>

              <div className="admin-input-group">
                <label className="admin-field-label choice-indicator text-b">
                  Option B
                </label>

                <input
                  placeholder="Second possible option"
                  value={optionB}
                  onChange={(e) => setOptionB(e.target.value)}
                  className="admin-form-input"
                  required
                />
              </div>

              <div className="admin-input-group">
                <label className="admin-field-label choice-indicator text-c">
                  Option C
                </label>

                <input
                  placeholder="Third possible option"
                  value={optionC}
                  onChange={(e) => setOptionC(e.target.value)}
                  className="admin-form-input"
                  required
                />
              </div>

              <div className="admin-input-group">
                <label className="admin-field-label choice-indicator text-d">
                  Option D
                </label>

                <input
                  placeholder="Fourth possible option"
                  value={optionD}
                  onChange={(e) => setOptionD(e.target.value)}
                  className="admin-form-input"
                  required
                />
              </div>
            </div>
          </div>

          <div className="admin-input-group highlight-selection-zone">
            <label className="admin-field-label core-key-label">
              Designate Correct Answer Key
            </label>

            <select
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              className="admin-form-select key-selector"
              required
            >
              <option value="">-- Choose Valid Answer Key --</option>
              {optionA && <option value={optionA}>Option A: {optionA}</option>}
              {optionB && <option value={optionB}>Option B: {optionB}</option>}
              {optionC && <option value={optionC}>Option C: {optionC}</option>}
              {optionD && <option value={optionD}>Option D: {optionD}</option>}
            </select>
          </div>

          <div className="admin-form-submit-zone">
            <button type="submit" className="btn-admin-submit-form">
              Save Question Asset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddQuestion;