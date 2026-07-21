import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { get, ref, set, update } from "firebase/database";
import { auth, database } from "../firebase";
import useBasePath from "../hooks/useBasePath";
import {
  coursePath,
  courseVideosForCoursePath,
  questionsForCoursePath,
  videoProgressForCoursePath,
  courseProgressForCoursePath,
  quizAttemptsForCoursePath,
  quizAttemptPath,
  legacyCompletedCoursePath,
  legacyAttemptsPath,
  legacyAttemptPath,
  legacyResultsPath,
} from "../services/dbPaths";
import "../styles/quizpage.css";

function QuizPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const basePath = useBasePath();

  const isVideoQuiz = searchParams.get("type") === "video";
  const resultMode = searchParams.get("mode") === "result";
  const courseIdFromQuery = searchParams.get("courseId");
  const videoIdFromQuery = searchParams.get("videoId");

  const [course, setCourse] = useState(null);
  const [video, setVideo] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quizStarted, setQuizStarted] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [securityMessage, setSecurityMessage] = useState("");
  const [existingFinalResult, setExistingFinalResult] = useState(null);

  const submittedRef = useRef(false);
  const warningCountRef = useRef(0);
  const examRootRef = useRef(null);

  const activeCourseId = isVideoQuiz ? courseIdFromQuery : id;
  const activeVideoId = isVideoQuiz ? videoIdFromQuery || id : null;

  const courseUrl = (courseId) => `${basePath}/course/${courseId}`;
  const videoUrl = (courseId, targetVideoId) =>
    `${basePath}/course/${courseId}/video/${targetVideoId}`;

  const getQuestionText = (question) =>
    question?.question || question?.questionText || "";

  const getQuestionOptions = (question) => {
    if (Array.isArray(question?.options)) return question.options;

    return [
      question?.optionA || question?.option1,
      question?.optionB || question?.option2,
      question?.optionC || question?.option3,
      question?.optionD || question?.option4,
    ].filter(Boolean);
  };

  const isAnswerCorrect = (question, selectedAnswer) => {
    const options = getQuestionOptions(question);
    const selectedIndex = options.findIndex(
      (option) => String(option) === String(selectedAnswer)
    );

    if (selectedIndex < 0) return false;

    const correctIndex = Number(question?.correctOptionIndex);
    if (Number.isInteger(correctIndex) && correctIndex === selectedIndex) {
      return true;
    }

    const correctOption = String(question?.correctOption || "").trim().toUpperCase();
    if (
      correctOption &&
      correctOption === String.fromCharCode(65 + selectedIndex)
    ) {
      return true;
    }

    return String(question?.correctAnswer ?? "") === String(selectedAnswer);
  };

  useEffect(() => {
    setCourse(null);
    setVideo(null);
    setQuizQuestions([]);
    setCurrentIndex(0);
    setTimeLeft(60);
    setAnswers({});
    setSubmitted(false);
    submittedRef.current = false;
    setLoading(true);
    setQuizStarted(false);
    setWarningCount(0);
    warningCountRef.current = 0;
    setSecurityMessage("");
    setExistingFinalResult(null);

    const fetchQuizData = async () => {
      const user = auth.currentUser;

      if (!user) {
        navigate("/");
        return;
      }

      if (!activeCourseId) {
        alert("Course not found");
        navigate(`${basePath}/assigned-courses`);
        return;
      }

      try {
        const [
          courseSnapshot,
          oldVideosSnapshot,
          videoLibrarySnapshot,
          courseVideosSnapshot,
          questionsSnapshot,
          videoQuestionsSnapshot,
          completedCourseSnapshot,
          courseProgressSnapshot,
          legacyAttemptsSnapshot,
          legacyResultsSnapshot,
          normalizedAttemptsSnapshot,
        ] = await Promise.all([
          get(ref(database, coursePath(activeCourseId))),
          get(ref(database, "videos")),
          get(ref(database, "videoLibrary")),
          get(ref(database, courseVideosForCoursePath(activeCourseId))),
          get(ref(database, questionsForCoursePath(activeCourseId))),
          get(ref(database, "videoQuizzes")),
          get(ref(database, legacyCompletedCoursePath(user.uid, activeCourseId))),
          get(ref(database, courseProgressForCoursePath(user.uid, activeCourseId))),
          get(ref(database, legacyAttemptsPath(user.uid))),
          get(ref(database, legacyResultsPath(user.uid))),
          get(ref(database, quizAttemptsForCoursePath(user.uid, activeCourseId))),
        ]);

        if (!courseSnapshot.exists()) {
          alert("Course not found");
          navigate(`${basePath}/assigned-courses`);
          return;
        }

        const courseData = {
          id: activeCourseId,
          ...courseSnapshot.val(),
        };
        setCourse(courseData);

        const oldVideos = oldVideosSnapshot.exists()
          ? Object.entries(oldVideosSnapshot.val()).map(([videoId, item]) => ({
              id: videoId,
              ...(item || {}),
            }))
          : [];

        const libraryVideos = videoLibrarySnapshot.exists()
          ? Object.entries(videoLibrarySnapshot.val()).map(([videoId, item]) => ({
              id: videoId,
              ...(item || {}),
            }))
          : [];

        const courseMappings = courseVideosSnapshot.exists()
          ? courseVideosSnapshot.val() || {}
          : {};

        let courseVideos = [];

        if (courseMappings && typeof courseMappings === "object") {
          courseVideos = Object.entries(courseMappings).map(
            ([mappingId, mappedVideo = {}]) => {
              const actualVideoId = mappedVideo.videoId || mappingId;
              const fullVideo =
                libraryVideos.find((item) => item.id === actualVideoId) ||
                oldVideos.find((item) => item.id === actualVideoId) ||
                {};

              return {
                ...fullVideo,
                ...mappedVideo,
                id: actualVideoId,
                mappingId,
                courseId: activeCourseId,
              };
            }
          );
        } else if (Array.isArray(courseData.videoIds)) {
          courseVideos = courseData.videoIds
            .map(
              (videoId) =>
                libraryVideos.find((item) => item.id === videoId) ||
                oldVideos.find((item) => item.id === videoId)
            )
            .filter(Boolean)
            .map((item) => ({ ...item, courseId: activeCourseId }));
        } else {
          courseVideos = oldVideos
            .filter((item) => item.courseId === activeCourseId)
            .map((item) => ({ ...item, courseId: activeCourseId }));
        }

        courseVideos.sort(
          (a, b) =>
            Number(a.order || 0) - Number(b.order || 0) ||
            new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        );

        const normalizedAttempts = normalizedAttemptsSnapshot.exists()
          ? normalizedAttemptsSnapshot.val() || {}
          : {};

        if (!isVideoQuiz) {
          const completedRecord = completedCourseSnapshot.exists()
            ? completedCourseSnapshot.val()
            : null;
          const courseProgressRecord = courseProgressSnapshot.exists()
            ? courseProgressSnapshot.val()
            : null;
          const legacyAttempts = legacyAttemptsSnapshot.exists()
            ? legacyAttemptsSnapshot.val() || {}
            : {};
          const legacyResults = legacyResultsSnapshot.exists()
            ? legacyResultsSnapshot.val() || {}
            : {};

          const finalRecords = [
            ...Object.entries(normalizedAttempts)
              .filter(([, attempt]) => attempt?.quizType === "final")
              .map(([attemptId, attempt]) => ({
                id: attemptId,
                source: "quizAttempts",
                ...attempt,
              })),
            ...Object.entries(legacyAttempts).map(([attemptId, attempt]) => ({
              id: attemptId,
              source: "attempts",
              ...(attempt || {}),
            })),
            ...Object.entries(legacyResults).map(([resultId, result]) => ({
              id: resultId,
              source: "results",
              ...(result || {}),
            })),
          ].filter(
            (record) =>
              record.courseId === activeCourseId &&
              !record.videoId &&
              record.quizType !== "practice"
          );

          const latestPassed = finalRecords
            .filter(
              (record) =>
                record.passed === true ||
                record.isPassed === true ||
                String(record.status || "").toLowerCase() === "passed"
            )
            .sort(
              (a, b) =>
                new Date(
                  b.submittedAt ||
                    b.attemptedAt ||
                    b.completedAt ||
                    b.createdAt ||
                    0
                ) -
                new Date(
                  a.submittedAt ||
                    a.attemptedAt ||
                    a.completedAt ||
                    a.createdAt ||
                    0
                )
            )[0];

          const courseAlreadyPassed =
            completedRecord?.passed === true ||
            courseProgressRecord?.courseTestPassed === true ||
            Boolean(latestPassed);

          if (courseAlreadyPassed) {
            const source =
              latestPassed || courseProgressRecord || completedRecord || {};
            const correct = Number(
              source.correct ?? completedRecord?.correct ?? 0
            );
            const total = Number(
              source.total ??
                source.totalMarks ??
                source.totalQuestions ??
                completedRecord?.total ??
                completedRecord?.totalQuestions ??
                0
            );
            const storedPercentage = Number(
              source.percentage ??
                source.score ??
                completedRecord?.percentage ??
                completedRecord?.score ??
                NaN
            );
            const percentage = Number.isFinite(storedPercentage)
              ? Math.max(0, Math.min(100, Math.round(storedPercentage)))
              : total > 0
                ? Math.round((correct / total) * 100)
                : 0;

            setExistingFinalResult({
              passed: true,
              percentage,
              correct,
              total,
              submittedAt:
                source.submittedAt ||
                source.attemptedAt ||
                source.completedAt ||
                source.createdAt ||
                completedRecord?.completedAt ||
                "",
              attemptId:
                source.legacyAttemptId ||
                source.attemptId ||
                source.id ||
                completedRecord?.attemptId ||
                "",
            });
          }
        }

        const videoQuestionsData = videoQuestionsSnapshot.exists()
          ? videoQuestionsSnapshot.val() || {}
          : {};

        let allQuestions = [];

        if (isVideoQuiz) {
          const currentVideo =
            courseVideos.find(
              (item) =>
                item.id === activeVideoId || item.mappingId === activeVideoId
            ) ||
            oldVideos.find((item) => item.id === activeVideoId) ||
            libraryVideos.find((item) => item.id === activeVideoId);

          if (!currentVideo) {
            alert("Video not found in this course");
            navigate(courseUrl(activeCourseId));
            return;
          }

          setVideo(currentVideo);

          const acceptedIds = [
            currentVideo.id,
            currentVideo.mappingId,
            activeVideoId,
          ].filter(Boolean);

          const questionMap = new Map();

          const addQuestions = (source, sourceKey) => {
            if (!source || typeof source !== "object") return;

            Object.entries(source).forEach(([questionId, question]) => {
              if (!question || typeof question !== "object") return;
              if (!getQuestionText(question)) return;

              const explicitVideoId =
                question.videoId || question.videoID || question.lessonId;
              if (explicitVideoId && !acceptedIds.includes(explicitVideoId)) {
                return;
              }

              const uniqueKey = `${sourceKey}:${questionId}`;
              if (!questionMap.has(uniqueKey)) {
                questionMap.set(uniqueKey, {
                  id: uniqueKey,
                  videoId: currentVideo.id,
                  ...question,
                });
              }
            });
          };

          acceptedIds.forEach((videoKey) => {
            addQuestions(videoQuestionsData?.[videoKey], `global:${videoKey}`);
            addQuestions(
              videoQuestionsData?.[activeCourseId]?.[videoKey],
              `course:${activeCourseId}:${videoKey}`
            );
          });

          Object.entries(videoQuestionsData).forEach(([questionId, question]) => {
            if (!question || typeof question !== "object") return;
            const explicitVideoId =
              question.videoId || question.videoID || question.lessonId;
            if (explicitVideoId && acceptedIds.includes(explicitVideoId)) {
              addQuestions({ [questionId]: question }, "flat");
            }
          });

          allQuestions = [...questionMap.values()].sort(
            (a, b) => Number(a.order || 0) - Number(b.order || 0)
          );

          setTimeLeft(
            Number(
              currentVideo.testDuration || currentVideo.quizDuration || 60
            )
          );
        } else {
          const courseQuestions = questionsSnapshot.exists()
            ? questionsSnapshot.val() || {}
            : {};

          allQuestions = Object.entries(courseQuestions)
            .map(([questionId, question]) => ({
              id: questionId,
              courseId: activeCourseId,
              ...(question || {}),
            }))
            .filter((question) => getQuestionText(question))
            .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

          setTimeLeft(
            Number(courseData.testDuration || courseData.quizDuration || 60)
          );
        }

        setQuizQuestions(allQuestions);

        if (!isVideoQuiz && !resultMode && courseVideos.length > 0) {
          const videoProgressSnapshot = await get(
            ref(database, videoProgressForCoursePath(user.uid, activeCourseId))
          );
          const courseVideoProgress = videoProgressSnapshot.exists()
            ? videoProgressSnapshot.val() || {}
            : {};

          const allVideosDone = courseVideos.every((courseVideo) => {
            const progress = courseVideoProgress?.[courseVideo.id];
            return (
              progress?.completed === true ||
              Number(progress?.watchedPercent || 0) >= 100
            );
          });

          if (!allVideosDone) {
            alert(
              "Please complete all course videos before taking the final test."
            );
            navigate(courseUrl(activeCourseId));
            return;
          }

          const videosWithRevisionQuiz = courseVideos.filter((courseVideo) => {
            const acceptedIds = [courseVideo.id, courseVideo.mappingId].filter(
              Boolean
            );

            return acceptedIds.some((videoKey) => {
              const globalSource = videoQuestionsData?.[videoKey] || {};
              const courseSource =
                videoQuestionsData?.[activeCourseId]?.[videoKey] || {};

              return [...Object.values(globalSource), ...Object.values(courseSource)].some(
                (question) => getQuestionText(question)
              );
            });
          });

          if (videosWithRevisionQuiz.length > 0) {
            const practiceAttempts = Object.values(normalizedAttempts).filter(
              (attempt) => attempt?.quizType === "practice"
            );

            const allRevisionQuizzesPassed = videosWithRevisionQuiz.every(
              (courseVideo) => {
                const acceptedIds = new Set(
                  [courseVideo.id, courseVideo.mappingId].filter(Boolean)
                );

                return practiceAttempts.some((attempt) => {
                  const matchesVideo = acceptedIds.has(
                    attempt?.videoId || attempt?.mappingId
                  );
                  const score = Number(attempt?.correct ?? attempt?.score ?? 0);
                  const total = Number(attempt?.totalMarks ?? attempt?.total ?? 0);
                  const calculatedPassed =
                    total > 0 && score >= Math.ceil(total * 0.7);

                  return (
                    matchesVideo &&
                    (attempt?.passed === true || calculatedPassed)
                  );
                });
              }
            );

            if (!allRevisionQuizzesPassed) {
              alert(
                "Please pass every required revision quiz before taking the final test."
              );
              navigate(courseUrl(activeCourseId));
              return;
            }
          }
        }

        setLoading(false);
      } catch (error) {
        console.error("Failed to load quiz:", error);
        alert("Failed to load quiz");
        setLoading(false);
      }
    };

    fetchQuizData();
  }, [
    activeCourseId,
    activeVideoId,
    basePath,
    isVideoQuiz,
    navigate,
    resultMode,
  ]);

  const currentQuestion = quizQuestions[currentIndex];

  const progressPercent = useMemo(() => {
    if (quizQuestions.length === 0) return 0;
    return Math.round(((currentIndex + 1) / quizQuestions.length) * 100);
  }, [currentIndex, quizQuestions.length]);

  const formatTime = (seconds) => {
    const safeSeconds = Math.max(0, Number(seconds || 0));
    const mins = Math.floor(safeSeconds / 60);
    const secs = Math.floor(safeSeconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const submitQuiz = async (reason = "submitted") => {
    if (submittedRef.current || !course) return;

    if (!isVideoQuiz && existingFinalResult?.passed) {
      submittedRef.current = true;
      setSubmitted(true);
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      navigate("/");
      return;
    }

    submittedRef.current = true;
    setSubmitted(true);

    let correct = 0;
    quizQuestions.forEach((question) => {
      if (isAnswerCorrect(question, answers[question.id])) {
        correct += 1;
      }
    });

    const total = quizQuestions.length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 100;
    const nowIso = new Date().toISOString();

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }

    try {
      if (isVideoQuiz) {
        const targetVideoId = video?.id || activeVideoId;
        const quizId = `practice_${targetVideoId}_${Date.now()}`;
        const passed = total === 0 || correct >= Math.ceil(total * 0.7);

        await set(ref(database, quizAttemptPath(user.uid, course.id, quizId)), {
          quizId,
          quizType: "practice",
          userId: user.uid,
          userName: user.displayName || "",
          courseId: course.id,
          courseTitle: course.title || course.courseTitle || "",
          videoId: targetVideoId,
          mappingId: video?.mappingId || null,
          videoTitle: video?.title || video?.videoTitle || "",
          score: correct,
          totalMarks: total,
          correct,
          percentage,
          passed,
          reason,
          warningCount: warningCountRef.current,
          answers,
          attemptedAt: nowIso,
        });

        navigate(videoUrl(course.id, targetVideoId));
        return;
      }

      const passingScore = Number(course.passingScore || 70);
      const passed = total === 0 || percentage >= passingScore;
      const legacyAttemptId = `${user.uid}_${course.id}_${Date.now()}`;
      const quizId = `final_${course.id}_${Date.now()}`;

      const normalizedAttempt = {
        quizId,
        quizType: "final",
        userId: user.uid,
        userName: user.displayName || "",
        courseId: course.id,
        courseTitle: course.title || course.courseTitle || "",
        score: percentage,
        totalMarks: total,
        correct,
        percentage,
        passed,
        attemptCount: 1,
        legacyAttemptId,
        reason,
        warningCount: warningCountRef.current,
        answers,
        attemptedAt: nowIso,
      };

      await set(
        ref(database, quizAttemptPath(user.uid, course.id, quizId)),
        normalizedAttempt
      );

      // Kept temporarily because the existing Result page may still read this path.
      await set(ref(database, legacyAttemptPath(user.uid, legacyAttemptId)), {
        userId: user.uid,
        userName: user.displayName || "",
        courseId: course.id,
        courseTitle: course.title || course.courseTitle || "",
        score: percentage,
        percentage,
        total,
        totalMarks: total,
        correct,
        passed,
        quizId,
        reason,
        warningCount: warningCountRef.current,
        submittedAt: nowIso,
      });

      if (passed) {
        // Update only test/completion fields. Do not erase video counts already stored.
        await update(
          ref(database, courseProgressForCoursePath(user.uid, course.id)),
          {
            courseId: course.id,
            progressPercentage: 100,
            completed: true,
            completedAt: nowIso,
            lastAccessedAt: nowIso,
            courseTestCompleted: true,
            courseTestPassed: true,
            score: percentage,
            percentage,
            correct,
            totalMarks: total,
            finalQuizAttemptId: quizId,
            legacyAttemptId,
          }
        );

        // Temporary migration write for older certificate/result screens.
        await set(
          ref(database, legacyCompletedCoursePath(user.uid, course.id)),
          {
            courseId: course.id,
            courseTitle: course.title || course.courseTitle || "",
            passed: true,
            score: percentage,
            percentage,
            correct,
            total,
            totalMarks: total,
            attemptId: legacyAttemptId,
            quizId,
            completedAt: nowIso,
          }
        );
      }

      navigate(`${basePath}/result/${legacyAttemptId}`);
    } catch (error) {
      submittedRef.current = false;
      setSubmitted(false);
      console.error("Failed to submit quiz:", error);
      alert("Failed to submit quiz. Please try again.");
    }
  };

  const handleSecurityViolation = async (message) => {
    if (submittedRef.current) return;

    setSecurityMessage(message);
    const nextWarning = warningCountRef.current + 1;
    warningCountRef.current = nextWarning;
    setWarningCount(nextWarning);

    if (nextWarning >= 2) {
      await submitQuiz("security_violation");
    }
  };

  useEffect(() => {
    const blockEvent = (event) => {
      if (!quizStarted || submittedRef.current) return;
      event.preventDefault();
      setSecurityMessage("Copying or right-click is not allowed during quiz.");
    };

    const blockKeys = (event) => {
      if (!quizStarted || submittedRef.current) return;

      const key = String(event.key || "").toLowerCase();
      const blocked =
        event.key === "F12" ||
        (event.ctrlKey && ["c", "v", "x", "a", "s", "p", "u"].includes(key)) ||
        (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key));

      if (blocked) {
        event.preventDefault();
        setSecurityMessage("Keyboard shortcuts are disabled during quiz.");
      }
    };

    const handleVisibility = () => {
      if (quizStarted && !submittedRef.current && document.hidden) {
        handleSecurityViolation("Tab switching detected.");
      }
    };

    const handleFullscreenChange = () => {
      if (
        quizStarted &&
        !submittedRef.current &&
        !document.fullscreenElement
      ) {
        handleSecurityViolation("Fullscreen exited.");
      }
    };

    document.addEventListener("copy", blockEvent);
    document.addEventListener("cut", blockEvent);
    document.addEventListener("paste", blockEvent);
    document.addEventListener("contextmenu", blockEvent);
    document.addEventListener("keydown", blockKeys);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("copy", blockEvent);
      document.removeEventListener("cut", blockEvent);
      document.removeEventListener("paste", blockEvent);
      document.removeEventListener("contextmenu", blockEvent);
      document.removeEventListener("keydown", blockKeys);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [quizStarted]);

  const startStrictQuiz = async () => {
    if (!isVideoQuiz && existingFinalResult?.passed) return;

    const examElement = examRootRef.current;

    if (!examElement) {
      setSecurityMessage(
        "Unable to start secure test. Please refresh the page and try again."
      );
      return;
    }

    try {
      if (!document.fullscreenElement) {
        await examElement.requestFullscreen();
      }

      setSecurityMessage("");
      setQuizStarted(true);
    } catch (error) {
      console.error("Fullscreen failed:", error);
      setQuizStarted(false);
      setSecurityMessage(
        "Fullscreen permission was blocked. Allow fullscreen in the browser and click Start again."
      );
    }
  };

  useEffect(() => {
    if (loading || !course) return;

    document.body.classList.add("final-quiz-active");

    return () => {
      document.body.classList.remove("final-quiz-active");

      if (document.fullscreenElement === examRootRef.current) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [loading, course]);

  useEffect(() => {
    if (loading || submitted || !course || !quizStarted) return;

    if (timeLeft <= 0) {
      submitQuiz("time_over");
      return;
    }

    const timer = window.setTimeout(() => {
      setTimeLeft((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [timeLeft, submitted, loading, course, quizStarted]);

  if (loading) {
    return <h2 className="quiz-status-msg">Loading Quiz...</h2>;
  }

  if (!course) {
    return <h1 className="quiz-status-msg error">Course not found</h1>;
  }

  if (!isVideoQuiz && existingFinalResult?.passed) {
    return (
      <div className="quiz-clean-page">
        <div className="quiz-empty-card">
          <h1>{course.title || course.courseTitle}</h1>
          <p>You have already passed this final course test.</p>

          <div className="quiz-final-result-summary">
            <strong>{existingFinalResult.percentage}%</strong>
            <span>
              {existingFinalResult.total > 0
                ? `${existingFinalResult.correct} / ${existingFinalResult.total} Correct Answers`
                : "Final Test Passed"}
            </span>
          </div>

          <p className="quiz-final-lock-message">
            This test cannot be attempted again.
          </p>

          <div className="quiz-result-actions">
            <button onClick={() => navigate(courseUrl(course.id))}>
              Back to Course
            </button>

            {existingFinalResult.attemptId && (
              <button
                className="quiz-cert-btn"
                onClick={() =>
                  navigate(
                    `${basePath}/certificate/${existingFinalResult.attemptId}`
                  )
                }
              >
                View Certificate
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (quizQuestions.length === 0 && !isVideoQuiz) {
    return (
      <div className="quiz-clean-page">
        <div className="quiz-empty-card">
          <h1>{course.title || course.courseTitle}</h1>
          <p>
            No final quiz is added. You can directly generate your certificate.
          </p>
          <button onClick={() => submitQuiz("no_quiz_auto_pass")}>
            Generate Certificate
          </button>
        </div>
      </div>
    );
  }

  if (quizQuestions.length === 0 && isVideoQuiz) {
    return (
      <div className="quiz-clean-page">
        <div className="quiz-empty-card">
          <h1>{video?.title || video?.videoTitle || "Revision Quiz"}</h1>
          <p>No revision quiz questions added for this video.</p>
          <button
            onClick={() =>
              navigate(videoUrl(course.id, video?.id || activeVideoId))
            }
          >
            Back to Video
          </button>
        </div>
      </div>
    );
  }

  return createPortal(
    <div
      ref={examRootRef}
      className={`final-quiz-overlay ${
        quizStarted ? "quiz-secure-mode" : "strict-start-page"
      }`}
    >
      {!quizStarted ? (
        <div className="strict-start-card">
          <div className="strict-warning-label">
            {isVideoQuiz ? "SECURE REVISION QUIZ" : "SECURE FINAL TEST"}
          </div>

          <h1>
            {isVideoQuiz
              ? "Start Revision Quiz"
              : "Start Final Course Test"}
          </h1>

          <p>
            The test will open in fullscreen mode. Do not switch tabs,
            exit fullscreen, copy content, or use restricted keyboard
            shortcuts during the examination.
          </p>

          <div className="quiz-danger-banner">
            <div className="quiz-danger-icon">⚠</div>

            <div className="quiz-danger-content">
              <h3>Important warning</h3>
              <p>
                After <strong>2 violations</strong>, the test will be
                submitted automatically and cannot be resumed.
              </p>
            </div>
          </div>

          <div className="strict-rules">
            <span>Fullscreen required</span>
            <span>Tab switching monitored</span>
            <span>Copy and paste blocked</span>
            <span>
              <strong>2 warnings</strong>&nbsp;= auto-submit
            </span>
          </div>

          {securityMessage && (
            <div className="strict-start-error">{securityMessage}</div>
          )}

          <button type="button" onClick={startStrictQuiz}>
            Enter Fullscreen &amp; Start
          </button>
        </div>
      ) : (
        <>
          {securityMessage && (
            <div className="quiz-warning-banner">
              {securityMessage} Warning {warningCount}/2
            </div>
          )}

          <div className="quiz-clean-card">
            <div className="quiz-clean-header">
              <div>
                <span className="quiz-type-pill">
                  {isVideoQuiz ? "Revision Quiz" : "Final Course Test"}
                </span>

                <h1>
                  {isVideoQuiz
                    ? video?.title ||
                      video?.videoTitle ||
                      "Revision Quiz"
                    : course.title || course.courseTitle}
                </h1>

                <p>
                  Question {currentIndex + 1} of {quizQuestions.length}
                </p>
              </div>

              <div className="quiz-timer-clean">
                <span>{formatTime(timeLeft)}</span>
                <small>Total Marks: {quizQuestions.length}</small>
              </div>
            </div>

            <div className="quiz-progress-line">
              <span style={{ width: `${progressPercent}%` }} />
            </div>

            <div className="quiz-question-area">
              <h2>{getQuestionText(currentQuestion)}</h2>

              <div className="quiz-options-clean">
                {getQuestionOptions(currentQuestion).map((option, index) => {
                  const isSelected =
                    String(answers[currentQuestion.id]) === String(option);
                  const label = String.fromCharCode(65 + index);

                  return (
                    <label
                      key={`${currentQuestion.id}-${index}`}
                      className={`quiz-option-clean ${
                        isSelected ? "selected" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value={option}
                        checked={isSelected}
                        onChange={() =>
                          setAnswers((previous) => ({
                            ...previous,
                            [currentQuestion.id]: option,
                          }))
                        }
                      />

                      <span className="option-letter">{label}.</span>
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="quiz-bottom-actions">
              <button
                type="button"
                className="quiz-prev-btn"
                disabled={currentIndex === 0}
                onClick={() =>
                  setCurrentIndex((previous) => previous - 1)
                }
              >
                Previous
              </button>

              {currentIndex === quizQuestions.length - 1 ? (
                <button
                  type="button"
                  className="quiz-next-btn"
                  disabled={submitted}
                  onClick={() => submitQuiz()}
                >
                  {submitted ? "Submitting..." : "Submit"}
                </button>
              ) : (
                <button
                  type="button"
                  className="quiz-next-btn"
                  onClick={() =>
                    setCurrentIndex((previous) => previous + 1)
                  }
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>,
    document.body
  );

}

export default QuizPage;
