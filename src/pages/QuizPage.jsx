import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { auth, database } from "../firebase";
import { ref, get, set } from "firebase/database";
import "../styles/quizpage.css";

function QuizPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

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

  useEffect(() => {
    fetchQuizData();
  }, [id, isVideoQuiz, resultMode, courseIdFromQuery, videoIdFromQuery]);

  useEffect(() => {
    const blockEvent = (e) => {
      if (!quizStarted || submitted) return;
      e.preventDefault();
      setSecurityMessage("Copying or right-click is not allowed during quiz.");
    };

    const blockKeys = (e) => {
      if (!quizStarted || submitted) return;

      const blocked =
        e.key === "F12" ||
        (e.ctrlKey && ["c", "v", "x", "a", "s", "p", "u"].includes(e.key.toLowerCase())) ||
        (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(e.key.toLowerCase()));

      if (blocked) {
        e.preventDefault();
        setSecurityMessage("Keyboard shortcuts are disabled during quiz.");
      }
    };

    const handleVisibility = () => {
      if (!quizStarted || submitted) return;

      if (document.hidden) {
        handleSecurityViolation("Tab switching detected.");
      }
    };

    const handleFullscreenChange = () => {
      if (!quizStarted || submitted) return;

      if (!document.fullscreenElement) {
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
  }, [quizStarted, submitted, warningCount]);

  const handleSecurityViolation = async (message) => {
    setSecurityMessage(message);
    const nextWarning = warningCount + 1;
    setWarningCount(nextWarning);

    if (nextWarning >= 2) {
      await submitQuiz("security_violation");
    }
  };

  const startStrictQuiz = async () => {
    if (!isVideoQuiz && existingFinalResult?.passed) return;

    try {
      await document.documentElement.requestFullscreen();
    } catch (error) {
      console.warn("Fullscreen failed", error);
    }

    setQuizStarted(true);
  };

  const fetchQuizData = async () => {
    const user = auth.currentUser;

    if (!user) {
      navigate("/");
      return;
    }

    const activeCourseId = isVideoQuiz ? courseIdFromQuery : id;
    const activeVideoId = isVideoQuiz ? videoIdFromQuery || id : null;

    if (!activeCourseId) {
      alert("Course not found");
      navigate("/assigned-courses");
      return;
    }

const [
  courseSnapshot,
  videosSnapshot,
  videoLibrarySnapshot,
  courseVideosSnapshot,
  questionsSnapshot,
  videoQuestionsSnapshot,
  completedCourseSnapshot,
  courseProgressSnapshot,
  attemptsSnapshot,
  resultsSnapshot,
  newQuizAttemptsSnapshot,
] = await Promise.all([
      get(ref(database, `courses/${activeCourseId}`)),
      get(ref(database, "videos")),
      get(ref(database, "videoLibrary")),
      get(ref(database, "courseVideos")),
      get(ref(database, "questions")),
      get(ref(database, "videoQuizzes")),
      get(ref(database, `completedCourses/${user.uid}/${activeCourseId}`)),
      get(ref(database, `courseProgress/${user.uid}/${activeCourseId}`)),
      get(ref(database, `attempts/${user.uid}`)),
      get(ref(database, `results/${user.uid}`)),
      get(ref(database, `quizAttempts/${user.uid}/${activeCourseId}`)),
    ]);

    if (!courseSnapshot.exists()) {
      alert("Course not found");
      navigate("/assigned-courses");
      return;
    }

    const courseData = { id: activeCourseId, ...courseSnapshot.val() };
    setCourse(courseData);

    if (!isVideoQuiz) {
      const completedRecord = completedCourseSnapshot.exists()
        ? completedCourseSnapshot.val()
        : null;

      const courseProgressRecord = courseProgressSnapshot.exists()
        ? courseProgressSnapshot.val()
        : null;

      const attemptsData = attemptsSnapshot.exists()
        ? attemptsSnapshot.val()
        : {};

      const resultsData = resultsSnapshot.exists()
        ? resultsSnapshot.val()
        : {};

      const newQuizAttemptsData = newQuizAttemptsSnapshot.exists()
        ? newQuizAttemptsSnapshot.val()
        : {};

      const finalRecords = [
        ...Object.entries(attemptsData || {}).map(([attemptId, item]) => ({
          id: attemptId,
          source: "attempts",
          ...(item || {}),
        })),
        ...Object.entries(resultsData || {}).map(([resultId, item]) => ({
          id: resultId,
          source: "results",
          ...(item || {}),
        })),
      ].filter(
        (item) =>
          item.courseId === activeCourseId &&
          !item.videoId
      );

      // Also include records from new quizAttempts path
      const newCourseAttempts = newQuizAttemptsData[activeCourseId] || {};
      Object.entries(newCourseAttempts).forEach(([quizId, attempt]) => {
        if (attempt && attempt.quizType === "final") {
          finalRecords.push({
            id: quizId,
            source: "quizAttempts",
            ...attempt,
          });
        }
      });

      const latestPassed = finalRecords
        .filter(
          (item) =>
            item.passed === true ||
            item.isPassed === true ||
            String(item.status || "").toLowerCase() === "passed"
        )
        .sort(
          (a, b) =>
            new Date(
              b.submittedAt || b.attemptedAt || b.completedAt || b.createdAt || 0
            ) -
            new Date(
              a.submittedAt || a.attemptedAt || a.completedAt || a.createdAt || 0
            )
        )[0];

      const courseAlreadyPassed =
        completedRecord?.passed === true ||
        courseProgressRecord?.courseTestPassed === true ||
        Boolean(latestPassed);

      if (courseAlreadyPassed) {
        const source = latestPassed || courseProgressRecord || completedRecord || {};

        const correct = Number(
          source.correct ??
          completedRecord?.correct ??
          0
        );

        const total = Number(
          source.total ??
          source.totalMarks ??
          source.totalQuestions ??
          completedRecord?.total ??
          completedRecord?.totalQuestions ??
          0
        );

        const storedScore = Number(
          source.score ??
          source.percentage ??
          completedRecord?.score ??
          completedRecord?.percentage ??
          0
        );

        const percentage =
          Number.isFinite(storedScore) && storedScore >= 0
            ? Math.max(0, Math.min(100, Math.round(storedScore)))
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
            source.completedAt ||
            source.createdAt ||
            completedRecord?.completedAt ||
            "",
          attemptId:
            source.id ||
            source.attemptId ||
            completedRecord?.attemptId ||
            "",
        });
      } else {
        setExistingFinalResult(null);
      }
    }

    const oldVideos = videosSnapshot.exists()
      ? Object.entries(videosSnapshot.val()).map(([videoId, item]) => ({
          id: videoId,
          ...item,
        }))
      : [];

    const libraryVideos = videoLibrarySnapshot.exists()
      ? Object.entries(videoLibrarySnapshot.val()).map(([videoId, item]) => ({
          id: videoId,
          ...item,
        }))
      : [];

    const courseVideosData = courseVideosSnapshot.exists()
      ? courseVideosSnapshot.val()
      : {};

    let courseVideos = [];

    if (courseVideosData?.[activeCourseId]) {
      courseVideos = Object.entries(courseVideosData[activeCourseId]).map(
        ([mappingId, mappedVideo]) => {
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
        .map((videoId) => libraryVideos.find((item) => item.id === videoId))
        .filter(Boolean)
        .map((item) => ({ ...item, courseId: activeCourseId }));
    } else {
      courseVideos = oldVideos.filter((item) => item.courseId === activeCourseId);
    }

    const questionsData = questionsSnapshot.exists() ? questionsSnapshot.val() : {};
    const videoQuestionsData = videoQuestionsSnapshot.exists()
  ? videoQuestionsSnapshot.val()
  : {};

    let allQuestions = [];

    if (isVideoQuiz) {
      const currentVideo =
        courseVideos.find((item) => item.id === activeVideoId) ||
        oldVideos.find((item) => item.id === activeVideoId) ||
        libraryVideos.find((item) => item.id === activeVideoId);

      setVideo(currentVideo || null);

 const videoQuestionSource =
  videoQuestionsData?.[activeVideoId] ||
  videoQuestionsData?.[currentVideo?.mappingId] ||
  {};
  
      allQuestions = Object.entries(videoQuestionSource).map(
        ([questionId, question]) => ({
          id: `${activeVideoId}_${questionId}`,
          videoId: activeVideoId,
          ...question,
        })
      );

      setTimeLeft(Number(currentVideo?.testDuration || currentVideo?.quizDuration || 60));
   } else {

  const courseQuestionSource = questionsData?.[activeCourseId] || {};

  allQuestions = Object.entries(courseQuestionSource).map(
    ([questionId, question]) => ({
      id: questionId,
      courseId: activeCourseId,
      ...question,
    })
  );

  setTimeLeft(
    Number(courseData.testDuration || courseData.quizDuration || 60)
  );
}
    setQuizQuestions(allQuestions);

    if (!isVideoQuiz && !resultMode && courseVideos.length > 0) {
      const videoProgressSnap = await get(ref(database, `videoProgress/${user.uid}`));
      const legacyProgSnap = await get(ref(database, `progress/${user.uid}`));
      const videoProgressData = videoProgressSnap.exists() ? videoProgressSnap.val() : {};
      const legacyProgData = legacyProgSnap.exists() ? legacyProgSnap.val() : {};

      const mergedProg = { ...legacyProgData };
      Object.values(videoProgressData).forEach((cv) => {
        if (cv && typeof cv === "object") {
          Object.entries(cv).forEach(([vId, p]) => { if (!mergedProg[vId]) mergedProg[vId] = p; });
        }
      });

      const allVideosDone = courseVideos.every((v) => {
        const p = mergedProg[v.id];
        return p?.completed || Number(p?.watchedPercent || 0) >= 100;
      });

      if (!allVideosDone) {
        alert("Please complete all course videos before taking the final test.");
        navigate(`../course/${activeCourseId}`);
        return;
      }

      const videoQuizzesSnap = await get(ref(database, "videoQuizzes"));
      const vqData = videoQuizzesSnap.exists() ? videoQuizzesSnap.val() : {};
      const hasAnyRevisionQuiz = courseVideos.some((v) => {
        const src = vqData?.[v.id] || vqData?.[v.mappingId] || {};
        return Object.keys(src).some((qId) => src[qId]?.question || src[qId]?.questionText);
      });

      if (hasAnyRevisionQuiz) {
        const quizAttemptsSnap = await get(ref(database, `quizAttempts/${user.uid}/${activeCourseId}`));
        const qaData = quizAttemptsSnap.exists() ? quizAttemptsSnap.val() : {};
        const allAttempts = Object.values(qaData).filter((a) => a?.quizType === "practice");

        if (allAttempts.length === 0) {
          alert("Please complete the revision quiz before taking the final test.");
          navigate(`../course/${activeCourseId}`);
          return;
        }

        const anyAttemptPassed = allAttempts.some((a) => {
          const score = Number(a.score || 0);
          const total = Number(a.totalMarks || 1);
          return score >= Math.ceil(total * 0.7);
        });

        if (!anyAttemptPassed) {
          alert("You need to pass the revision quiz before taking the final test.");
          navigate(`../course/${activeCourseId}`);
          return;
        }
      }
    }

    setLoading(false);
  };

  const currentQuestion = quizQuestions[currentIndex];

  const progressPercent = useMemo(() => {
    if (quizQuestions.length === 0) return 0;
    return Math.round(((currentIndex + 1) / quizQuestions.length) * 100);
  }, [currentIndex, quizQuestions.length]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const submitQuiz = async (reason = "submitted") => {
    if (submitted || !course) return;

    if (!isVideoQuiz && existingFinalResult?.passed) {
      setSubmitted(true);
      return;
    }

    setSubmitted(true);

    let correct = 0;

    quizQuestions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) correct += 1;
    });

    const total = quizQuestions.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 100;
    const user = auth.currentUser;

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }

    if (isVideoQuiz) {
      // Write to new normalized path: quizAttempts/{uid}/{courseId}/{quizId}
      const videoQuizId = `practice_${video?.id || videoIdFromQuery || id}_${Date.now()}`;
      await set(ref(database, `quizAttempts/${user.uid}/${course.id}/${videoQuizId}`), {
        quizId: videoQuizId,
        quizType: "practice",
        userId: user.uid,
        courseId: course.id,
        courseTitle: course.title || course.courseTitle || "",
        videoId: video?.id || videoIdFromQuery || id,
        videoTitle: video?.title || video?.videoTitle || "",
        score,
        totalMarks: total,
        correct,
        percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
        passed: total > 0 && correct >= Math.ceil(total * 0.7),
        reason,
        warningCount,
        answers,
        attemptedAt: new Date().toISOString(),
      });

      navigate(`/video/${video?.id || videoIdFromQuery || id}`);
      return;
    }

    const passingScore = course.passingScore || 70;
    const passed = total === 0 ? true : score >= passingScore;
    const attemptId = `${user.uid}_${course.id}_${Date.now()}`;

    // Write to new normalized path: quizAttempts/{uid}/{courseId}/{quizId}
    const quizId = `final_${course.id}_${Date.now()}`;
    await set(ref(database, `quizAttempts/${user.uid}/${course.id}/${quizId}`), {
      quizId,
      quizType: "final",
      userId: user.uid,
      userName: user.displayName || "",
      courseId: course.id,
      courseTitle: course.title || course.courseTitle || "",
      score,
      totalMarks: total,
      correct,
      percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
      passed,
      attemptCount: 1,
      reason,
      warningCount,
      answers,
      attemptedAt: new Date().toISOString(),
    });

    // Also write to legacy attempts path for backward compatibility
    await set(ref(database, `attempts/${user.uid}/${attemptId}`), {
      userId: user.uid,
      userName: user.displayName || "",
      courseId: course.id,
      courseTitle: course.title || course.courseTitle || "",
      score,
      total,
      correct,
      passed,
      reason,
      warningCount,
      submittedAt: new Date().toISOString(),
    });

    if (passed) {
      // Write completion to new courseProgress path
      await set(ref(database, `courseProgress/${user.uid}/${course.id}`), {
        courseId: course.id,
        progressPercentage: 100,
        completedVideos: 0,
        totalVideos: 0,
        lastAccessedAt: new Date().toISOString(),
        completed: true,
        completedAt: new Date().toISOString(),
        courseTestCompleted: true,
        courseTestPassed: true,
        score,
        totalMarks: total,
      });

      // Also write to legacy completedCourses for backward compatibility
      await set(ref(database, `completedCourses/${user.uid}/${course.id}`), {
        courseId: course.id,
        courseTitle: course.title || course.courseTitle || "",
        passed: true,
        score,
        correct,
        total,
        attemptId,
        completedAt: new Date().toISOString(),
      });
    }

    navigate(`/result/${attemptId}`);
  };

  useEffect(() => {
    if (loading || submitted || !course || !quizStarted) return;

    if (timeLeft <= 0) {
      submitQuiz("time_over");
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, submitted, loading, course, quizStarted]);

  if (loading) return <h2 className="quiz-status-msg">Loading Quiz...</h2>;

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
            <button onClick={() => navigate(`/course/${course.id}`)}>
              Back to Course
            </button>
            {existingFinalResult?.attemptId && (
              <button
                className="quiz-cert-btn"
                onClick={() => navigate(`/certificate/${existingFinalResult.attemptId}`)}
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
          <p>No final quiz is added. You can directly generate your certificate.</p>
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
          <button onClick={() => navigate(`/video/${video?.id || videoIdFromQuery || id}`)}>
            Back to Video
          </button>
        </div>
      </div>
    );
  }

  if (!quizStarted) {
    return (
      <div className="quiz-clean-page strict-start-page">
        <div className="strict-start-card">
          <h1>{isVideoQuiz ? "Start Revision Quiz" : "Start Final Course Test"}</h1>
          <p>This quiz will run in fullscreen mode. Copying, right-click, shortcuts, and tab switching are not allowed.</p>

          <div className="strict-rules">
            <span>Fullscreen required</span>
            <span>No tab switching</span>
            <span>No copy / paste</span>
            <span>Auto-submit on violation</span>
          </div>

          <button onClick={startStrictQuiz}>Enter Fullscreen & Start</button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-clean-page quiz-secure-mode">
      {securityMessage && (
        <div className="quiz-warning-banner">
          {securityMessage} Warning {warningCount}/2
        </div>
      )}

      <div className="quiz-clean-card">
        <div className="quiz-clean-header">
          <div>
            <span className="quiz-type-pill">
              {isVideoQuiz ? "Revision Quiz" : "Course Quiz"}
            </span>

            <h1>
              {isVideoQuiz
                ? video?.title || video?.videoTitle || "Revision Quiz"
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
          <span style={{ width: `${progressPercent}%` }}></span>
        </div>

        <div className="quiz-question-area">
          <h2>{currentQuestion.question}</h2>

          <div className="quiz-options-clean">
            {(currentQuestion.options || []).map((option, index) => {
              const isSelected = answers[currentQuestion.id] === option;
              const label = String.fromCharCode(65 + index);

              return (
                <label
                  key={option}
                  className={`quiz-option-clean ${isSelected ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value={option}
                    checked={isSelected}
                    onChange={() =>
                      setAnswers({
                        ...answers,
                        [currentQuestion.id]: option,
                      })
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
            onClick={() => setCurrentIndex((prev) => prev - 1)}
          >
            Previous
          </button>

          {currentIndex === quizQuestions.length - 1 ? (
            <button type="button" className="quiz-next-btn" onClick={() => submitQuiz()}>
              Submit
            </button>
          ) : (
            <button
              type="button"
              className="quiz-next-btn"
              onClick={() => setCurrentIndex((prev) => prev + 1)}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuizPage;