import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import useBasePath from "../hooks/useBasePath";
import { flattenAttempts, hasCertificate } from "../utils/trainingAnalytics";
import "../styles/myresults.css";

import {
  FaClipboardCheck,
  FaCheckCircle,
  FaTimesCircle,
  FaCertificate,
} from "react-icons/fa";

function MyResults() {
  const navigate = useNavigate();
  const basePath = useBasePath();

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchResults(user);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchResults = async (user) => {
    try {
      const [attemptsSnap, quizAttemptsSnap] = await Promise.all([
        get(ref(database, `attempts/${user.uid}`)),
        get(ref(database, `quizAttempts/${user.uid}`)),
      ]);

      const rawAttempts = attemptsSnap.exists() ? attemptsSnap.val() : {};
      const rawQuizAttempts = quizAttemptsSnap.exists() ? quizAttemptsSnap.val() : {};

      const flattened = flattenAttempts(rawAttempts, rawQuizAttempts);

      const userResults = flattened
        .filter((attempt) => {
          return (
            attempt.courseId &&
            !attempt.videoId &&
            attempt.reason !== "video_revision_quiz"
          );
        })
        .sort((a, b) => (b.attemptTime || 0) - (a.attemptTime || 0));

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

  const totalAttempts = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const certificatesCount = results.filter((r) => hasCertificate(r)).length;

  if (loading) {
    return <h2 className="results-loading">Loading My Results...</h2>;
  }

  return (
    <div className="my-results-page">
      <div className="my-results-header">
        <div>
          <h1>My Results</h1>
          <p>Only final course test results are shown here.</p>
        </div>
        <strong>{totalAttempts} Attempts</strong>
      </div>

      <div className="results-stats-row">
        <div className="results-stat-card">
          <div className="results-stat-icon blue">
            <FaClipboardCheck />
          </div>
          <div className="results-stat-info">
            <span>Total Attempts</span>
            <strong>{totalAttempts}</strong>
          </div>
        </div>
        <div className="results-stat-card">
          <div className="results-stat-icon green">
            <FaCheckCircle />
          </div>
          <div className="results-stat-info">
            <span>Passed</span>
            <strong>{passedCount}</strong>
          </div>
        </div>
        <div className="results-stat-card">
          <div className="results-stat-icon red">
            <FaTimesCircle />
          </div>
          <div className="results-stat-info">
            <span>Failed</span>
            <strong>{failedCount}</strong>
          </div>
        </div>
        <div className="results-stat-card">
          <div className="results-stat-icon purple">
            <FaCertificate />
          </div>
          <div className="results-stat-info">
            <span>Certificates</span>
            <strong>{certificatesCount}</strong>
          </div>
        </div>
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={result.id}>
                  <td>{result.courseTitle || "Training Course"}</td>
                  <td><strong>{result.score}%</strong></td>
                  <td>{result.correct || 0}</td>
                  <td>{result.total || 0}</td>
                  <td>
                    <span className={`result-status ${result.passed ? "passed" : "failed"}`}>
                      {result.passed ? "Passed" : "Failed"}
                    </span>
                  </td>
                  <td>{formatDate(result.submittedAt || result.attemptTime)}</td>
                  <td>
                    {result.passed ? (
                      <button
                        className="download-cert-btn"
                        onClick={() => navigate(`${basePath}/certificate/${result.id}`)}
                      >
                        Download
                      </button>
                    ) : (
                      <button
                        className="retry-course-btn"
                        onClick={() => navigate(`${basePath}/course/${result.courseId}`)}
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
