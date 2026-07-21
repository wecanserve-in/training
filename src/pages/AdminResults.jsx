import { useEffect, useMemo, useState } from "react";
import { get, ref } from "firebase/database";
import { Link } from "react-router-dom";
import { database } from "../firebase";
import "../styles/adminresults.css";

const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");

const toArray = (value) => {
  if (!value || typeof value !== "object") return [];

  return Object.entries(value).map(([id, item]) => ({
    id,
    ...(item && typeof item === "object" ? item : {}),
  }));
};

const getAttemptTime = (attempt) => {
  const value =
    attempt.submittedAt ||
    attempt.completedAt ||
    attempt.createdAt ||
    attempt.attemptedAt ||
    attempt.updatedAt ||
    0;

  const timestamp =
    typeof value === "number" ? value : new Date(value || 0).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getCourseTitle = (course) =>
  course?.title ||
  course?.courseTitle ||
  course?.courseName ||
  course?.name ||
  "";

const getQuizTitle = (attempt) =>
  attempt.quizTitle ||
  attempt.testTitle ||
  attempt.assessmentTitle ||
  attempt.videoTitle ||
  attempt.courseTitle ||
  "Untitled Test";

const getAttemptScore = (attempt) => {
  const directScore = Number(
    attempt.percentage ??
      attempt.scorePercentage ??
      attempt.marksPercentage ??
      attempt.score
  );

  if (Number.isFinite(directScore)) {
    if (directScore <= 1 && attempt.score !== undefined) {
      return Math.round(directScore * 100);
    }

    return Math.max(0, Math.min(100, Math.round(directScore)));
  }

  const correct = Number(
    attempt.correct ??
      attempt.correctAnswers ??
      attempt.correctCount ??
      attempt.obtainedMarks
  );

  const total = Number(
    attempt.total ??
      attempt.totalQuestions ??
      attempt.questionCount ??
      attempt.totalMarks
  );

  if (Number.isFinite(correct) && Number.isFinite(total) && total > 0) {
    return Math.round((correct / total) * 100);
  }

  return 0;
};

const isAttemptPassed = (attempt) => {
  if (typeof attempt.passed === "boolean") return attempt.passed;
  if (typeof attempt.isPassed === "boolean") return attempt.isPassed;

  const status = String(attempt.status || "")
    .trim()
    .toLowerCase();

  if (status === "passed" || status === "pass") return true;
  if (status === "failed" || status === "fail") return false;

  const score = getAttemptScore(attempt);
  const passingMarks = Number(
    attempt.passingMarks ??
      attempt.passPercentage ??
      attempt.passingPercentage ??
      60
  );

  return score >= (Number.isFinite(passingMarks) ? passingMarks : 60);
};

const formatDateTime = (value) => {
  if (!value) return "—";

  const date =
    typeof value === "number" ? new Date(value) : new Date(String(value));

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function AdminResults() {
  const [rawAttempts, setRawAttempts] = useState({});
  const [rawQuizAttempts, setRawQuizAttempts] = useState({});
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [testTypeFilter, setTestTypeFilter] = useState("");

  const [sortBy, setSortBy] = useState("latest");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);

      try {
        const [
          attemptsSnapshot,
          quizAttemptsSnapshot,
          usersSnapshot,
          coursesSnapshot,
          departmentsSnapshot,
        ] = await Promise.all([
          get(ref(database, "attempts")),
          get(ref(database, "quizAttempts")),
          get(ref(database, "users")),
          get(ref(database, "courses")),
          get(ref(database, "departments")),
        ]);

        setRawAttempts(
          attemptsSnapshot.exists() ? attemptsSnapshot.val() : {}
        );

        setRawQuizAttempts(
          quizAttemptsSnapshot.exists()
            ? quizAttemptsSnapshot.val()
            : {}
        );

        setUsers(
          usersSnapshot.exists()
            ? toArray(usersSnapshot.val()).map((user) => ({
                ...user,
                uid: user.uid || user.id,
              }))
            : []
        );

        setCourses(
          coursesSnapshot.exists()
            ? toArray(coursesSnapshot.val())
            : []
        );

        setDepartments(
          departmentsSnapshot.exists()
            ? toArray(departmentsSnapshot.val())
            : []
        );
      } catch (error) {
        console.error("Failed to load assessment logs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const userById = useMemo(() => {
    const map = {};

    users.forEach((user) => {
      [user.id, user.uid].filter(Boolean).forEach((key) => {
        map[String(key)] = user;
      });
    });

    return map;
  }, [users]);

  const courseById = useMemo(() => {
    return Object.fromEntries(
      courses.map((course) => [String(course.id), course])
    );
  }, [courses]);

  const departmentById = useMemo(() => {
    return Object.fromEntries(
      departments.map((department) => [
        String(department.id),
        department.departmentName ||
          department.name ||
          department.title ||
          "Unnamed Department",
      ])
    );
  }, [departments]);

  const flattenedAttempts = useMemo(() => {
    const records = [];
    const dedupe = new Set();

    const pushAttempt = ({
      source,
      attemptId,
      userId,
      courseId,
      quizId,
      value,
    }) => {
      if (!value || typeof value !== "object") return;

      const resolvedUserId =
        value.userId ||
        value.uid ||
        value.createdBy ||
        userId ||
        "";

      const resolvedCourseId =
        value.courseId ||
        value.courseID ||
        courseId ||
        "";

      const resolvedQuizId =
        value.quizId ||
        value.testId ||
        value.assessmentId ||
        quizId ||
        "";

      const uniqueKey = [
        source,
        resolvedUserId,
        resolvedCourseId,
        resolvedQuizId,
        attemptId,
        getAttemptTime(value),
      ].join("|");

      if (dedupe.has(uniqueKey)) return;
      dedupe.add(uniqueKey);

      records.push({
        id:
          value.attemptId ||
          value.id ||
          attemptId ||
          uniqueKey,
        source,
        userId: String(resolvedUserId || ""),
        courseId: String(resolvedCourseId || ""),
        quizId: String(resolvedQuizId || ""),
        ...value,
      });
    };

    /*
     * Legacy attempts can be:
     * attempts/{attemptId}
     * attempts/{uid}/{attemptId}
     * attempts/{uid}/{courseId}/{attemptId}
     */
    Object.entries(rawAttempts || {}).forEach(([level1Key, level1Value]) => {
      if (!level1Value || typeof level1Value !== "object") return;

      const looksLikeAttempt =
        level1Value.score !== undefined ||
        level1Value.passed !== undefined ||
        level1Value.submittedAt !== undefined ||
        level1Value.correct !== undefined;

      if (looksLikeAttempt) {
        pushAttempt({
          source: "attempts",
          attemptId: level1Key,
          userId: level1Value.userId || level1Value.uid,
          courseId: level1Value.courseId,
          quizId: level1Value.quizId,
          value: level1Value,
        });
        return;
      }

      Object.entries(level1Value).forEach(
        ([level2Key, level2Value]) => {
          if (!level2Value || typeof level2Value !== "object") return;

          const secondLooksLikeAttempt =
            level2Value.score !== undefined ||
            level2Value.passed !== undefined ||
            level2Value.submittedAt !== undefined ||
            level2Value.correct !== undefined;

          if (secondLooksLikeAttempt) {
            pushAttempt({
              source: "attempts",
              attemptId: level2Key,
              userId: level1Key,
              courseId: level2Value.courseId,
              quizId: level2Value.quizId,
              value: level2Value,
            });
            return;
          }

          Object.entries(level2Value).forEach(
            ([level3Key, level3Value]) => {
              pushAttempt({
                source: "attempts",
                attemptId: level3Key,
                userId: level1Key,
                courseId: level2Key,
                quizId: level3Value?.quizId,
                value: level3Value,
              });
            }
          );
        }
      );
    });

    /*
     * Normalized quizAttempts:
     * quizAttempts/{uid}/{courseId}/{quizId}
     * Some installations keep multiple tries below the quiz node.
     */
    Object.entries(rawQuizAttempts || {}).forEach(
      ([userId, userCourses]) => {
        if (!userCourses || typeof userCourses !== "object") return;

        Object.entries(userCourses).forEach(
          ([courseId, courseQuizzes]) => {
            if (!courseQuizzes || typeof courseQuizzes !== "object") {
              return;
            }

            Object.entries(courseQuizzes).forEach(
              ([quizId, quizValue]) => {
                if (!quizValue || typeof quizValue !== "object") return;

                const looksLikeAttempt =
                  quizValue.score !== undefined ||
                  quizValue.passed !== undefined ||
                  quizValue.submittedAt !== undefined ||
                  quizValue.correct !== undefined ||
                  quizValue.status !== undefined;

                if (looksLikeAttempt) {
                  pushAttempt({
                    source: "quizAttempts",
                    attemptId: quizId,
                    userId,
                    courseId,
                    quizId,
                    value: quizValue,
                  });
                  return;
                }

                Object.entries(quizValue).forEach(
                  ([attemptId, attemptValue]) => {
                    pushAttempt({
                      source: "quizAttempts",
                      attemptId,
                      userId,
                      courseId,
                      quizId,
                      value: attemptValue,
                    });
                  }
                );
              }
            );
          }
        );
      }
    );

    return records.map((attempt) => {
      const user = userById[attempt.userId] || {};
      const course = courseById[attempt.courseId] || {};

      const departmentId =
        attempt.departmentId ||
        user.departmentId ||
        course.departmentId ||
        "";

      const departmentName =
        attempt.departmentName ||
        attempt.department ||
        user.departmentName ||
        user.department ||
        course.departmentName ||
        course.department ||
        departmentById[String(departmentId)] ||
        "Not Assigned";

      const testTypeRaw = String(
        attempt.testType ||
          attempt.quizType ||
          attempt.type ||
          attempt.contextType ||
          ""
      ).toLowerCase();

      const testType =
        testTypeRaw.includes("video") ||
        testTypeRaw.includes("revision") ||
        attempt.videoId
          ? "Video Quiz"
          : "Course Test";

      const correct = Number(
        attempt.correct ??
          attempt.correctAnswers ??
          attempt.correctCount ??
          attempt.obtainedMarks ??
          0
      );

      const total = Number(
        attempt.total ??
          attempt.totalQuestions ??
          attempt.questionCount ??
          attempt.totalMarks ??
          0
      );

      return {
        ...attempt,
        userName:
          attempt.userName ||
          user.name ||
          user.fullName ||
          user.displayName ||
          "Unnamed User",
        userEmail:
          attempt.userEmail ||
          user.email ||
          "Email unavailable",
        userRole: normalizeRole(
          attempt.userRole || user.role || "user"
        ),
        designation:
          attempt.designation ||
          user.designation ||
          "Not specified",
        departmentId: String(departmentId || ""),
        departmentName,
        courseTitle:
          attempt.courseTitle ||
          attempt.videoTitle ||
          getCourseTitle(course) ||
          "Untitled Course",
        testTitle: getQuizTitle({
          ...attempt,
          courseTitle:
            attempt.courseTitle ||
            getCourseTitle(course),
        }),
        testType,
        score: getAttemptScore(attempt),
        passed: isAttemptPassed(attempt),
        correct: Number.isFinite(correct) ? correct : 0,
        total: Number.isFinite(total) ? total : 0,
        attemptTime: getAttemptTime(attempt),
        submittedAt:
          attempt.submittedAt ||
          attempt.completedAt ||
          attempt.createdAt ||
          attempt.attemptedAt ||
          attempt.updatedAt ||
          "",
      };
    });
  }, [
    rawAttempts,
    rawQuizAttempts,
    userById,
    courseById,
    departmentById,
  ]);

  const attemptNumberById = useMemo(() => {
    const groups = {};

    [...flattenedAttempts]
      .sort((a, b) => a.attemptTime - b.attemptTime)
      .forEach((attempt) => {
        const key = [
          attempt.userId,
          attempt.courseId,
          attempt.quizId || attempt.testTitle,
        ].join("|");

        groups[key] = (groups[key] || 0) + 1;
        attempt._attemptNumber = groups[key];
      });

    return Object.fromEntries(
      flattenedAttempts.map((attempt) => [
        attempt.id,
        attempt._attemptNumber || 1,
      ])
    );
  }, [flattenedAttempts]);

  const courseOptions = useMemo(() => {
    return [...new Set(
      flattenedAttempts
        .map((attempt) => attempt.courseTitle)
        .filter(Boolean)
    )].sort();
  }, [flattenedAttempts]);

  const departmentOptions = useMemo(() => {
    return [...new Set(
      flattenedAttempts
        .map((attempt) => attempt.departmentName)
        .filter(Boolean)
    )].sort();
  }, [flattenedAttempts]);

  const filteredAttempts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = flattenedAttempts.filter((attempt) => {
      const searchableText = [
        attempt.userName,
        attempt.userEmail,
        attempt.designation,
        attempt.departmentName,
        attempt.courseTitle,
        attempt.testTitle,
        attempt.testType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (
        normalizedSearch &&
        !searchableText.includes(normalizedSearch)
      ) {
        return false;
      }

      if (
        statusFilter &&
        (statusFilter === "passed"
          ? !attempt.passed
          : attempt.passed)
      ) {
        return false;
      }

      if (
        courseFilter &&
        attempt.courseTitle !== courseFilter
      ) {
        return false;
      }

      if (
        departmentFilter &&
        attempt.departmentName !== departmentFilter
      ) {
        return false;
      }

      if (
        testTypeFilter &&
        attempt.testType !== testTypeFilter
      ) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "oldest") {
        return a.attemptTime - b.attemptTime;
      }

      if (sortBy === "scoreHigh") {
        return b.score - a.score;
      }

      if (sortBy === "scoreLow") {
        return a.score - b.score;
      }

      if (sortBy === "user") {
        return a.userName.localeCompare(b.userName);
      }

      return b.attemptTime - a.attemptTime;
    });
  }, [
    flattenedAttempts,
    search,
    statusFilter,
    courseFilter,
    departmentFilter,
    testTypeFilter,
    sortBy,
  ]);

  const summary = useMemo(() => {
    const totalAttempts = flattenedAttempts.length;
    const passed = flattenedAttempts.filter(
      (attempt) => attempt.passed
    ).length;
    const failed = totalAttempts - passed;
    const uniqueUsers = new Set(
      flattenedAttempts
        .map((attempt) => attempt.userId)
        .filter(Boolean)
    ).size;

    const passRate =
      totalAttempts > 0
        ? Math.round((passed / totalAttempts) * 100)
        : 0;

    return {
      totalAttempts,
      passed,
      failed,
      uniqueUsers,
      passRate,
    };
  }, [flattenedAttempts]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setCourseFilter("");
    setDepartmentFilter("");
    setTestTypeFilter("");
    setSortBy("latest");
  };

  const downloadCsv = () => {
    const rows = filteredAttempts.map((attempt) => ({
      User: attempt.userName,
      Email: attempt.userEmail,
      Designation: attempt.designation,
      Department: attempt.departmentName,
      Course: attempt.courseTitle,
      Test: attempt.testTitle,
      Type: attempt.testType,
      "Attempt No.": attemptNumberById[attempt.id] || 1,
      Score: `${attempt.score}%`,
      Correct:
        attempt.total > 0
          ? `${attempt.correct}/${attempt.total}`
          : "—",
      Status: attempt.passed ? "Passed" : "Failed",
      Submitted: formatDateTime(attempt.submittedAt),
    }));

    if (rows.length === 0) return;

    const headers = Object.keys(rows[0]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map(
            (header) =>
              `"${String(row[header] ?? "").replace(/"/g, '""')}"`
          )
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `super-admin-test-logs-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="admin-log-page">
        <div className="admin-log-loading">
          Loading test logs...
        </div>
      </div>
    );
  }

  return (
    <div className="admin-log-page">
      <section className="admin-log-hero">
        <div>
          <Link
            to="/super-admin"
            className="admin-log-back"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>

          <h1>All User Test Logs</h1>

          <p>
            Review every course test and video quiz attempt
            across all users, departments and courses.
          </p>
        </div>

        <button
          type="button"
          className="admin-log-export"
          onClick={downloadCsv}
          disabled={filteredAttempts.length === 0}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="m7 10 5 5 5-5" />
            <path d="M12 15V3" />
          </svg>
          Export CSV
        </button>
      </section>

      <section className="log-summary-grid">
        <div className="log-summary-card users">
          <div className="log-summary-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            </svg>
          </div>
          <div>
            <span>Users Attempted</span>
            <h2>{summary.uniqueUsers}</h2>
            <p>Unique users with submissions</p>
          </div>
        </div>

        <div className="log-summary-card attempts">
          <div className="log-summary-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div>
            <span>Total Attempts</span>
            <h2>{summary.totalAttempts}</h2>
            <p>All submitted assessments</p>
          </div>
        </div>

        <div className="log-summary-card passed">
          <div className="log-summary-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m8 12 2.5 2.5L16 9" />
            </svg>
          </div>
          <div>
            <span>Passed</span>
            <h2>{summary.passed}</h2>
            <p>{summary.passRate}% overall pass rate</p>
          </div>
        </div>

        <div className="log-summary-card failed">
          <div className="log-summary-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6" />
              <path d="m9 9 6 6" />
            </svg>
          </div>
          <div>
            <span>Failed</span>
            <h2>{summary.failed}</h2>
            <p>Attempts needing improvement</p>
          </div>
        </div>
      </section>

      <section className="log-control-card">
        <div className="log-search-box">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>

          <input
            type="text"
            placeholder="Search user, email, test, course, department..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
        >
          <option value="">All Status</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
        </select>

        <select
          value={testTypeFilter}
          onChange={(event) =>
            setTestTypeFilter(event.target.value)
          }
        >
          <option value="">All Test Types</option>
          <option value="Course Test">Course Test</option>
          <option value="Video Quiz">Video Quiz</option>
        </select>

        <select
          value={departmentFilter}
          onChange={(event) =>
            setDepartmentFilter(event.target.value)
          }
        >
          <option value="">All Departments</option>
          {departmentOptions.map((department) => (
            <option
              key={department}
              value={department}
            >
              {department}
            </option>
          ))}
        </select>

        <select
          value={courseFilter}
          onChange={(event) =>
            setCourseFilter(event.target.value)
          }
        >
          <option value="">All Courses</option>
          {courseOptions.map((course) => (
            <option key={course} value={course}>
              {course}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(event) =>
            setSortBy(event.target.value)
          }
        >
          <option value="latest">Latest First</option>
          <option value="oldest">Oldest First</option>
          <option value="scoreHigh">Highest Score</option>
          <option value="scoreLow">Lowest Score</option>
          <option value="user">User Name</option>
        </select>

        <button
          type="button"
          className="log-reset-btn"
          onClick={resetFilters}
        >
          Reset
        </button>
      </section>

      <section className="log-table-card">
        <div className="log-table-title-row">
          <div>
            <h2>Assessment Submission Records</h2>
            <p>
              Showing {filteredAttempts.length} of{" "}
              {flattenedAttempts.length} attempts
            </p>
          </div>

          <span className="log-record-count">
            {filteredAttempts.length} records
          </span>
        </div>

        {filteredAttempts.length === 0 ? (
          <div className="empty-log-state">
            <div className="empty-log-icon">⌕</div>
            <h3>No test logs found</h3>
            <p>
              No submissions match the selected filters.
            </p>
          </div>
        ) : (
          <div className="log-table-wrapper">
            <table className="admin-log-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Department</th>
                  <th>Course</th>
                  <th>Test</th>
                  <th>Type</th>
                  <th>Attempt</th>
                  <th>Score</th>
                  <th>Correct</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                </tr>
              </thead>

              <tbody>
                {filteredAttempts.map((attempt, index) => (
                  <tr key={`${attempt.source}-${attempt.id}-${index}`}>
                    <td className="log-index-cell">
                      {index + 1}
                    </td>

                    <td>
                      <div className="log-user-cell">
                        <div className="log-user-avatar">
                          {(attempt.userName || "U")
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>{attempt.userName}</strong>
                          <small>{attempt.userEmail}</small>
                          <em>{attempt.designation}</em>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="log-department-pill">
                        {attempt.departmentName}
                      </span>
                    </td>

                    <td>
                      <span className="log-course-name">
                        {attempt.courseTitle}
                      </span>
                    </td>

                    <td>
                      <div className="log-test-cell">
                        <strong>{attempt.testTitle}</strong>
                        {attempt.quizId && (
                          <small>
                            ID: {attempt.quizId.slice(0, 10)}
                          </small>
                        )}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`log-type-chip ${
                          attempt.testType === "Video Quiz"
                            ? "video"
                            : "course"
                        }`}
                      >
                        {attempt.testType}
                      </span>
                    </td>

                    <td>
                      <span className="log-attempt-chip">
                        Attempt{" "}
                        {attemptNumberById[attempt.id] || 1}
                      </span>
                    </td>

                    <td>
                      <div className="log-score-cell">
                        <div className="log-score-track">
                          <span
                            style={{
                              width: `${attempt.score}%`,
                            }}
                          />
                        </div>

                        <strong>{attempt.score}%</strong>
                      </div>
                    </td>

                    <td>
                      <span className="log-correct-chip">
                        {attempt.total > 0
                          ? `${attempt.correct}/${attempt.total}`
                          : "—"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`log-status ${
                          attempt.passed
                            ? "passed"
                            : "failed"
                        }`}
                      >
                        <span />
                        {attempt.passed
                          ? "Passed"
                          : "Failed"}
                      </span>
                    </td>

                    <td className="log-date-cell">
                      {formatDateTime(attempt.submittedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminResults;
