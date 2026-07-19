import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/departmenttestlogs.css";

import {
  FaClipboardCheck,
  FaTimesCircle,
  FaSearch,
  FaChevronDown,
} from "react-icons/fa";

const normalizeValue = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const normalizeRole = (value) =>
  normalizeValue(value).replace(/[\s_-]/g, "");

const safeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const getAttemptDate = (attempt) =>
  attempt?.submittedAt ||
  attempt?.attemptedAt ||
  attempt?.completedAt ||
  attempt?.createdAt ||
  attempt?.timestamp ||
  null;

const getTimestamp = (value) => {
  if (!value) return 0;

  if (typeof value === "number") {
    return value;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const isAttemptObject = (value) => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    value.courseId !== undefined ||
    value.assignedCourseId !== undefined ||
    value.score !== undefined ||
    value.percentage !== undefined ||
    value.passed !== undefined ||
    value.isPassed !== undefined ||
    value.correct !== undefined ||
    value.correctAnswers !== undefined ||
    value.submittedAt !== undefined ||
    value.attemptedAt !== undefined
  );
};

const isFinalCourseAttempt = (attempt) => {
  if (!attempt || typeof attempt !== "object") {
    return false;
  }

  const quizType = normalizeValue(
    attempt.quizType ||
      attempt.testType ||
      attempt.type ||
      attempt.attemptType
  );

  const reason = normalizeValue(attempt.reason);

  if (attempt.videoId) {
    return false;
  }

  if (
    quizType.includes("practice") ||
    quizType.includes("video")
  ) {
    return false;
  }

  if (
    reason.includes("video_revision_quiz") ||
    reason.includes("practice")
  ) {
    return false;
  }

  return Boolean(
    attempt.courseId ||
      attempt.assignedCourseId ||
      attempt.score !== undefined ||
      attempt.percentage !== undefined ||
      attempt.passed !== undefined ||
      attempt.isPassed !== undefined ||
      attempt.correct !== undefined ||
      attempt.submittedAt ||
      attempt.attemptedAt
  );
};

const getAttemptDetails = (attempt, course) => {
  const correct = safeNumber(
    attempt.correct ??
      attempt.correctAnswers ??
      attempt.marksObtained ??
      attempt.obtainedMarks
  );

  const total = safeNumber(
    attempt.total ??
      attempt.totalMarks ??
      attempt.totalQuestions ??
      attempt.maximumMarks ??
      attempt.maxMarks
  );

  let score = safeNumber(
    attempt.percentage ??
      attempt.scorePercentage ??
      attempt.marksPercentage ??
      attempt.score
  );

  const hasExplicitPercentage =
    attempt.percentage !== undefined ||
    attempt.scorePercentage !== undefined ||
    attempt.marksPercentage !== undefined;

  if (
    !hasExplicitPercentage &&
    total > 0 &&
    score > 0 &&
    score <= total
  ) {
    score = (score / total) * 100;
  } else if (score === 0 && total > 0 && correct > 0) {
    score = (correct / total) * 100;
  }

  score = Math.max(0, Math.min(score, 100));

  const passingPercentage = safeNumber(
    course?.passingPercentage ??
      course?.passPercentage ??
      course?.minimumPassingPercentage ??
      course?.passingMarks ??
      60
  );

  const statusValue = normalizeValue(
    attempt.status || attempt.result
  );

  let passed = false;

  if (typeof attempt.passed === "boolean") {
    passed = attempt.passed;
  } else if (typeof attempt.isPassed === "boolean") {
    passed = attempt.isPassed;
  } else if (
    statusValue === "passed" ||
    statusValue === "pass"
  ) {
    passed = true;
  } else if (
    statusValue === "failed" ||
    statusValue === "fail"
  ) {
    passed = false;
  } else {
    passed = score >= passingPercentage;
  }

  return {
    score: Number(score.toFixed(2)),
    correct,
    total,
    passed,
    submittedAt: getAttemptDate(attempt),
  };
};

function DepartmentTestLogs() {
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [attempts, setAttempts] = useState({});
  const [quizAttempts, setQuizAttempts] = useState({});

  const [selectedCourseId, setSelectedCourseId] =
    useState("");

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [adminId, setAdminId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departmentName, setDepartmentName] = useState("");

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (loggedUser) => {
        if (!loggedUser) {
          if (isMounted) {
            setError("Please login to view test logs.");
            setLoading(false);
          }

          return;
        }

        try {
          setLoading(true);
          setError("");

          const [
            loggedUserSnapshot,
            departmentsSnapshot,
            coursesSnapshot,
            usersSnapshot,
            assignmentsSnapshot,
            attemptsSnapshot,
            quizAttemptsSnapshot,
          ] = await Promise.all([
            get(ref(database, `users/${loggedUser.uid}`)),
            get(ref(database, "departments")),
            get(ref(database, "courses")),
            get(ref(database, "users")),
            get(ref(database, "userAssignments")),
            get(ref(database, "attempts")),
            get(ref(database, "quizAttempts")),
          ]);

          if (!isMounted) {
            return;
          }

          if (!loggedUserSnapshot.exists()) {
            throw new Error(
              "Logged-in Department Admin profile not found."
            );
          }

          const loggedUserData = {
            id: loggedUser.uid,
            ...loggedUserSnapshot.val(),
          };

          if (
            normalizeRole(loggedUserData.role) !==
            "departmentadmin"
          ) {
            throw new Error(
              "Only Department Admin can access this page."
            );
          }

          let resolvedDepartmentId = String(
            loggedUserData.departmentId || ""
          ).trim();

          let resolvedDepartmentName =
            loggedUserData.department ||
            loggedUserData.departmentName ||
            "";

          const departmentsData =
            departmentsSnapshot.exists()
              ? departmentsSnapshot.val()
              : {};

          const matchedDepartment = Object.entries(
            departmentsData
          ).find(([, department]) => {
            const departmentAdminId = String(
              department?.departmentAdminId ||
                department?.adminId ||
                ""
            ).trim();

            return departmentAdminId === loggedUser.uid;
          });

          if (matchedDepartment) {
            const [
              matchedDepartmentId,
              matchedDepartmentData,
            ] = matchedDepartment;

            resolvedDepartmentId =
              resolvedDepartmentId ||
              matchedDepartmentId;

            resolvedDepartmentName =
              resolvedDepartmentName ||
              matchedDepartmentData?.departmentName ||
              matchedDepartmentData?.name ||
              "";
          }

          const allCourses = coursesSnapshot.exists()
            ? Object.entries(coursesSnapshot.val()).map(
                ([id, course]) => ({
                  id,
                  ...course,
                })
              )
            : [];

          const allUsers = usersSnapshot.exists()
            ? Object.entries(usersSnapshot.val()).map(
                ([id, user]) => ({
                  id,
                  ...user,
                })
              )
            : [];

          const allAssignments =
            assignmentsSnapshot.exists()
              ? assignmentsSnapshot.val()
              : {};

          const assignedCourseIds = new Set();

          Object.entries(allAssignments).forEach(
            ([, userCourses]) => {
              Object.entries(userCourses || {}).forEach(
                ([courseId, assignment]) => {
                  if (!assignment?.assigned) {
                    return;
                  }

                  const assignedBy = String(
                    assignment.assignedBy ||
                      assignment.assignedById ||
                      assignment.departmentAdminId ||
                      ""
                  ).trim();

                  if (assignedBy === loggedUser.uid) {
                    assignedCourseIds.add(courseId);
                  }
                }
              );
            }
          );

          const visibleCourses = allCourses.filter(
            (course) => {
              const createdBy = String(
                course.createdBy ||
                  course.createdById ||
                  course.departmentAdminId ||
                  ""
              ).trim();

              const courseDepartmentId = String(
                course.departmentId || ""
              ).trim();

              const courseDepartmentName = normalizeValue(
                course.department ||
                  course.departmentName
              );

              return (
                createdBy === loggedUser.uid ||
                assignedCourseIds.has(course.id) ||
                (resolvedDepartmentId &&
                  courseDepartmentId ===
                    resolvedDepartmentId) ||
                (resolvedDepartmentName &&
                  courseDepartmentName ===
                    normalizeValue(
                      resolvedDepartmentName
                    ))
              );
            }
          );

          setAdminId(loggedUser.uid);
          setDepartmentId(resolvedDepartmentId);
          setDepartmentName(resolvedDepartmentName);

          setCourses(visibleCourses);
          setUsers(allUsers);
          setAssignments(allAssignments);

          setAttempts(
            attemptsSnapshot.exists()
              ? attemptsSnapshot.val()
              : {}
          );

          setQuizAttempts(
            quizAttemptsSnapshot.exists()
              ? quizAttemptsSnapshot.val()
              : {}
          );

          setSelectedCourseId((currentCourseId) => {
            const currentCourseStillExists =
              visibleCourses.some(
                (course) =>
                  course.id === currentCourseId
              );

            if (currentCourseStillExists) {
              return currentCourseId;
            }

            return visibleCourses[0]?.id || "";
          });
        } catch (fetchError) {
          console.error(
            "[DepartmentTestLogs] Error:",
            fetchError
          );

          if (isMounted) {
            setError(
              fetchError?.message ||
                "Failed to load test logs."
            );
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const selectedCourse = useMemo(() => {
    return (
      courses.find(
        (course) => course.id === selectedCourseId
      ) || null
    );
  }, [courses, selectedCourseId]);

  const isUserAssignedToCourse = (user, courseId) => {
    const assignment =
      assignments?.[user.id]?.[courseId];

    if (!assignment?.assigned) {
      return false;
    }

    const assignedBy = String(
      assignment.assignedBy ||
        assignment.assignedById ||
        assignment.departmentAdminId ||
        ""
    ).trim();

    /*
     * New assignments:
     * Show only assignments created by this Department Admin.
     */
    if (assignedBy) {
      return assignedBy === adminId;
    }

    /*
     * Old assignments may not have assignedBy.
     * In that case, match using user/course department.
     */
    const userDepartmentId = String(
      user.departmentId || ""
    ).trim();

    const userDepartmentName = normalizeValue(
      user.department || user.departmentName
    );

    const course = courses.find(
      (item) => item.id === courseId
    );

    const courseCreatedBy = String(
      course?.createdBy ||
        course?.createdById ||
        course?.departmentAdminId ||
        ""
    ).trim();

    const courseDepartmentId = String(
      course?.departmentId || ""
    ).trim();

    const courseDepartmentName = normalizeValue(
      course?.department ||
        course?.departmentName
    );

    return (
      courseCreatedBy === adminId ||
      (departmentId &&
        userDepartmentId === departmentId) ||
      (departmentName &&
        userDepartmentName ===
          normalizeValue(departmentName)) ||
      (departmentId &&
        courseDepartmentId === departmentId) ||
      (departmentName &&
        courseDepartmentName ===
          normalizeValue(departmentName))
    );
  };

  const assignedUsers = useMemo(() => {
    if (!selectedCourseId) {
      return [];
    }

    return users.filter((user) =>
      isUserAssignedToCourse(
        user,
        selectedCourseId
      )
    );
  }, [
    users,
    assignments,
    selectedCourseId,
    adminId,
    departmentId,
    departmentName,
    courses,
  ]);

  const resultRows = useMemo(() => {
    if (!selectedCourseId || !selectedCourse) {
      return [];
    }

    const assignedUserIds = new Set(
      assignedUsers.map((user) => user.id)
    );

    const rows = [];
    const usedAttemptKeys = new Set();

    const addResultRow = ({
      userId,
      courseId,
      attempt,
      attemptId,
      source,
    }) => {
      if (!assignedUserIds.has(userId)) {
        return;
      }

      if (!isFinalCourseAttempt(attempt)) {
        return;
      }

      const resolvedCourseId = String(
        attempt.courseId ||
          attempt.assignedCourseId ||
          courseId ||
          ""
      ).trim();

      if (resolvedCourseId !== selectedCourseId) {
        return;
      }

      const user = users.find(
        (item) => item.id === userId
      );

      const details = getAttemptDetails(
        attempt,
        selectedCourse
      );

      const resolvedAttemptId = String(
        attempt.id ||
          attempt.attemptId ||
          attemptId ||
          ""
      );

      /*
       * Do not include source in dedupe key.
       * This avoids showing the same result twice if it exists
       * under both attempts and quizAttempts.
       */
      const uniqueKey = [
        userId,
        resolvedCourseId,
        resolvedAttemptId,
        details.score,
        details.correct,
        details.total,
        getTimestamp(details.submittedAt),
      ].join("|");

      if (usedAttemptKeys.has(uniqueKey)) {
        return;
      }

      usedAttemptKeys.add(uniqueKey);

      rows.push({
        id: uniqueKey,
        source,
        attemptId: resolvedAttemptId,
        userId,

        userName:
          user?.name ||
          user?.fullName ||
          user?.displayName ||
          attempt.userName ||
          "Unnamed User",

        userEmail:
          user?.email ||
          attempt.userEmail ||
          "",

        employeeId:
          user?.employeeId ||
          user?.employeeCode ||
          user?.userCode ||
          "",

        designation:
          user?.designation ||
          user?.jobTitle ||
          user?.position ||
          "",

        courseId: resolvedCourseId,

        courseTitle:
          attempt.courseTitle ||
          selectedCourse.title ||
          selectedCourse.courseTitle ||
          selectedCourse.name ||
          "Training Course",

        ...details,
      });
    };

    /*
     * Supported attempts structures:
     *
     * attempts/{userId}/{attemptId}
     * attempts/{userId}/{courseId}/{attemptId}
     * attempts/{userId}/{courseId}
     */
    Object.entries(attempts || {}).forEach(
      ([userId, userAttempts]) => {
        if (!assignedUserIds.has(userId)) {
          return;
        }

        Object.entries(userAttempts || {}).forEach(
          ([firstKey, firstValue]) => {
            if (isAttemptObject(firstValue)) {
              addResultRow({
                userId,
                courseId:
                  firstValue.courseId || firstKey,
                attempt: firstValue,
                attemptId: firstKey,
                source: "attempts",
              });

              return;
            }

            Object.entries(firstValue || {}).forEach(
              ([secondKey, secondValue]) => {
                if (!isAttemptObject(secondValue)) {
                  return;
                }

                addResultRow({
                  userId,
                  courseId: firstKey,
                  attempt: secondValue,
                  attemptId: secondKey,
                  source: "attempts",
                });
              }
            );
          }
        );
      }
    );

    /*
     * Supported quizAttempts structures:
     *
     * quizAttempts/{userId}/{courseId}/{attemptId}
     * quizAttempts/{userId}/{courseId}
     */
    Object.entries(quizAttempts || {}).forEach(
      ([userId, userCourses]) => {
        if (!assignedUserIds.has(userId)) {
          return;
        }

        Object.entries(userCourses || {}).forEach(
          ([courseId, courseAttempts]) => {
            if (isAttemptObject(courseAttempts)) {
              addResultRow({
                userId,
                courseId,
                attempt: courseAttempts,
                attemptId: courseId,
                source: "quizAttempts",
              });

              return;
            }

            Object.entries(courseAttempts || {}).forEach(
              ([attemptId, attempt]) => {
                if (!isAttemptObject(attempt)) {
                  return;
                }

                addResultRow({
                  userId,
                  courseId,
                  attempt,
                  attemptId,
                  source: "quizAttempts",
                });
              }
            );
          }
        );
      }
    );

    return rows.sort(
      (first, second) =>
        getTimestamp(second.submittedAt) -
        getTimestamp(first.submittedAt)
    );
  }, [
    attempts,
    quizAttempts,
    users,
    assignedUsers,
    selectedCourseId,
    selectedCourse,
  ]);

  const filteredRows = useMemo(() => {
    const searchText = normalizeValue(search);

    if (!searchText) {
      return resultRows;
    }

    return resultRows.filter((row) => {
      const searchableText = [
        row.userName,
        row.userEmail,
        row.employeeId,
        row.designation,
        row.courseTitle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(searchText);
    });
  }, [resultRows, search]);

  const courseAssignedCounts = useMemo(() => {
    const counts = {};

    courses.forEach((course) => {
      counts[course.id] = users.filter((user) =>
        isUserAssignedToCourse(user, course.id)
      ).length;
    });

    return counts;
  }, [
    courses,
    users,
    assignments,
    adminId,
    departmentId,
    departmentName,
  ]);

  const formatDate = (date) => {
    if (!date) {
      return "-";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "-";
    }

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatScore = (score) => {
    const numericScore = safeNumber(score);

    return Number.isInteger(numericScore)
      ? `${numericScore}%`
      : `${numericScore.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="department-results-loading">
        Loading Test Logs...
      </div>
    );
  }

  if (error) {
    return (
      <div className="department-test-logs-page">
        <div className="department-results-error">
          <FaTimesCircle />

          <div>
            <h2>Unable to load test logs</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="department-test-logs-page">
      <div className="department-test-page-header">
        <h1>Test Logs</h1>

        <p>
          View final course test attempts of assigned users.
        </p>
      </div>

      <section className="department-test-content-card">
        <div className="department-course-filter-row">
          <div className="department-course-select-wrapper">
            <label htmlFor="test-log-course">
              Select Course
            </label>

            <div className="department-course-select">
              <select
                id="test-log-course"
                value={selectedCourseId}
                onChange={(event) => {
                  setSelectedCourseId(event.target.value);
                  setSearch("");
                }}
              >
                {courses.length === 0 ? (
                  <option value="">
                    No courses available
                  </option>
                ) : (
                  courses.map((course) => (
                    <option
                      key={course.id}
                      value={course.id}
                    >
                      {course.title ||
                        course.courseTitle ||
                        course.name ||
                        "Untitled Course"}{" "}
                      (
                      {courseAssignedCounts[
                        course.id
                      ] || 0}{" "}
                      users)
                    </option>
                  ))
                )}
              </select>

              <FaChevronDown />
            </div>
          </div>

          <div className="department-results-search-wrapper">
            <label htmlFor="test-log-search">
              Search User
            </label>

            <div className="department-results-search">
              <FaSearch />

              <input
                id="test-log-search"
                type="text"
                placeholder="Search name, email or designation..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>
          </div>
        </div>

        {courses.length === 0 ? (
          <div className="department-no-course">
            <FaClipboardCheck />

            <h3>No courses found</h3>

            <p>
              Courses assigned to your department will
              appear here.
            </p>
          </div>
        ) : (
          <div className="department-results-table-card">
            {filteredRows.length === 0 ? (
              <div className="department-results-empty">
                <FaClipboardCheck />

                <h3>No final test attempts found</h3>

                <p>
                  No assigned user has attempted the
                  selected course test yet.
                </p>
              </div>
            ) : (
              <div className="department-results-table-scroll">
                <table className="department-clean-results-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Course Name</th>
                      <th>Score</th>
                      <th>Correct</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRows.map((result) => (
                      <tr key={result.id}>
                        <td>
                          <div className="department-result-user">
                            <div className="department-user-avatar">
                              {result.userName
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>
                              <strong>
                                {result.userName}
                              </strong>

                              {result.userEmail && (
                                <small>
                                  {result.userEmail}
                                </small>
                              )}

                              {result.designation && (
                                <small>
                                  {result.designation}
                                </small>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="department-course-name">
                            {result.courseTitle}
                          </span>
                        </td>

                        <td>
                          <strong className="department-score-value">
                            {formatScore(result.score)}
                          </strong>
                        </td>

                        <td>{result.correct}</td>

                        <td>{result.total}</td>

                        <td>
                          <span
                            className={`department-result-status ${
                              result.passed
                                ? "passed"
                                : "failed"
                            }`}
                          >
                            {result.passed
                              ? "Passed"
                              : "Failed"}
                          </span>
                        </td>

                        <td className="department-result-date">
                          {formatDate(
                            result.submittedAt
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default DepartmentTestLogs;