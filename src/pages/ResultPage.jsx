import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ref, get } from "firebase/database";
import { database } from "../firebase";
import "../styles/resultpage.css";

function ResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [result, setResult] = useState(null);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResult();
  }, [id]);

  const fetchResult = async () => {
    try {
      const resultSnap = await get(ref(database, `attempts/${id}`));

      if (!resultSnap.exists()) {
        setResult(null);
        setLoading(false);
        return;
      }

      const resultData = resultSnap.val();
      setResult(resultData);

      if (resultData.courseId) {
        const courseSnap = await get(ref(database, `courses/${resultData.courseId}`));

        if (courseSnap.exists()) {
          setCourse({
            id: resultData.courseId,
            ...courseSnap.val(),
          });
        }
      }
    } catch (error) {
      console.error(error);
      alert("Failed to load result");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <h2 className="result-status-msg">Loading Result...</h2>;

  if (!result) return <h1 className="result-status-msg error">Result not found</h1>;

  const total = Number(result.total || 0);
  const correct = Number(result.correct || 0);
  const wrong = Math.max(total - correct, 0);
  const score = Number(result.score || 0);

  const courseTitle =
    result.courseTitle || course?.title || course?.courseTitle || "Course";

  const quizLabel = result.quizType || "Final Course Test";

  return (
    <div className="result-page-container">
      <div className={`result-shell ${result.passed ? "passed" : "failed"}`}>
        <button
          type="button"
          className="result-back-btn"
          onClick={() => navigate(`/course/${result.courseId}`)}
        >
          ← Back to Course
        </button>

        <div className="result-status-icon">{result.passed ? "✓" : "✕"}</div>

        <h1 className="result-status-text">
          {result.passed ? "Quiz Passed" : "Quiz Failed"}
        </h1>

        <div className="result-score-circle">
          <strong>{score}%</strong>
          <span>Score</span>
        </div>

        <h2 className="result-course-name">{courseTitle}</h2>
        <p className="result-course-type">{quizLabel}</p>

        <div className="result-stats-grid">
          <div>
            <span>Correct</span>
            <strong>{correct}</strong>
          </div>

          <div>
            <span>Wrong</span>
            <strong>{wrong}</strong>
          </div>

          <div>
            <span>Total</span>
            <strong>{total}</strong>
          </div>
        </div>

        <div className="result-progress">
          <span style={{ width: `${score}%` }}></span>
        </div>

        <p className="result-message">
          {result.passed
            ? "Great job! Your result has been saved successfully."
            : "Review the course and try again when you are ready."}
        </p>

        <div className="result-actions">
          {result.passed ? (
            <button
              className="primary-btn"
              onClick={() => navigate(`/certificate/${id}`)}
            >
              Download Certificate
            </button>
          ) : (
            <button
              className="primary-btn fail"
              onClick={() => navigate(`/course/${result.courseId}`)}
            >
              Review Course
            </button>
          )}

          <button
            className="secondary-btn"
            onClick={() => navigate("/dashboard")}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResultPage;