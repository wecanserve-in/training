import { useEffect, useState } from "react";
import { ref, get, remove } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { database, auth } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import "../styles/managequestions.css";

function ManageQuestions() {
  const navigate = useNavigate();


const [currentUser, setCurrentUser] = useState(null);
const [department, setDepartment] = useState("");

const [courses, setCourses] = useState([]);
const [filteredCourses, setFilteredCourses] = useState([]);
const [selectedCourse, setSelectedCourse] = useState("");

const [questions, setQuestions] = useState([]);
const [loading, setLoading] = useState(true);


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

    setCurrentUser(userData);

    const realDepartment = userData.department || "";
    setDepartment(realDepartment);

    await fetchData(realDepartment);

    setLoading(false);
  });

  return () => unsubscribe();
}, [navigate]);

  const fetchData = async (realDepartment) => {
  const coursesSnap = await get(ref(database, "courses"));

  if (coursesSnap.exists()) {
    const data = coursesSnap.val();

    const courseArray = Object.keys(data).map((key) => ({
      id: key,
      ...data[key],
    }));

    const deptCourses = courseArray.filter(
      (course) => course.department === realDepartment
    );

    setCourses(courseArray);
    setFilteredCourses(deptCourses);

    if (deptCourses.length > 0) {
      const firstCourseId = deptCourses[0].id;
      setSelectedCourse(firstCourseId);
      await fetchQuestions(firstCourseId);
    }
  } else {
    setCourses([]);
    setFilteredCourses([]);
  }
};

  

 const fetchQuestions = async (courseId) => {
  if (!courseId) {
    setQuestions([]);
    return;
  }

  const snapshot = await get(ref(database, `questions/${courseId}`));

  if (snapshot.exists()) {
    const data = snapshot.val();

    const questionArray = Object.keys(data).map((key) => ({
      id: key,
      courseId,
      ...data[key],
    }));

    setQuestions(questionArray);
  } else {
    setQuestions([]);
  }
};

const handleCourseChange = async (e) => {
  const courseId = e.target.value;

  setSelectedCourse(courseId);
  await fetchQuestions(courseId);
};


  

  const handleDelete = async (questionId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this question?"
    );

    if (!confirmDelete) return;

   await remove(ref(database, `questions/${selectedCourse}/${questionId}`));

fetchQuestions(selectedCourse);
  };

  if (loading) {
  return <div className="manage-questions-container">Loading questions...</div>;
}

  return (
    <div className="manage-questions-container">
      <div className="q-header-row">
        <div>
          <div className="back-link-wrapper">
         <Link to="/department-admin" className="btn-q-back">
  ← Department Dashboard
</Link>
          </div>

      <h1 className="q-main-title">Manage Course Questions</h1>

<p className="q-subtitle">
  View and manage quiz questions for courses in your department.
</p>
        </div>

  <Link
  to={
    selectedCourse
      ? `/department-admin/questions/add/${selectedCourse}`
      : "#"
  }
  className="btn-q-create-new"
  onClick={(e) => {
    if (!selectedCourse) {
      e.preventDefault();
      alert("Please select a course first");
    }
  }}
>
  + Add New Question
</Link>
      </div>

   <div className="filter-selection-card">
  <label className="filter-select-label">Department:</label>

  <div className="select-dropdown-wrapper">
    <input
      value={department}
      className="admin-filter-select"
      disabled
    />
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
        {department ? "-- Select Course --" : "Department Not Found"}
      </option>

      {filteredCourses.map((course) => (
        <option key={course.id} value={course.id}>
          {course.title}
        </option>
      ))}
    </select>
  </div>
</div>

<div className="questions-render-workspace">
  {!department ? (
  <div className="workspace-status-card info-prompt">
    <h3>No Department Found</h3>
    <p>Your account is not linked with any department.</p>
  </div>
) : !selectedCourse ? (
  <div className="workspace-status-card info-prompt">
    <h3>No Course Selected</h3>
    <p>Please select a course to view its quiz questions.</p>
  </div>
) : questions.length === 0 ? (
          <div className="workspace-status-card zero-data-prompt">
            <h3>Empty Question Pool</h3>
           <p>No questions have been added to this course yet.</p>
          </div>
        ) : (
          <div className="questions-data-list">
            <div className="pool-count-indicator">
          Showing <strong>{questions.length}</strong> questions assigned to
this course.
            </div>

            {questions.map((question, index) => (
              <div key={question.id} className="question-item-card">
                <div className="q-card-upper-row">
                  <span className="q-index-badge">Item #{index + 1}</span>

                  <div className="q-card-actions-row">
                    <button
                      onClick={() =>
                      navigate(
  `/department-admin/questions/edit/${selectedCourse}/${question.id}`
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