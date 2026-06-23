import { useEffect, useState } from "react";
import { ref, get, update } from "firebase/database";
import { database } from "../firebase";
import { useNavigate, useParams, Link } from "react-router-dom";
import "../styles/addquestion.css";

function EditQuestion() {
  const { courseId, questionId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [department, setDepartment] = useState("");

  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuestionAndCourse = async () => {
      try {

        console.log("courseId from URL:", courseId);
console.log("questionId from URL:", questionId);

        const courseSnap = await get(ref(database, `courses/${courseId}`));

        if (!courseSnap.exists()) {
          alert("Course not found");
      navigate("/department-admin/questions");
          return;
        }

        const courseData = courseSnap.val();
        setCourse(courseData);
        setDepartment(courseData.department || "");

        const questionSnap = await get(
          ref(database, `questions/${courseId}/${questionId}`)
        );

        console.log("Question path:", `questions/${courseId}/${questionId}`);
console.log("Question exists:", questionSnap.exists());

        if (!questionSnap.exists()) {
          alert("Question not found");
navigate("/department-admin/questions");
          return;
        }

        const data = questionSnap.val();

        setQuestion(data.question || "");
        setOptionA(data.options?.[0] || "");
        setOptionB(data.options?.[1] || "");
        setOptionC(data.options?.[2] || "");
        setOptionD(data.options?.[3] || "");
        setCorrectAnswer(data.correctAnswer || "");
      } catch (error) {
        console.error(error);
        alert("Failed to load question");
      } finally {
        setLoading(false);
      }
    };

    fetchQuestionAndCourse();
  }, [courseId, questionId, navigate]);

  const handleUpdate = async (e) => {
    e.preventDefault();

    const finalQuestion = question.trim();
    const options = [
      optionA.trim(),
      optionB.trim(),
      optionC.trim(),
      optionD.trim(),
    ];

    if (!finalQuestion || options.some((option) => !option)) {
      alert("Please fill question and all options");
      return;
    }

    if (!correctAnswer) {
      alert("Please select correct answer");
      return;
    }

    if (!options.includes(correctAnswer.trim())) {
      alert("Correct answer must match one of the options.");
      return;
    }

    try {
      await update(ref(database, `questions/${courseId}/${questionId}`), {
        department,
        courseId,
        question: finalQuestion,
        options,
        correctAnswer: correctAnswer.trim(),
        updatedAt: new Date().toISOString(),
      });

      alert("Question Updated Successfully");
navigate("/department-admin/questions");
    } catch (error) {
      console.error(error);
      alert("Failed to update question");
    }
  };

  if (loading) {
    return <h2 className="admin-status-msg">Loading Question...</h2>;
  }

  return (
    <div className="admin-question-container">
      <div className="admin-nav-back-row">
      <Link to="/department-admin/questions" className="btn-admin-back">
          ← Cancel and Return
        </Link>
      </div>

      <div className="admin-question-card">
        <h1 className="admin-question-title">Edit Course Question</h1>

        <p className="admin-question-subtitle">
          This question belongs to the overall course quiz.
        </p>

        <div className="admin-input-group">
          <label className="admin-field-label">Department</label>
          <input
            value={department}
            className="admin-form-input"
            disabled
          />
        </div>

        <div className="admin-input-group">
          <label className="admin-field-label">Course</label>
          <input
            value={course?.title || ""}
            className="admin-form-input"
            disabled
          />
        </div>

        <form onSubmit={handleUpdate} className="admin-core-form">
          <div className="admin-input-group">
            <label className="admin-field-label">Question Text</label>

            <textarea
              placeholder="Enter Question"
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
                  placeholder="Option A"
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
                  placeholder="Option B"
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
                  placeholder="Option C"
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
                  placeholder="Option D"
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
              Correct Answer
            </label>

            <select
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              className="admin-form-select key-selector"
              required
            >
              <option value="">Select Correct Answer</option>
              {optionA && <option value={optionA}>Option A: {optionA}</option>}
              {optionB && <option value={optionB}>Option B: {optionB}</option>}
              {optionC && <option value={optionC}>Option C: {optionC}</option>}
              {optionD && <option value={optionD}>Option D: {optionD}</option>}
            </select>
          </div>

          <div className="admin-form-submit-zone">
            <button type="submit" className="btn-admin-submit-form">
              Save Question
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditQuestion;