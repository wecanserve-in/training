import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/myresults.css";

function MyResults() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const snapshot = await get(ref(database, "attempts"));

      if (snapshot.exists()) {
        const data = snapshot.val();

        const userResults = Object.keys(data)
          .map((key) => ({
            id: key,
            ...data[key],
          }))
          .filter((attempt) => attempt.userId === user.uid)
          .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

        setResults(userResults);
      } else {
        setResults([]);
      }

      setLoading(false);
    };

    fetchResults();
  }, []);

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) return <h2 className="results-loading">Loading My Results...</h2>;

  return (
    <div className="my-results-page">
      <div className="my-results-header">
        <h1>My Results</h1>
        <p>Track your quiz performance.</p>
      </div>

      <div className="results-table-card">
        {results.length === 0 ? (
          <p className="results-empty">No quiz attempts yet.</p>
        ) : (
          <table className="clean-results-table">
            <thead>
              <tr>
                <th>Course Name</th>
                <th>Score</th>
                <th>Status</th>
                <th>Attempt</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {results.map((result, index) => (
                <tr key={result.id}>
                  <td>
                    {result.courseTitle ||
                      result.videoTitle ||
                      "Training Course"}
                  </td>

                  <td>{result.score}%</td>

                  <td>
                    <span
                      className={`result-status ${
                        result.passed ? "passed" : "failed"
                      }`}
                    >
                      {result.passed ? "Passed" : "Failed"}
                    </span>
                  </td>

                  <td>{index + 1}</td>

                  <td>{formatDate(result.submittedAt)}</td>
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