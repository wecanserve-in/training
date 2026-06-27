import { useEffect, useMemo, useState } from "react";
import { ref, get } from "firebase/database";
import { database } from "../firebase";
import { Link } from "react-router-dom";
import "../styles/adminresults.css";

function AdminResults() {
  const [attempts, setAttempts] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        const snapshot = await get(ref(database, "attempts"));

        if (snapshot.exists()) {
          const data = snapshot.val();

          const attemptsArray = Object.keys(data)
            .map((key) => ({
              id: key,
              ...data[key],
            }))
            .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

          setAttempts(attemptsArray);
        }
      } catch (error) {
        console.error("Failed to fetch attempts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttempts();
  }, []);

  const courseOptions = useMemo(() => {
    return [...new Set(attempts.map((a) => a.videoTitle || a.courseTitle).filter(Boolean))];
  }, [attempts]);

  const filteredAttempts = useMemo(() => {
    return attempts.filter((attempt) => {
      const userName = attempt.userName || "";
      const userEmail = attempt.userEmail || "";
      const courseTitle = attempt.videoTitle || attempt.courseTitle || "";

      const searchText = `${userName} ${userEmail} ${courseTitle}`.toLowerCase();

      const matchesSearch = searchText.includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === ""
          ? true
          : statusFilter === "passed"
          ? attempt.passed
          : !attempt.passed;

      const matchesCourse = courseFilter ? courseTitle === courseFilter : true;

      return matchesSearch && matchesStatus && matchesCourse;
    });
  }, [attempts, search, statusFilter, courseFilter]);

  const totalAttempts = attempts.length;
  const passedCount = attempts.filter((a) => a.passed).length;
  const failedCount = totalAttempts - passedCount;
  const passRate = totalAttempts ? Math.round((passedCount / totalAttempts) * 100) : 0;

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setCourseFilter("");
  };

  if (loading) {
    return <div className="admin-log-page">Loading logs...</div>;
  }

  return (
    <div className="admin-log-page">
      <div className="admin-log-header">
        <div>
          <Link to="/admin" className="admin-log-back">
            ← Back to Admin Dashboard
          </Link>

          <h1>Assessment Logs</h1>
          <p>
            Track every quiz submission, pass/fail status, scores, timestamps and employee
            training activity.
          </p>
        </div>
      </div>

      <div className="log-summary-grid">
        <div className="log-summary-card">
          <span>Total Attempts</span>
          <h2>{totalAttempts}</h2>
          <p>All submitted assessments</p>
        </div>

        <div className="log-summary-card success">
          <span>Passed</span>
          <h2>{passedCount}</h2>
          <p>Eligible for certificate</p>
        </div>

        <div className="log-summary-card danger">
          <span>Failed</span>
          <h2>{failedCount}</h2>
          <p>Needs retry / follow-up</p>
        </div>

        <div className="log-summary-card">
          <span>Pass Rate</span>
          <h2>{passRate}%</h2>
          <p>Overall training performance</p>
        </div>
      </div>

      <div className="log-control-card">
        <input
          type="text"
          placeholder="Search employee, email or course..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
        </select>

        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
          <option value="">All Courses</option>
          {courseOptions.map((course) => (
            <option key={course} value={course}>
              {course}
            </option>
          ))}
        </select>

        <button onClick={resetFilters}>Reset</button>
      </div>

      <div className="log-table-card">
        <div className="log-table-title-row">
          <div>
            <h2>Submission Records</h2>
            <p>{filteredAttempts.length} records showing</p>
          </div>
        </div>

        {filteredAttempts.length === 0 ? (
          <div className="empty-log-state">
            <h3>No log records found</h3>
            <p>No assessment submissions match the selected filters.</p>
          </div>
        ) : (
          <div className="log-table-wrapper">
            <table className="admin-log-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Course / Module</th>
                  <th>Score</th>
                  <th>Correct</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                </tr>
              </thead>

              <tbody>
                {filteredAttempts.map((attempt) => {
                  const courseTitle = attempt.videoTitle || attempt.courseTitle || "Untitled Course";

                  return (
                    <tr key={attempt.id}>
                      <td>
                        <strong>{attempt.userName || "Unnamed User"}</strong>
                        <small>{attempt.userEmail || "No email available"}</small>
                      </td>

                      <td>
                        <span className="log-course-name">{courseTitle}</span>
                      </td>

                      <td>
                        <span className={`score-chip ${attempt.passed ? "pass" : "fail"}`}>
                          {attempt.score || 0}%
                        </span>
                      </td>

                      <td>
                        <code>
                          {attempt.correct || 0} / {attempt.total || 0}
                        </code>
                      </td>

                      <td>
                        <span className={`log-status ${attempt.passed ? "passed" : "failed"}`}>
                          {attempt.passed ? "Passed" : "Failed"}
                        </span>
                      </td>

                      <td>
                        {attempt.submittedAt
                          ? new Date(attempt.submittedAt).toLocaleString("en-IN", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminResults;