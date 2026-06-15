import { useEffect, useState } from "react";
import { ref, get, remove } from "firebase/database";
import { database } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import "../styles/managequestions.css";

function ManageQuestions() {
  const navigate = useNavigate();

  const departments = ["Sales", "Marketing", "HR", "Production", "Accounts"];

  const [courses, setCourses] = useState([]);
  const [videos, setVideos] = useState([]);

  const [filteredCourses, setFilteredCourses] = useState([]);
  const [filteredVideos, setFilteredVideos] = useState([]);

  const [department, setDepartment] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedVideo, setSelectedVideo] = useState("");

  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleDepartmentChange = (e) => {
    const selectedDepartment = e.target.value;

    setDepartment(selectedDepartment);
    setSelectedCourse("");
    setSelectedVideo("");
    setQuestions([]);
    setFilteredVideos([]);

    const matchedCourses = courses.filter(
      (course) => course.department === selectedDepartment
    );

    setFilteredCourses(matchedCourses);
  };

  const handleCourseChange = (e) => {
    const courseId = e.target.value;

    setSelectedCourse(courseId);
    setSelectedVideo("");
    setQuestions([]);

    const matchedVideos = videos.filter((video) => video.courseId === courseId);

    setFilteredVideos(matchedVideos);
  };

  const fetchQuestions = async (videoId) => {
    if (!videoId) {
      setQuestions([]);
      return;
    }

    const snapshot = await get(ref(database, `questions/${videoId}`));

    if (snapshot.exists()) {
      const data = snapshot.val();

      const questionArray = Object.keys(data).map((key) => ({
        id: key,
        ...data[key],
      }));

      setQuestions(questionArray);
    } else {
      setQuestions([]);
    }
  };

  const handleVideoChange = (e) => {
    const videoId = e.target.value;

    setSelectedVideo(videoId);
    fetchQuestions(videoId);
  };

  const handleDelete = async (questionId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this question?"
    );

    if (!confirmDelete) return;

    await remove(ref(database, `questions/${selectedVideo}/${questionId}`));

    fetchQuestions(selectedVideo);
  };

  return (
    <div className="manage-questions-container">
      <div className="q-header-row">
        <div>
          <div className="back-link-wrapper">
            <Link to="/admin" className="btn-q-back">
              ← Admin Dashboard
            </Link>
          </div>

          <h1 className="q-main-title">Manage Question Pools</h1>

          <p className="q-subtitle">
            Filter questions by department, course, and video module.
          </p>
        </div>

        <Link to="/admin/add-question" className="btn-q-create-new">
          + Add New Question
        </Link>
      </div>

      <div className="filter-selection-card">
        <label className="filter-select-label">Department:</label>

        <div className="select-dropdown-wrapper">
          <select
            value={department}
            onChange={handleDepartmentChange}
            className="admin-filter-select"
          >
            <option value="">-- Select Department --</option>

            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <label className="filter-select-label">Course:</label>

        <div className="select-dropdown-wrapper">
          <select
            value={selectedCourse}
            onChange={handleCourseChange}
            className="admin-filter-select"
            disabled={!department}
          >
            <option value="">
              {department ? "-- Select Course --" : "Select Department First"}
            </option>

            {filteredCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>

        <label className="filter-select-label">Video:</label>

        <div className="select-dropdown-wrapper">
          <select
            value={selectedVideo}
            onChange={handleVideoChange}
            className="admin-filter-select"
            disabled={!selectedCourse}
          >
            <option value="">
              {selectedCourse ? "-- Select Video --" : "Select Course First"}
            </option>

            {filteredVideos.map((video) => (
              <option key={video.id} value={video.id}>
                {video.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="questions-render-workspace">
        {!department ? (
          <div className="workspace-status-card info-prompt">
            <h3>No Department Selected</h3>
            <p>Please select department first.</p>
          </div>
        ) : !selectedCourse ? (
          <div className="workspace-status-card info-prompt">
            <h3>No Course Selected</h3>
            <p>Please select a course to view its videos.</p>
          </div>
        ) : !selectedVideo ? (
          <div className="workspace-status-card info-prompt">
            <h3>No Video Selected</h3>
            <p>Please select a video to view its question pool.</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="workspace-status-card zero-data-prompt">
            <h3>Empty Question Pool</h3>
            <p>No questions have been attached to this video yet.</p>
          </div>
        ) : (
          <div className="questions-data-list">
            <div className="pool-count-indicator">
              Showing <strong>{questions.length}</strong> questions assigned to
              this video.
            </div>

            {questions.map((question, index) => (
              <div key={question.id} className="question-item-card">
                <div className="q-card-upper-row">
                  <span className="q-index-badge">Item #{index + 1}</span>

                  <div className="q-card-actions-row">
                    <button
                      onClick={() =>
                        navigate(
                          `/admin/edit-question/${selectedVideo}/${question.id}`
                        )
                      }
                      className="btn-item-action-edit"
                    >
                      Edit Question
                    </button>

                    <button
                      onClick={() => handleDelete(question.id)}
                      className="btn-item-action-delete"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <h3 className="q-card-body-text">{question.question}</h3>

                <div className="q-card-options-matrix">
                  {question.options?.map((option, idx) => {
                    const isCorrect = option === question.correctAnswer;

                    return (
                      <div
                        key={`${option}-${idx}`}
                        className={`q-option-pill-display ${
                          isCorrect ? "valid-target-key" : ""
                        }`}
                      >
                        <span className="option-letter">
                          {String.fromCharCode(65 + idx)}
                        </span>

                        <span className="option-string">{option}</span>

                        {isCorrect && (
                          <span className="key-checkmark-tag">
                            ✓ Correct Key
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ManageQuestions;