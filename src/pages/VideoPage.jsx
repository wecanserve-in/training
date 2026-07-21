import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ref, get, update, runTransaction } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { auth, database } from "../firebase";
import {
  videoProgressForCoursePath,
  videoProgressForVideoPath,
  courseProgressForCoursePath,
  learningActivityVideoPath,
} from "../services/dbPaths";
import "../styles/videopage.css";

function VideoPage() {
  const { courseId, videoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const portalBasePath = location.pathname.startsWith("/super-admin")
    ? "/super-admin"
    : location.pathname.startsWith("/department-admin")
      ? "/department-admin"
      : location.pathname.startsWith("/admin")
        ? "/admin"
        : "";

  const getCoursePath = () => `${portalBasePath}/course/${courseId}`;

  const getVideoPath = (targetVideoId) =>
    `${portalBasePath}/course/${courseId}/video/${targetVideoId}`;

  const getQuizPath = (mode = "") =>
    `${portalBasePath}/quiz/${courseId}${mode ? `?mode=${mode}` : ""}`;

  const videoRef = useRef(null);
  const watchedSecondsRef = useRef(new Set());
  const lastSavedRef = useRef(0);
  const resumeTimeRef = useRef(0);
  const hasResumedRef = useRef(false);
  const lastVideoSecondRef = useRef(0);
  const lastLoggedWatchedCountRef = useRef(0);
  const furthestAllowedTimeRef = useRef(0);
  const isSeekingRef = useRef(false);
  const seekStartTimeRef = useRef(0);

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
  const [finalCourseResult, setFinalCourseResult] = useState(null);

  useEffect(() => {
    watchedSecondsRef.current = new Set();
    lastSavedRef.current = 0;
    resumeTimeRef.current = 0;
    hasResumedRef.current = false;
    lastVideoSecondRef.current = 0;
    lastLoggedWatchedCountRef.current = 0;
    furthestAllowedTimeRef.current = 0;
    isSeekingRef.current = false;
    seekStartTimeRef.current = 0;

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
    setCurrentQuizIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setQuizScore(0);
    setQuizAnswers({});
    setQuizCompleted(false);
    setQuizPreviouslyCompleted(false);
    setPreviousScore({ correct: 0, total: 0 });
    setViewingScore(false);
    setFinalCourseResult(null);
    setLoading(true);

    const fetchData = async (user) => {
      try {
        const [
          oldVideosSnap,
          videoLibrarySnap,
          courseVideosSnap,
          courseVideoProgressSnap,
          videoQuizzesSnap,
          courseQuizAttemptsSnap,
          completedCourseSnap,
          courseProgressSnap,
          resultsSnap,
        ] = await Promise.all([
          get(ref(database, "videos")),
          get(ref(database, "videoLibrary")),
          get(ref(database, "courseVideos")),
          get(ref(database, videoProgressForCoursePath(user.uid, courseId))),
          get(ref(database, "videoQuizzes")),
          get(ref(database, `quizAttempts/${user.uid}/${courseId}`)),
          get(ref(database, `completedCourses/${user.uid}/${courseId}`)),
          get(ref(database, `courseProgress/${user.uid}/${courseId}`)),
          get(ref(database, `results/${user.uid}`)),
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

        const currentCourseMappings = Object.entries(
          courseVideosData?.[courseId] || {}
        );

        const matchedEntry = currentCourseMappings.find(
          ([mappingId, item]) =>
            mappingId === videoId || item?.videoId === videoId
        );

        let foundVideo = null;

        if (matchedEntry) {
          const [mappingId, mappedVideo] = matchedEntry;
          const actualVideoId = mappedVideo?.videoId || mappingId;

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
        } else {
          const fallbackVideo =
            libraryVideos.find((item) => item.id === videoId) ||
            oldVideos.find(
              (item) => item.id === videoId && item.courseId === courseId
            );

          if (fallbackVideo) {
            foundVideo = {
              ...fallbackVideo,
              id: videoId,
              courseId,
            };
          }
        }

        if (!foundVideo) {
          setVideo(null);
          setLoading(false);
          return;
        }

        const courseSnap = await get(ref(database, `courses/${courseId}`));

        if (courseSnap.exists()) {
          setCourse({ id: courseId, ...courseSnap.val() });
        }

        let courseLessons = [];

        if (courseVideosData?.[courseId]) {
          courseLessons = Object.entries(courseVideosData[courseId]).map(
            ([mappingId, mappedVideo]) => {
              const actualVideoId = mappedVideo?.videoId || mappingId;
              const fullVideo =
                libraryVideos.find((item) => item.id === actualVideoId) ||
                oldVideos.find((item) => item.id === actualVideoId) ||
                {};

              return {
                ...fullVideo,
                ...mappedVideo,
                id: actualVideoId,
                mappingId,
                courseId,
              };
            }
          );
        } else {
          courseLessons = oldVideos
            .filter((item) => item.courseId === courseId)
            .map((item) => ({ ...item, courseId }));
        }

        courseLessons = courseLessons.sort(
          (a, b) =>
            Number(a.order || 0) - Number(b.order || 0) ||
            new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        );

        const progressData = courseVideoProgressSnap.exists()
          ? courseVideoProgressSnap.val()
          : {};

        setVideo(foundVideo);
        setLessons(courseLessons);
        setProgressMap(progressData);

        const currentProgress = progressData?.[foundVideo.id];

        if (currentProgress?.watchedSeconds) {
          watchedSecondsRef.current = new Set(
            Object.keys(currentProgress.watchedSeconds).map(Number)
          );
          lastLoggedWatchedCountRef.current = watchedSecondsRef.current.size;

          const watchedList = [...watchedSecondsRef.current].filter(
            (second) => Number.isFinite(second)
          );

          furthestAllowedTimeRef.current =
            watchedList.length > 0
              ? Math.max(...watchedList)
              : 0;
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
          const vqData = videoQuizzesSnap.val() || {};
          const acceptedVideoIds = new Set(
            [foundVideo.id, foundVideo.mappingId, videoId].filter(Boolean)
          );

          const videoQuestions = [];
          const addedQuestionIds = new Set();

          const addQuestionsFromSource = (source, sourceKey = "") => {
            if (!source || typeof source !== "object") return;

            Object.entries(source).forEach(([questionId, question]) => {
              if (!question || typeof question !== "object") return;

              const hasQuestionText = Boolean(
                question.question || question.questionText
              );
              if (!hasQuestionText) return;

              const questionVideoId =
                question.videoId || question.videoID || question.lessonId;

              // Never load a question explicitly assigned to another video.
              if (questionVideoId && !acceptedVideoIds.has(questionVideoId)) {
                return;
              }

              const uniqueId = `${sourceKey}:${questionId}`;
              if (addedQuestionIds.has(uniqueId)) return;

              addedQuestionIds.add(uniqueId);
              videoQuestions.push({ id: questionId, ...question });
            });
          };

          // Supported exact structures:
          // videoQuizzes/{videoId}/{questionId}
          // videoQuizzes/{mappingId}/{questionId}
          // videoQuizzes/{courseId}/{videoId}/{questionId}
          acceptedVideoIds.forEach((videoKey) => {
            addQuestionsFromSource(vqData?.[videoKey], videoKey);
            addQuestionsFromSource(
              vqData?.[courseId]?.[videoKey],
              `${courseId}:${videoKey}`
            );
          });

          // Also support a flat question collection, but only when videoId matches.
          Object.entries(vqData).forEach(([questionId, question]) => {
            if (!question || typeof question !== "object") return;
            const questionVideoId =
              question.videoId || question.videoID || question.lessonId;
            if (questionVideoId && acceptedVideoIds.has(questionVideoId)) {
              addQuestionsFromSource({ [questionId]: question }, "flat");
            }
          });

          videoQuestions.sort(
            (a, b) => Number(a.order || 0) - Number(b.order || 0)
          );
          setQuizQuestions(videoQuestions);

          if (courseQuizAttemptsSnap.exists()) {
            const allAttempts = [];
            const courseAttempts = courseQuizAttemptsSnap.val() || {};

            Object.values(courseAttempts).forEach((attempt) => {
              if (attempt && attempt.quizType === "practice") {
                allAttempts.push(attempt);
              }
            });

            let latestAttempt = null;

            allAttempts.forEach((attempt) => {
              const attemptMatchesVideo = acceptedVideoIds.has(
                attempt?.videoId || attempt?.mappingId
              );
              const attemptMatchesCourse = attempt?.courseId === courseId;

              if (attemptMatchesVideo && attemptMatchesCourse) {
                if (
                  !latestAttempt ||
                  new Date(attempt.attemptedAt || attempt.submittedAt || 0) >
                    new Date(latestAttempt.attemptedAt || latestAttempt.submittedAt || 0)
                ) {
                  latestAttempt = attempt;
                }
              }
            });

            if (latestAttempt) {
              setQuizPreviouslyCompleted(true);
              setPreviousScore({
                correct: Number(latestAttempt.score || latestAttempt.correct || 0),
                total: Number(latestAttempt.totalMarks || latestAttempt.total || videoQuestions.length || 0),
              });
            }
          }
        }

        const completedRecord = completedCourseSnap.exists()
          ? completedCourseSnap.val()
          : null;
        const courseProgressRecord = courseProgressSnap.exists()
          ? courseProgressSnap.val()
          : null;
        const resultsData = resultsSnap.exists() ? resultsSnap.val() : {};

        // Gather final test results from multiple sources
        const finalRecords = [
          ...Object.entries(resultsData || {}).map(([resultId, item]) => ({
            id: resultId,
            source: "results",
            ...(item || {}),
          })),
        ].filter(
          (item) => item.courseId === courseId && !item.videoId
        );

        // Also check the current course's normalized quiz attempts.
        if (courseQuizAttemptsSnap.exists()) {
          const courseAttempts = courseQuizAttemptsSnap.val() || {};
          Object.entries(courseAttempts).forEach(([quizId, attempt]) => {
            if (attempt && attempt.quizType === "final") {
              finalRecords.push({
                id: quizId,
                source: "quizAttempts",
                ...attempt,
              });
            }
          });
        }

        const latestPassed = finalRecords
          .filter(
            (item) =>
              item.passed === true ||
              item.isPassed === true ||
              String(item.status || "").toLowerCase() === "passed"
          )
          .sort(
            (a, b) =>
              new Date(b.submittedAt || b.completedAt || b.createdAt || 0) -
              new Date(a.submittedAt || a.completedAt || a.createdAt || 0)
          )[0];

        if (completedRecord || latestPassed || courseProgressRecord?.courseTestPassed) {
          const source = latestPassed || completedRecord || courseProgressRecord || {};
          const rawScore = Number(
            source.score ?? source.percentage ?? source.correct ?? 0
          );
          const total = Number(
            source.total ?? source.totalMarks ?? source.totalQuestions ?? 0
          );
          const percentage =
            total > 0 && rawScore <= total
              ? Math.round((rawScore / total) * 100)
              : Math.max(0, Math.min(100, Math.round(rawScore)));

          setFinalCourseResult({
            passed: true,
            score: rawScore,
            total,
            percentage,
          });
        }

        const videoIdx = courseLessons.findIndex((l) => l.id === foundVideo.id);
        if (videoIdx > 0) {
          const allPrevComplete = courseLessons.slice(0, videoIdx).every((lesson) => {
            const prog = progressData?.[lesson.id];
            return prog?.completed || Number(prog?.watchedPercent || 0) >= 100;
          });
          if (!allPrevComplete) {
            const firstIncomplete = courseLessons.find((lesson, idx) => {
              if (idx >= videoIdx) return false;
              const prog = progressData?.[lesson.id];
              return !prog?.completed && Number(prog?.watchedPercent || 0) < 100;
            });
            setLoading(false);
            if (firstIncomplete) {
              navigate(getVideoPath(firstIncomplete.id), { replace: true });
              return;
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
  }, [courseId, videoId, navigate, location.pathname]);

  const saveProgress = async (
    percentValue,
    completed = false,
    currentTime = 0
  ) => {
    const user = auth.currentUser;
    if (!user || !video || !courseId) return;

    const watchedSecondsObject = {};
    watchedSecondsRef.current.forEach((second) => {
      watchedSecondsObject[second] = true;
    });

    const nowIso = new Date().toISOString();
    const safePercent = completed
      ? 100
      : Math.max(0, Math.min(100, Number(percentValue || 0)));

    const progressData = {
      videoId: video.id,
      mappingId: video.mappingId || null,
      courseId,
      videoTitle: video.title || video.videoTitle || "",
      completed,
      watchedPercent: safePercent,
      watchedSeconds: watchedSecondsObject,
      duration: Number(videoDuration || 0),
      lastPosition: completed ? 0 : Math.floor(currentTime || 0),
      updatedAt: nowIso,
      ...(completed && { completedAt: nowIso }),
    };

    await update(ref(database), {
      [videoProgressForVideoPath(user.uid, courseId, video.id)]: progressData,
    });

    const nextProgressMap = {
      ...progressMap,
      [video.id]: progressData,
    };

    const progressForLesson = (lesson) => {
      const lessonProgress = nextProgressMap?.[lesson.id];
      if (lessonProgress?.completed) return 100;

      return Math.max(
        0,
        Math.min(100, Number(lessonProgress?.watchedPercent || 0))
      );
    };

    const completedVideos = lessons.filter(
      (lesson) => progressForLesson(lesson) >= 100
    ).length;

    const progressPercentage =
      lessons.length > 0
        ? Math.floor(
            lessons.reduce(
              (sum, lesson) => sum + progressForLesson(lesson),
              0
            ) / lessons.length
          )
        : 0;

    const allVideosCompleted =
      lessons.length > 0 && completedVideos === lessons.length;

    await update(ref(database), {
      [courseProgressForCoursePath(user.uid, courseId)]: {
        courseId,
        progressPercentage,
        completedVideos,
        totalVideos: lessons.length,
        lastAccessedAt: nowIso,
        completed: allVideosCompleted,
        ...(allVideosCompleted && { completedAt: nowIso }),
      },
    });

    const localDayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const currentWatchedCount = watchedSecondsRef.current.size;
    const newlyWatchedSeconds = Math.max(
      0,
      currentWatchedCount - lastLoggedWatchedCountRef.current
    );

    if (newlyWatchedSeconds > 0) {
      const activityBase = learningActivityVideoPath(
        user.uid,
        localDayKey,
        courseId,
        video.id
      );

      await runTransaction(
        ref(database, `${activityBase}/seconds`),
        (current) => Number(current || 0) + newlyWatchedSeconds
      );

      await update(ref(database), {
        [`${activityBase}/videoId`]: video.id,
        [`${activityBase}/courseId`]: courseId,
        [`${activityBase}/videoTitle`]:
          video.title || video.videoTitle || "",
        [`${activityBase}/updatedAt`]: nowIso,
      });

      lastLoggedWatchedCountRef.current = currentWatchedCount;
    }

    setProgressMap(nextProgressMap);
  };

  const handleLoadedMetadata = (e) => {
    const duration = Math.floor(e.target.duration || 0);
    setVideoDuration(duration);
    e.target.playbackRate = playbackSpeed;

    if (!hasResumedRef.current && resumeTimeRef.current > 0 && duration > 0) {
      const safeResumeTime = Math.min(resumeTimeRef.current, duration - 2);
      if (safeResumeTime > 0) e.target.currentTime = safeResumeTime;
      lastVideoSecondRef.current = Math.floor(safeResumeTime);
      furthestAllowedTimeRef.current = Math.max(
        furthestAllowedTimeRef.current,
        Math.floor(safeResumeTime)
      );
      hasResumedRef.current = true;
    }
  };

  const handleVideoProgress = async (e) => {
    const player = e.target;
    const currentTime = Number(player.currentTime || 0);
    const currentSecond = Math.floor(currentTime);
    const duration = Math.floor(player.duration || 0);

    if (!duration || isSeekingRef.current) return;

    const previousSecond = lastVideoSecondRef.current;
    const movement = currentSecond - previousSecond;

    /*
     * Count only natural playback.
     * Browser timeupdate normally moves by a small amount.
     * A larger jump is treated as a seek and does not unlock skipped time.
     */
    if (movement >= 0 && movement <= 2) {
      for (
        let second = Math.max(0, previousSecond);
        second <= currentSecond;
        second += 1
      ) {
        watchedSecondsRef.current.add(second);
      }

      furthestAllowedTimeRef.current = Math.max(
        furthestAllowedTimeRef.current,
        currentTime
      );
    }

    lastVideoSecondRef.current = currentSecond;

    const watchedSeconds = Math.min(
      watchedSecondsRef.current.size,
      duration
    );

    const percent = Math.min(
      100,
      Math.floor((watchedSeconds / duration) * 100)
    );

    setWatchPercent(percent);

    const now = Date.now();

    if (now - lastSavedRef.current > 4000) {
      lastSavedRef.current = now;
      await saveProgress(percent, false, currentTime);
    }
  };

  const handleSeeking = (e) => {
    isSeekingRef.current = true;
    seekStartTimeRef.current = lastVideoSecondRef.current;

    const requestedTime = Number(e.target.currentTime || 0);
    const maxAllowed = Math.min(
      Number(e.target.duration || 0),
      furthestAllowedTimeRef.current + 2
    );

    /*
     * Rewatching already watched portions is allowed.
     * Jumping beyond the furthest genuinely watched position is blocked.
     */
    if (requestedTime > maxAllowed) {
      e.target.currentTime = Math.max(0, furthestAllowedTimeRef.current);
    }
  };

  const handleSeeked = (e) => {
    const actualTime = Number(e.target.currentTime || 0);
    const maxAllowed = Math.min(
      Number(e.target.duration || 0),
      furthestAllowedTimeRef.current + 2
    );

    if (actualTime > maxAllowed) {
      e.target.currentTime = Math.max(0, furthestAllowedTimeRef.current);
    }

    lastVideoSecondRef.current = Math.floor(e.target.currentTime || 0);
    isSeekingRef.current = false;
  };

  const handleVideoPause = async (e) => {
    if (watchPercent < 100) {
      await saveProgress(watchPercent, false, e.target.currentTime);
    }
  };

  const currentIndex = lessons.findIndex((lesson) => lesson.id === video?.id);

  const isVideoCompleted = Boolean(
    progressMap?.[video?.id]?.completed
  );

  const getLessonProgressPercent = (lesson) => {
    if (lesson.id === video?.id) {
      return isVideoCompleted ? 100 : Math.max(0, Math.min(100, watchPercent));
    }

    const lessonProgress = progressMap?.[lesson.id];

    if (lessonProgress?.completed) return 100;

    return Math.max(
      0,
      Math.min(100, Number(lessonProgress?.watchedPercent || 0))
    );
  };

  const completedLessonsCount = lessons.filter(
    (lesson) => getLessonProgressPercent(lesson) >= 100
  ).length;

  const courseOverallProgress =
    lessons.length > 0
      ? Math.floor(
          lessons.reduce(
            (sum, lesson) => sum + getLessonProgressPercent(lesson),
            0
          ) / lessons.length
        )
      : 0;

  const allCourseVideosCompleted =
    lessons.length > 0 &&
    lessons.every((lesson) => {
      const progress = progressMap?.[lesson.id];

      return Boolean(
        progress?.completed ||
          Number(progress?.watchedPercent || 0) >= 100
      );
    });

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
    const duration = Math.floor(videoRef.current?.duration || videoDuration || 0);
    const watchedSeconds = watchedSecondsRef.current.size;
    const requiredSeconds = Math.max(1, Math.floor(duration * 0.98));

    /*
     * Ending the player is not enough.
     * The user must genuinely watch at least 98% of the video duration.
     */
    if (watchedSeconds < requiredSeconds) {
      const actualPercent =
        duration > 0
          ? Math.floor((watchedSeconds / duration) * 100)
          : watchPercent;

      setWatchPercent(actualPercent);
      await saveProgress(actualPercent, false, furthestAllowedTimeRef.current);

      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(
          0,
          furthestAllowedTimeRef.current
        );
      }

      alert("Please watch the complete video without skipping.");
      return;
    }

    await markCurrentVideoComplete();

    if (quizQuestions.length > 0 && !quizPreviouslyCompleted) {
      handleStartQuiz();
      return;
    }

    if (currentIndex < lessons.length - 1) {
      navigate(getVideoPath(lessons[currentIndex + 1].id));
      return;
    }

    setShowCourseCompleteModal(true);
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
    setShowResult(true);

    const q = quizQuestions[currentQuizIndex];
    const correct = isCorrectOption(q, optionIndex);
    if (correct) setQuizScore((prev) => prev + 1);

    setQuizAnswers((prev) => ({
      ...prev,
      [currentQuizIndex]: { selected: optionIndex, correct },
    }));
  };

  const saveQuizAttempt = async (finalScore) => {
    const user = auth.currentUser;
    if (!user || !video) return;

    const quizId = `practice_${video.id}_${Date.now()}`;

    // Write to new normalized path: quizAttempts/{uid}/{courseId}/{quizId}
    await update(ref(database, `quizAttempts/${user.uid}/${courseId}/${quizId}`), {
      videoId: video.id,
      mappingId: video.mappingId || null,
      courseId,
      quizType: "practice",
      videoTitle: video.title || video.videoTitle || "",
      score: finalScore,
      totalMarks: quizQuestions.length,
      percentage: quizQuestions.length > 0 ? Math.round((finalScore / quizQuestions.length) * 100) : 0,
      passed: quizQuestions.length > 0 && finalScore >= Math.ceil(quizQuestions.length * 0.7),
      answers: quizAnswers,
      attemptedAt: new Date().toISOString(),
    });
  };

  const handleNextQuestion = async () => {
    if (currentQuizIndex < quizQuestions.length - 1) {
      setCurrentQuizIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      return;
    }

    // Last question — complete the quiz
    const finalScore = quizScore;
    setQuizCompleted(true);
    setQuizPreviouslyCompleted(true);
    setPreviousScore({ correct: finalScore, total: quizQuestions.length });

    const passed = quizQuestions.length > 0 && finalScore >= Math.ceil(quizQuestions.length * 0.7);

    try {
      await saveQuizAttempt(finalScore);
    } catch (error) {
      console.error("Failed to save revision quiz attempt:", error);
    }

    // Auto-close and continue only if passed
    if (passed) {
      setTimeout(() => {
        handleQuizContinue();
      }, 800);
    }
  };

  const handleQuizContinue = () => {
    handleCloseQuiz();

    if (currentIndex < lessons.length - 1) {
      navigate(getVideoPath(lessons[currentIndex + 1].id));
      return;
    }

    setShowCourseCompleteModal(true);
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
  const revisionQuizPassed = hasRevisionQuiz && quizPreviouslyCompleted && previousScore.total > 0 && previousScore.correct >= Math.ceil(previousScore.total * 0.7);

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
            <h2>
              {finalCourseResult?.passed
                ? "Course Successfully Completed"
                : "Course videos completed"}
            </h2>
            <p>
              {finalCourseResult?.passed
                ? `You have already passed this course with ${finalCourseResult.percentage}%.`
                : hasRevisionQuiz && !revisionQuizPassed
                  ? "You have completed all videos. Pass the revision quiz first to unlock the final test."
                  : "You have completed all videos in this course. You can now take the final course test."}
            </p>
            <div className="modal-actions">
              <button
                className="modal-secondary-btn"
                onClick={() => navigate(getCoursePath())}
              >
                Back to Course
              </button>
              {(!hasRevisionQuiz || revisionQuizPassed || finalCourseResult?.passed) && (
                <button
                  className="modal-primary-btn"
                  onClick={() =>
                    navigate(
                      finalCourseResult?.passed
                        ? getQuizPath("result")
                        : getQuizPath()
                    )
                  }
                >
                  {finalCourseResult?.passed ? "View Marks" : "Start Final Test"}
                </button>
              )}
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
                /* ── RESULT VIEW ── */
                <div className="quiz-modal-empty">
                  <div className="quiz-modal-empty-icon">
                    {revisionQuizPassed ? "🎉" : "📖"}
                  </div>
                  <h4>{revisionQuizPassed ? "Quiz Passed!" : "Quiz Failed"}</h4>
                  <p>{previousScore.correct}/{previousScore.total} Correct</p>
                  {!revisionQuizPassed && (
                    <button
                      className="quiz-btn active"
                      onClick={() => {
                        setQuizCompleted(false);
                        handleStartQuiz();
                      }}
                      style={{ marginTop: "12px" }}
                    >
                      Try Again
                    </button>
                  )}
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
                    {currentQuizIndex < quizQuestions.length - 1 ? "Next Question →" : "Finish Quiz"}
                  </button>
                ) : (
                  <span className="quiz-modal-hint">Select an answer</span>
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
        onClick={() => navigate(getCoursePath())}
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
              controlsList="nodownload noplaybackrate"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleVideoProgress}
              onSeeking={handleSeeking}
              onSeeked={handleSeeked}
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
                const nextUnlockIdx = lessons.filter((l) => progressMap?.[l.id]?.completed || Number(progressMap?.[l.id]?.watchedPercent || 0) >= 100).length;
                const locked = !completed && !active && index > nextUnlockIdx;

                return (
                  <button
                    key={item.id}
                    className={`video-list-item ${active ? "active" : ""} ${completed ? "completed" : ""} ${locked ? "locked" : ""}`}
                    disabled={locked}
                    onClick={() => {
                      if (!locked) {
                        navigate(getVideoPath(item.id));
                      }
                    }}
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
                              : locked
                                ? "status-locked"
                                : ""
                        }
                      >
                        {completed
                          ? "Completed"
                          : active
                            ? "Playing Now"
                            : locked
                              ? "🔒 Locked"
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
                        {!revisionQuizPassed && " — Failed (min 70% required)"}
                      </p>
                      {!revisionQuizPassed ? (
                        <button
                          className="quiz-btn active"
                          onClick={handleStartQuiz}
                        >
                          Try Again
                        </button>
                      ) : (
                        <button
                          className="quiz-btn active"
                          onClick={handleViewScore}
                        >
                          View Score
                        </button>
                      )}
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
            {finalCourseResult?.passed ? (
              <>
                <p>
                  Course passed with {finalCourseResult.percentage}%.
                </p>
                <button
                  className="quiz-btn active"
                  onClick={() =>
                    navigate(getQuizPath("result"))
                  }
                >
                  View Marks
                </button>
              </>
            ) : allCourseVideosCompleted ? (
              hasRevisionQuiz && !revisionQuizPassed ? (
                <>
                  <p>Pass the revision quiz first to unlock the final test.</p>
                  <button disabled className="quiz-btn disabled">
                    Locked
                  </button>
                </>
              ) : (
                <>
                  <p>All lessons completed.</p>
                  <button
                    className="quiz-btn active"
                    onClick={() => navigate(getQuizPath())}
                  >
                    Start Final Test
                  </button>
                </>
              )
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
