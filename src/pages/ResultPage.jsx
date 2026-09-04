import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import useBasePath from "../hooks/useBasePath";
import "../styles/resultpage.css";

function ResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const basePath = useBasePath();

  const [result, setResult] = useState(null);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  const getDashboardPath = () => {
    if (!basePath) {
      return "/dashboard";
    }

    return `${basePath}/dashboard`;
  };

  const getCoursePath = (courseId) => {
    if (!courseId) {
      return getDashboardPath();
    }

    if (!basePath) {
      return `/course/${courseId}`;
    }

    return `${basePath}/course/${courseId}`;
  };

  const getCertificatePath = (attemptId) => {
    if (!basePath) {
      return `/certificate/${attemptId}`;
    }

    return `${basePath}/certificate/${attemptId}`;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedInUser) => {
      if (!loggedInUser) {
        setLoading(false);
        navigate("/login", { replace: true });
        return;
      }

      try {
        await fetchResult();
      } catch (error) {
        console.error("Result page loading error:", error);
        alert("Failed to load result");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [id]);

  const fetchResult = async () => {
    try {
      if (!id) {
        setResult(null);
        return;
      }

      /*
       * Existing IDs appear to use:
       * userId_attemptId
       */
      const attemptUserId = id.split("_")[0];

      const resultSnap = await get(
        ref(database, `attempts/${attemptUserId}/${id}`)
      );

      if (!resultSnap.exists()) {
        setResult(null);
        return;
      }

      const resultData = resultSnap.val();

      setResult({
        id,
        ...resultData,
      });

      if (resultData.courseId) {
        const courseSnap = await get(
          ref(database, `courses/${resultData.courseId}`)
        );

        if (courseSnap.exists()) {
          setCourse({
            id: resultData.courseId,
            ...courseSnap.val(),
          });
        } else {
          setCourse(null);
        }
      }
    } catch (error) {
      console.error("Result fetch error:", error);
      alert("Failed to load result");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <h2 className="result-status-msg">
        Loading Result...
      </h2>
    );
  }

  if (!result) {
    return (
      <div className="result-status-msg error">
        <h1>Result not found</h1>

        <button
          type="button"
          className="secondary-btn"
          onClick={() => navigate(getDashboardPath())}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const total = Number(
    result.total ??
      result.totalQuestions ??
      0
  );

  const correct = Number(
    result.correct ??
      result.correctAnswers ??
      0
  );

  const wrong = Math.max(
    Number(
      result.wrong ??
        result.wrongAnswers ??
        total - correct
    ),
    0
  );

  const rawScore = Number(result.score ?? 0);

  /*
   * Supports both:
   * score: 80
   * score: 8 with total: 10
   */
  const score =
    total > 0 && rawScore <= total
      ? Math.round((rawScore / total) * 100)
      : Math.max(0, Math.min(100, Math.round(rawScore)));

  const courseTitle =
    result.courseTitle ||
    course?.title ||
    course?.courseTitle ||
    "Course";

  const quizLabel =
    result.quizTitle ||
    result.testTitle ||
    result.quizType ||
    "Final Course Test";

  const passed =
    typeof result.passed === "boolean"
      ? result.passed
      : score >= Number(result.passPercentage || 0);

  return (
    <div className="result-page-container">
      <div
        className={`result-shell ${
          passed ? "passed" : "failed"
        }`}
      >
        <button
          type="button"
          className="result-back-btn"
          onClick={() =>
            navigate(getCoursePath(result.courseId))
          }
        >
          ← Back to Course
        </button>

        <div className="result-status-icon">
          {passed ? "✓" : "✕"}
        </div>

        <h1 className="result-status-text">
          {passed ? "Quiz Passed" : "Quiz Failed"}
        </h1>

        <div className="result-score-circle">
          <strong>{score}%</strong>
          <span>Score</span>
        </div>

        <h2 className="result-course-name">
          {courseTitle}
        </h2>

        <p className="result-course-type">
          {quizLabel}
        </p>

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
          <span
            style={{
              width: `${score}%`,
            }}
          />
        </div>

        <p className="result-message">
          {passed
            ? "Great job! Your result has been saved successfully."
            : "Review the course and try again when you are ready."}
        </p>

        <div className="result-actions">
          {passed ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() =>
                navigate(getCertificatePath(id))
              }
            >
              Download Certificate
            </button>
          ) : (
            <button
              type="button"
              className="primary-btn fail"
              onClick={() =>
                navigate(getCoursePath(result.courseId))
              }
            >
              Review Course
            </button>
          )}

          <button
            type="button"
            className="secondary-btn"
            onClick={() =>
              navigate(getDashboardPath())
            }
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResultPage;