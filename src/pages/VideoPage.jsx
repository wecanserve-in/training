import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, get, update } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { auth, database } from "../firebase";
import "../styles/videopage.css";

function VideoPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const watchedSecondsRef = useRef(new Set());
  const lastSavedRef = useRef(0);
  const resumeTimeRef = useRef(0);
  const hasResumedRef = useRef(false);
  const lastVideoSecondRef = useRef(0);

  const [video, setVideo] = useState(null);
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [watchPercent, setWatchPercent] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showCourseCompleteModal, setShowCourseCompleteModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showQuizPopup, setShowQuizPopup] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizPreviouslyCompleted, setQuizPreviouslyCompleted] = useState(false);
  const [previousScore, setPreviousScore] = useState({ correct: 0, total: 0 });
  const [viewingScore, setViewingScore] = useState(false);

  useEffect(() => {
    watchedSecondsRef.current = new Set();
    lastSavedRef.current = 0;
    resumeTimeRef.current = 0;
    hasResumedRef.current = false;
    lastVideoSecondRef.current = 0;

    setVideo(null);
    setCourse(null);
    setLessons([]);
    setProgressMap({});
    setWatchPercent(0);
    setVideoDuration(0);
    setPlaybackSpeed(1);
    setShowCourseCompleteModal(false);
    setShowQuizPopup(false);
    setQuizQuestions([]);
    setLoading(true);

    const fetchData = async (user) => {
      try {
        const [oldVideosSnap, videoLibrarySnap, courseVideosSnap, progressSnap, videoQuizzesSnap, quizAttemptsSnap] =
          await Promise.all([
            get(ref(database, "videos")),
            get(ref(database, "videoLibrary")),
            get(ref(database, "courseVideos")),
            get(ref(database, `progress/${user.uid}`)),
            get(ref(database, "videoQuizzes")),
            get(ref(database, `videoQuizAttempts/${user.uid}`)),
          ]);

        const oldVideos = oldVideosSnap.exists()
          ? Object.entries(oldVideosSnap.val()).map(([videoId, item]) => ({
              id: videoId,
              ...item,
            }))
          : [];

        const libraryVideos = videoLibrarySnap.exists()
          ? Object.entries(videoLibrarySnap.val()).map(([videoId, item]) => ({
              id: videoId,
              ...item,
            }))
          : [];

        const courseVideosData = courseVideosSnap.exists()
          ? courseVideosSnap.val()
          : {};

        let foundVideo =
          oldVideos.find((item) => item.id === id) ||
          libraryVideos.find((item) => item.id === id);

        let resolvedCourseId = foundVideo?.courseId || null;

        if (!resolvedCourseId) {
          Object.entries(courseVideosData).some(([courseId, courseVideoList]) => {
            const matchedEntry = Object.entries(courseVideoList || {}).find(
              ([mappingId, item]) => mappingId === id || item.videoId === id
            );

            if (!matchedEntry) return false;

            const [mappingId, mappedVideo] = matchedEntry;
            const actualVideoId = mappedVideo.videoId || mappingId;

            const fullVideo =
              libraryVideos.find((item) => item.id === actualVideoId) ||
              oldVideos.find((item) => item.id === actualVideoId) ||
              {};

            foundVideo = {
              ...fullVideo,
              ...mappedVideo,
              id: actualVideoId,
              mappingId,
              courseId,
            };

            resolvedCourseId = courseId;
            return true;
          });
        }

        if (!foundVideo || !resolvedCourseId) {
          setVideo(null);
          setLoading(false);
          return;
        }

        const courseSnap = await get(ref(database, `courses/${resolvedCourseId}`));

        if (courseSnap.exists()) {
          setCourse({ id: resolvedCourseId, ...courseSnap.val() });
        }

        let courseLessons = [];

        if (courseVideosData?.[resolvedCourseId]) {
          courseLessons = Object.entries(courseVideosData[resolvedCourseId]).map(
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
                courseId: resolvedCourseId,
              };
            }
          );
        } else {
          courseLessons = oldVideos.filter(
            (item) => item.courseId === resolvedCourseId
          );
        }

        courseLessons = courseLessons.sort(
          (a, b) =>
            Number(a.order || 0) - Number(b.order || 0) ||
            new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        );

        const progressData = progressSnap.exists() ? progressSnap.val() : {};

        setVideo(foundVideo);
        setLessons(courseLessons);
        setProgressMap(progressData);

        const currentProgress = progressData?.[foundVideo.id];

        if (currentProgress?.watchedSeconds) {
          watchedSecondsRef.current = new Set(
            Object.keys(currentProgress.watchedSeconds).map(Number)
          );
        }

        setWatchPercent(
          currentProgress?.completed
            ? 100
            : Number(currentProgress?.watchedPercent || 0)
        );

        if (currentProgress?.lastPosition) {
          resumeTimeRef.current = Number(currentProgress.lastPosition || 0);
        }

        if (videoQuizzesSnap.exists()) {
          const vqData = videoQuizzesSnap.val();
          const videoQuestions = [];

          const quizSource = vqData[foundVideo.id] || vqData[foundVideo.mappingId] || {};

          Object.entries(quizSource).forEach(([questionId, question]) => {
            if (question && (question.question || question.questionText)) {
              videoQuestions.push({ id: questionId, ...question });
            }
          });

          setQuizQuestions(videoQuestions);

          if (quizAttemptsSnap.exists()) {
            const attempts = quizAttemptsSnap.val();
            let latestAttempt = null;

            Object.values(attempts).forEach((attempt) => {
              if (attempt.videoId === foundVideo.id) {
                if (!latestAttempt || new Date(attempt.submittedAt) > new Date(latestAttempt.submittedAt)) {
                  latestAttempt = attempt;
                }
              }
            });

            if (latestAttempt) {
              setQuizPreviouslyCompleted(true);
              setPreviousScore({
                correct: latestAttempt.correct || 0,
                total: latestAttempt.total || 0,
              });
            }
          }
        }

        setLoading(false);
      } catch (error) {
        console.error(error);
        alert("Failed to load video");
        setLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/");
      } else {
        fetchData(user);
      }
    });

    return () => unsubscribe();
  }, [id, navigate]);

  const saveProgress = async (percentValue, completed = false, currentTime = 0) => {
    const user = auth.currentUser;
    if (!user || !video) return;

    const watchedSecondsObject = {};
    watchedSecondsRef.current.forEach((second) => {
      watchedSecondsObject[second] = true;
    });

    const progressData = {
      videoId: video.id,
      courseId: video.courseId,
      videoTitle: video.title || video.videoTitle || "",
      completed,
      watchedPercent: completed ? 100 : percentValue,
      watchedSeconds: watchedSecondsObject,
      duration: videoDuration,
      lastPosition: completed ? 0 : Math.floor(currentTime),
      updatedAt: new Date().toISOString(),
      ...(completed && { completedAt: new Date().toISOString() }),
    };

    await update(ref(database), {
      [`progress/${user.uid}/${video.id}`]: progressData,
    });

    setProgressMap((prev) => ({
      ...prev,
      [video.id]: progressData,
    }));
  };

  const handleLoadedMetadata = (e) => {
    const duration = Math.floor(e.target.duration || 0);
    setVideoDuration(duration);
    e.target.playbackRate = playbackSpeed;

    if (!hasResumedRef.current && resumeTimeRef.current > 0 && duration > 0) {
      const safeResumeTime = Math.min(resumeTimeRef.current, duration - 2);
      if (safeResumeTime > 0) e.target.currentTime = safeResumeTime;
      lastVideoSecondRef.current = Math.floor(safeResumeTime);
      hasResumedRef.current = true;
    }
  };

  const handleVideoProgress = async (e) => {
    const currentSecond = Math.floor(e.target.currentTime || 0);
    const duration = Math.floor(e.target.duration || 0);
    if (!duration) return;

    const start = Math.min(lastVideoSecondRef.current, currentSecond);
    const end = Math.max(lastVideoSecondRef.current, currentSecond);

    for (let second = start; second <= end; second += 1) {
      watchedSecondsRef.current.add(second);
    }

    lastVideoSecondRef.current = currentSecond;

    const percent = Math.min(
      100,
      Math.floor((watchedSecondsRef.current.size / duration) * 100)
    );

    setWatchPercent(percent);

    const now = Date.now();
    if (now - lastSavedRef.current > 4000) {
      lastSavedRef.current = now;
      await saveProgress(percent, false, e.target.currentTime);
    }
  };

  const handleVideoPause = async (e) => {
    if (watchPercent < 100) {
      await saveProgress(watchPercent, false, e.target.currentTime);
    }
  };

  const currentIndex = lessons.findIndex((lesson) => lesson.id === video?.id);

  const isVideoCompleted =
    watchPercent >= 90 || progressMap?.[video?.id]?.completed;

  const completedLessonsCount = lessons.filter(
    (l) =>
      progressMap?.[l.id]?.completed ||
      (l.id === video?.id && isVideoCompleted)
  ).length;

  const courseOverallProgress =
    lessons.length > 0
      ? Math.floor((completedLessonsCount / lessons.length) * 100)
      : 0;

  const allCourseVideosCompleted =
    lessons.length > 0 &&
    lessons.every((lesson) =>
      lesson.id === video?.id
        ? isVideoCompleted
        : progressMap?.[lesson.id]?.completed
    );

  const markCurrentVideoComplete = async () => {
    setWatchPercent(100);
    await saveProgress(100, true, 0);
    setProgressMap((prev) => ({
      ...prev,
      [video.id]: {
        ...(prev?.[video.id] || {}),
        completed: true,
        watchedPercent: 100,
      },
    }));
  };

  const handleVideoEnd = async () => {
    await markCurrentVideoComplete();
    if (currentIndex === lessons.length - 1) {
      setShowCourseCompleteModal(true);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getThumbnail = (item) =>
    item.thumbnailUrl || item.thumbnail || item.imageUrl || "";

  const getQuizOptions = (q) => {
    if (Array.isArray(q.options) && q.options.length > 0) return q.options;
    if (q.optionA || q.option1) {
      return [q.optionA || q.option1, q.optionB || q.option2, q.optionC || q.option3, q.optionD || q.option4].filter(Boolean);
    }
    return [];
  };

  const isCorrectOption = (q, selectedIndex) => {
    const opts = getQuizOptions(q);
    return (
      q.correctOptionIndex === selectedIndex ||
      q.correctAnswer === opts[selectedIndex] ||
      q.correctOption === String.fromCharCode(65 + selectedIndex)
    );
  };

  const handleStartQuiz = () => {
    setShowQuizPopup(true);
    setViewingScore(false);
    setCurrentQuizIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setQuizScore(0);
    setQuizAnswers({});
    setQuizCompleted(false);
  };

  const handleViewScore = () => {
    setShowQuizPopup(true);
    setViewingScore(true);
    setQuizCompleted(true);
    setQuizScore(previousScore.correct);
  };

  const handleSelectAnswer = (optionIndex) => {
    if (showResult) return;
    setSelectedAnswer(optionIndex);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return;
    setShowResult(true);

    const q = quizQuestions[currentQuizIndex];
    const correct = isCorrectOption(q, selectedAnswer);
    if (correct) setQuizScore((prev) => prev + 1);

    setQuizAnswers((prev) => ({
      ...prev,
      [currentQuizIndex]: { selected: selectedAnswer, correct },
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuizIndex < quizQuestions.length - 1) {
      setCurrentQuizIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setQuizCompleted(true);
      setQuizPreviouslyCompleted(true);
      setPreviousScore({ correct: quizScore + (isCorrectOption(quizQuestions[currentQuizIndex], selectedAnswer) ? 1 : 0), total: quizQuestions.length });
    }
  };

  const handleCloseQuiz = () => {
    setShowQuizPopup(false);
    setViewingScore(false);
    setCurrentQuizIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setQuizScore(0);
    setQuizAnswers({});
    setQuizCompleted(false);
  };

  const videoTitle = video?.title || video?.videoTitle || "";
  const videoDescription =
    video?.description || video?.videoDescription || "";
  const videoUrl = video?.videoUrl || video?.url || video?.fileUrl || "";
  const hasRevisionQuiz = quizQuestions.length > 0;
  const courseId = video?.courseId;

  if (loading)
    return <h2 className="video-status-msg">Loading Video...</h2>;

  if (!video || !videoUrl) {
    return <h1 className="video-status-msg">Video Not Found</h1>;
  }

  return (
    <div className="video-page-clean">
      {showCourseCompleteModal && (
        <div className="course-complete-modal-backdrop">
          <div className="course-complete-modal">
            <div className="modal-success-icon">✓</div>
            <h2>Course videos completed</h2>
            <p>
              You have completed all videos in this course. You can now take
              the final course test.
            </p>
            <div className="modal-actions">
              <button
                className="modal-secondary-btn"
                onClick={() => navigate(`../course/${courseId}`)}
              >
                Back to Course
              </button>
              <button
                className="modal-primary-btn"
                onClick={() => navigate(`../quiz/${courseId}`)}
              >
                Start Final Test
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuizPopup && (
        <div className="quiz-modal-backdrop">
          <div className="quiz-modal">
            {/* HEADER */}
            <div className="quiz-modal-header">
              <div className="quiz-modal-header-left">
                <span className="quiz-modal-badge">Revision Quiz</span>
                <h3>{videoTitle}</h3>
              </div>
              <button
                className="quiz-modal-close"
                onClick={handleCloseQuiz}
              >
                ✕
              </button>
            </div>

            {/* PROGRESS */}
            {!quizCompleted && quizQuestions.length > 0 && (
              <div className="quiz-modal-progress">
                <div className="quiz-modal-progress-bar">
                  <span
                    style={{
                      width: `${((currentQuizIndex + 1) / quizQuestions.length) * 100}%`,
                    }}
                  ></span>
                </div>
                <span className="quiz-modal-progress-text">
                  Question {currentQuizIndex + 1} of {quizQuestions.length}
                </span>
              </div>
            )}

            {/* BODY */}
            <div className="quiz-modal-body">
              {quizQuestions.length === 0 ? (
                <div className="quiz-modal-empty">
                  <div className="quiz-modal-empty-icon">📝</div>
                  <h4>No Quiz Available</h4>
                  <p>No revision quiz questions have been added for this video yet.</p>
                  <button onClick={handleCloseQuiz}>Close</button>
                </div>
              ) : quizCompleted ? (
                /* ── SUMMARY VIEW ── */
                <div className="quiz-summary">
                  <div className="quiz-summary-icon">
                    {(viewingScore ? previousScore.correct : quizScore) === (viewingScore ? previousScore.total : quizQuestions.length)
                      ? "🎉"
                      : (viewingScore ? previousScore.correct : quizScore) >= (viewingScore ? previousScore.total : quizQuestions.length) * 0.5
                        ? "👍"
                        : "📖"}
                  </div>
                  <h2>
                    {(viewingScore ? previousScore.correct : quizScore) === (viewingScore ? previousScore.total : quizQuestions.length)
                      ? "Perfect Score!"
                      : (viewingScore ? previousScore.correct : quizScore) >= (viewingScore ? previousScore.total : quizQuestions.length) * 0.5
                        ? "Good Effort!"
                        : "Keep Practicing!"}
                  </h2>

                  <div className="quiz-summary-score">
                    <span className="score-big">{viewingScore ? previousScore.correct : quizScore}</span>
                    <span className="score-divider">/</span>
                    <span className="score-total">{viewingScore ? previousScore.total : quizQuestions.length}</span>
                  </div>
                  <p className="quiz-summary-label">Correct Answers</p>

                  <div className="quiz-summary-stats">
                    <div className="quiz-stat-item correct">
                      <span className="stat-num">
                        {viewingScore ? previousScore.correct : Object.values(quizAnswers).filter((a) => a.correct).length}
                      </span>
                      <span className="stat-label">Correct</span>
                    </div>
                    <div className="quiz-stat-item wrong">
                      <span className="stat-num">
                        {viewingScore ? previousScore.total - previousScore.correct : Object.values(quizAnswers).filter((a) => !a.correct).length}
                      </span>
                      <span className="stat-label">Wrong</span>
                    </div>
                    <div className="quiz-stat-item total">
                      <span className="stat-num">{viewingScore ? previousScore.total : quizQuestions.length}</span>
                      <span className="stat-label">Total</span>
                    </div>
                  </div>

                  <div className="quiz-summary-actions">
                    <button
                      className="quiz-summary-btn close"
                      onClick={handleCloseQuiz}
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                /* ── QUESTION VIEW ── */
                <div className="quiz-modal-question">
                  <h4>
                    <span className="q-number">Q{currentQuizIndex + 1}.</span>
                    {quizQuestions[currentQuizIndex]?.questionText ||
                      quizQuestions[currentQuizIndex]?.question}
                  </h4>
                  <div className="quiz-modal-options">
                    {getQuizOptions(quizQuestions[currentQuizIndex]).map((opt, i) => {
                      const q = quizQuestions[currentQuizIndex];
                      const correct = isCorrectOption(q, i);
                      let cls = "quiz-modal-option";
                      if (showResult && selectedAnswer === i && correct) cls += " correct";
                      else if (showResult && selectedAnswer === i && !correct) cls += " wrong";
                      else if (selectedAnswer === i) cls += " selected";

                      return (
                        <div key={i} className={cls} onClick={() => handleSelectAnswer(i)}>
                          <span className="opt-letter">{String.fromCharCode(65 + i)}</span>
                          <span className="opt-text">{opt}</span>
                          {showResult && selectedAnswer === i && (
                            <span className="opt-icon">{correct ? "✓" : "✕"}</span>
                          )}
                          {showResult && correct && selectedAnswer !== i && (
                            <span className="opt-icon correct-icon">✓</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER */}
            {!quizCompleted && quizQuestions.length > 0 && (
              <div className="quiz-modal-footer">
                <span className="quiz-modal-counter">
                  {currentQuizIndex + 1} / {quizQuestions.length}
                </span>
                {showResult ? (
                  <button className="quiz-modal-next" onClick={handleNextQuestion}>
                    {currentQuizIndex < quizQuestions.length - 1 ? "Next Question →" : "View Results"}
                  </button>
                ) : (
                  <button
                    className="quiz-modal-submit"
                    onClick={handleSubmitAnswer}
                    disabled={selectedAnswer === null}
                  >
                    Submit Answer
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HERO BANNER */}
      <div className="video-hero-banner">
        <div className="video-hero-left">
          <div className="video-hero-icon">▶</div>
          <div className="video-hero-info">
            <h1>{videoTitle}</h1>
            <p>{course?.title || course?.courseTitle}</p>
          </div>
        </div>
        <div className="video-hero-right">
          <div className="video-hero-badge">
            <span className="dot"></span>
            Lesson {currentIndex + 1} of {lessons.length}
          </div>
          <div className="video-hero-badge">
            {courseOverallProgress}% Done
          </div>
          {isVideoCompleted && (
            <div className="video-hero-badge active">✓ Completed</div>
          )}
        </div>
      </div>

      <button
        className="video-back-btn"
        onClick={() => navigate(`../course/${courseId}`)}
      >
        ← Back to Course
      </button>

      <div className="video-clean-layout">
        {/* LEFT */}
        <main className="video-main-area">
          <div className="video-player-card">
            <video
              key={video.id}
              ref={videoRef}
              controls
              controlsList="nodownload"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleVideoProgress}
              onPause={handleVideoPause}
              onEnded={handleVideoEnd}
              className="video-player-frame"
            >
              <source src={videoUrl} type="video/mp4" />
            </video>
          </div>

          <div className="video-title-card">
            <div className="video-title-row">
              <div className="video-title-left">
                <h1>{videoTitle}</h1>
                <p className="video-title-course">
                  {course?.title || course?.courseTitle}
                  <span>Video Lesson</span>
                </p>
                <div className="video-title-meta">
                  <div className="video-title-meta-item">
                    <span className="icon">🕐</span>
                    {formatTime(videoDuration)}
                  </div>
                  <div className="video-title-meta-item">
                    <span className="icon">📊</span>
                    {watchPercent}% watched
                  </div>
                  <div className="video-title-meta-item">
                    <span className="icon">📋</span>
                    Lesson {currentIndex + 1} of {lessons.length}
                  </div>
                </div>
              </div>
              <div className="video-title-right">
                <div className="video-duration-badge">
                  {formatTime(videoDuration)}
                </div>
                {isVideoCompleted && (
                  <div className="video-completed-badge">✓ Completed</div>
                )}
              </div>
            </div>
          </div>

          {videoDescription && (
            <div className="video-about-card">
              <h2>About this lesson</h2>
              <p>{videoDescription}</p>
            </div>
          )}
        </main>

        {/* RIGHT */}
        <aside className="video-side-area">
          <div className="course-content-card">
            <h2>
              Course Content
              <small>
                {currentIndex + 1} / {lessons.length}
              </small>
            </h2>

            <div className="course-video-list">
              {lessons.map((item, index) => {
                const completed = progressMap?.[item.id]?.completed;
                const active = item.id === video.id;
                const thumb = getThumbnail(item);

                return (
                  <button
                    key={item.id}
                    className={`video-list-item ${active ? "active" : ""} ${completed ? "completed" : ""}`}
                    onClick={() => navigate(`../video/${item.id}`)}
                  >
                    <div className="video-list-thumb">
                      {thumb ? (
                        <img src={thumb} alt="" />
                      ) : (
                        <span className="thumb-fallback">{index + 1}</span>
                      )}
                      <span className="thumb-duration">
                        {formatTime(
                          item.duration || item.durationSeconds || 0
                        )}
                      </span>
                    </div>

                    <div className="video-list-number">
                      {active ? "▶" : completed ? "✓" : index + 1}
                    </div>

                    <div className="video-list-content">
                      <strong>{item.title || item.videoTitle}</strong>
                      <span
                        className={
                          completed
                            ? "status-completed"
                            : active
                              ? "status-playing"
                              : ""
                        }
                      >
                        {completed
                          ? "Completed"
                          : active
                            ? "Playing Now"
                            : "Upcoming"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="course-progress-card">
            <div className="progress-header">
              <h3>Course Progress</h3>
              <strong>{courseOverallProgress}%</strong>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${courseOverallProgress}%` }}
              ></div>
            </div>
            <p className="progress-text">
              {completedLessonsCount} of {lessons.length} lessons
            </p>
          </div>

          {hasRevisionQuiz && (
            <div className="quiz-card">
              <h2>Revision Quiz</h2>
              {isVideoCompleted ? (
                <>
                  {quizPreviouslyCompleted ? (
                    <>
                      <p>
                        Score: {previousScore.correct}/{previousScore.total}
                      </p>
                      <button
                        className="quiz-btn active"
                        onClick={handleViewScore}
                      >
                        View Score
                      </button>
                    </>
                  ) : (
                    <>
                      <p>Test your understanding of this video.</p>
                      <button
                        className="quiz-btn active"
                        onClick={handleStartQuiz}
                      >
                        Start Revision Quiz
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <p>Complete this lesson to unlock.</p>
                  <button disabled className="quiz-btn disabled">
                    Locked
                  </button>
                </>
              )}
            </div>
          )}

          <div className="quiz-card">
            <h2>Course Final Test</h2>
            {allCourseVideosCompleted ? (
              <>
                <p>All lessons completed.</p>
                <button
                  className="quiz-btn active"
                  onClick={() => navigate(`../quiz/${courseId}`)}
                >
                  Start Final Test
                </button>
              </>
            ) : (
              <>
                <p>Finish all lessons first.</p>
                <button disabled className="quiz-btn disabled">
                  Locked
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default VideoPage;
