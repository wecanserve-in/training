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

  useEffect(() => {
    fetchQuizData();
  }, [id]);

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
] = await Promise.all([
      get(ref(database, `courses/${activeCourseId}`)),
      get(ref(database, "videos")),
      get(ref(database, "videoLibrary")),
      get(ref(database, "courseVideos")),
      get(ref(database, "questions")),
      get(ref(database, "videoQuizzes")),
    ]);

    if (!courseSnapshot.exists()) {
      alert("Course not found");
      navigate("/assigned-courses");
      return;
    }

    const courseData = { id: activeCourseId, ...courseSnapshot.val() };
    setCourse(courseData);

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
      const videoQuizAttemptId = `${user.uid}_${id}_videoQuiz_${Date.now()}`;

      await set(ref(database, `videoQuizAttempts/${videoQuizAttemptId}`), {
        userId: user.uid,
        courseId: course.id,
        courseTitle: course.title || course.courseTitle || "",
        videoId: video?.id || videoIdFromQuery || id,
        videoTitle: video?.title || video?.videoTitle || "",
        score,
        total,
        correct,
        reason,
        warningCount,
        submittedAt: new Date().toISOString(),
      });

      navigate(`/video/${video?.id || videoIdFromQuery || id}`);
      return;
    }

    const passingScore = course.passingScore || 70;
    const passed = total === 0 ? true : score >= passingScore;
    const attemptId = `${user.uid}_${course.id}_${Date.now()}`;

    await set(ref(database, `attempts/${attemptId}`), {
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

    await set(ref(database, `completedCourses/${user.uid}/${course.id}`), {
      courseId: course.id,
      courseTitle: course.title || course.courseTitle || "",
      passed,
      score,
      attemptId,
      completedAt: new Date().toISOString(),
    });

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

  if (!course) return <h1 className="quiz-status-msg error">Course not found</h1>;

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