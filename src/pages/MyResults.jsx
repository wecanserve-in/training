import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import { useNavigate } from "react-router-dom";
import "../styles/myresults.css";

function MyResults() {
  const navigate = useNavigate();

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    const user = auth.currentUser;

    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const snapshot = await get(ref(database, `attempts/${user.uid}`));

      if (!snapshot.exists()) {
        setResults([]);
        setLoading(false);
        return;
      }

      const data = snapshot.val();

      const userResults = Object.keys(data)
        .map((key) => ({
          id: key,
          ...data[key],
        }))
        .filter((attempt) => {
          return (
            attempt.courseId &&
            !attempt.videoId &&
            attempt.reason !== "video_revision_quiz"
          );
        })
        .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

      setResults(userResults);
    } catch (error) {
      console.error(error);
      alert("Failed to load results");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return <h2 className="results-loading">Loading My Results...</h2>;
  }

  return (
    <div className="my-results-page">
      <div className="my-results-header">
        <div>
          <span>Overall Course Tests</span>
          <h1>My Results</h1>
          <p>Only final course test results are shown here.</p>
        </div>

        <strong>{results.length} Attempts</strong>
      </div>

      <div className="results-table-card">
        {results.length === 0 ? (
          <p className="results-empty">No final course test attempts yet.</p>
        ) : (
          <table className="clean-results-table">
            <thead>
              <tr>
                <th>Course Name</th>
                <th>Score</th>
                <th>Correct</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th>Certificate</th>
              </tr>
            </thead>

            <tbody>
              {results.map((result) => (
                <tr key={result.id}>
                  <td>{result.courseTitle || "Training Course"}</td>

                  <td>
                    <strong>{result.score}%</strong>
                  </td>

                  <td>{result.correct || 0}</td>

                  <td>{result.total || 0}</td>

                  <td>
                    <span
                      className={`result-status ${
                        result.passed ? "passed" : "failed"
                      }`}
                    >
                      {result.passed ? "Passed" : "Failed"}
                    </span>
                  </td>

                  <td>{formatDate(result.submittedAt)}</td>

                  <td>
                    {result.passed ? (
                      <button
                        className="download-cert-btn"
                        onClick={() => navigate(`/certificate/${result.id}`)}
                      >
                        Download
                      </button>
                    ) : (
                      <button
                        className="retry-course-btn"
                        onClick={() => navigate(`/course/${result.courseId}`)}
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default MyResults;