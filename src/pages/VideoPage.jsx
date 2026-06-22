import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ref, get, update } from "firebase/database";
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

  const [video, setVideo] = useState(null);
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [watchPercent, setWatchPercent] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    watchedSecondsRef.current = new Set();
    lastSavedRef.current = 0;
    resumeTimeRef.current = 0;
    hasResumedRef.current = false;

    setVideo(null);
    setCourse(null);
    setLessons([]);
    setWatchPercent(0);
    setVideoDuration(0);
    setLoading(true);

    fetchData();
  }, [id]);

  const fetchData = async () => {
    const user = auth.currentUser;

    if (!user) {
      navigate("/");
      return;
    }

    try {
      const videoSnapshot = await get(ref(database, `videos/${id}`));

      if (!videoSnapshot.exists()) {
        setVideo(null);
        setLoading(false);
        return;
      }

      const videoData = {
        id,
        ...videoSnapshot.val(),
      };

      setVideo(videoData);

      const courseSnapshot = await get(
        ref(database, `courses/${videoData.courseId}`)
      );

      if (courseSnapshot.exists()) {
        setCourse({
          id: videoData.courseId,
          ...courseSnapshot.val(),
        });
      }

      const allVideosSnap = await get(ref(database, "videos"));

      let courseLessons = [];

      if (allVideosSnap.exists()) {
        courseLessons = Object.entries(allVideosSnap.val())
          .map(([videoId, item]) => ({
            id: videoId,
            ...item,
          }))
          .filter((item) => item.courseId === videoData.courseId)
          .sort(
            (a, b) =>
              new Date(a.createdAt || 0).getTime() -
              new Date(b.createdAt || 0).getTime()
          );

        setLessons(courseLessons);
      }

      const allProgressSnap = await get(ref(database, `progress/${user.uid}`));
      const allProgressData = allProgressSnap.exists()
        ? allProgressSnap.val()
        : {};

      setProgressMap(allProgressData);

      const currentProgress = allProgressData?.[id];

      if (currentProgress) {
        if (currentProgress.watchedSeconds) {
          watchedSecondsRef.current = new Set(
            Object.keys(currentProgress.watchedSeconds).map(Number)
          );
        }

        if (currentProgress.completed) {
          setWatchPercent(100);
        } else {
          setWatchPercent(Number(currentProgress.watchedPercent || 0));
        }

        if (currentProgress.lastPosition) {
          resumeTimeRef.current = Number(currentProgress.lastPosition || 0);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error(error);
      alert("Failed to load video");
      setLoading(false);
    }
  };

  const refreshProgressMap = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const snap = await get(ref(database, `progress/${user.uid}`));
    setProgressMap(snap.exists() ? snap.val() : {});
  };

  const saveProgress = async (
    percentValue,
    completed = false,
    currentTime = 0
  ) => {
    const user = auth.currentUser;

    if (!user || !video) return;

    const watchedSecondsObject = {};

    watchedSecondsRef.current.forEach((second) => {
      watchedSecondsObject[second] = true;
    });

    const progressData = {
      videoId: video.id,
      courseId: video.courseId,
      videoTitle: video.title || "",
      completed,
      watchedPercent: completed ? 100 : percentValue,
      watchedSeconds: watchedSecondsObject,
      duration: videoDuration,
      lastPosition: completed ? 0 : Math.floor(currentTime),
      updatedAt: new Date().toISOString(),
      ...(completed && {
        completedAt: new Date().toISOString(),
      }),
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

    if (!hasResumedRef.current && resumeTimeRef.current > 0 && duration > 0) {
      const safeResumeTime = Math.min(resumeTimeRef.current, duration - 2);

      if (safeResumeTime > 0) {
        e.target.currentTime = safeResumeTime;
      }

      hasResumedRef.current = true;
    }
  };

  const handleVideoProgress = async (e) => {
    const currentSecond = Math.floor(e.target.currentTime || 0);
    const duration = Math.floor(e.target.duration || 0);

    if (!duration) return;

    watchedSecondsRef.current.add(currentSecond);

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

  const getCurrentIndex = () => {
    return lessons.findIndex((lesson) => lesson.id === id);
  };

  const getNextLesson = () => {
    const currentIndex = getCurrentIndex();

    if (currentIndex === -1) return null;

    return lessons[currentIndex + 1] || null;
  };

  const handleVideoEnd = async () => {
    if (!videoDuration) return;

    const actualWatchedPercent = Math.floor(
      (watchedSecondsRef.current.size / videoDuration) * 100
    );

    if (actualWatchedPercent >= 90) {
      setWatchPercent(100);
      await saveProgress(100, true, 0);
      await refreshProgressMap();

      const nextLesson = getNextLesson();

      if (nextLesson) {
        setTimeout(() => {
          navigate(`/video/${nextLesson.id}`);
        }, 800);
      }
    } else {
      await saveProgress(actualWatchedPercent, false, videoDuration);
      alert("Please watch the complete video.");
    }
  };

  const isLessonCompleted = (lessonId) => {
    if (lessonId === id && watchPercent >= 90) return true;
    return !!progressMap?.[lessonId]?.completed;
  };

  const completedLessons = lessons.filter((lesson) =>
    isLessonCompleted(lesson.id)
  ).length;

  const overallProgress =
    lessons.length > 0
      ? Math.round((completedLessons / lessons.length) * 100)
      : 0;

  const allVideosCompleted =
    lessons.length > 0 && completedLessons === lessons.length;

  if (loading) {
    return <h2 className="video-status-msg">Loading Video...</h2>;
  }

  if (!video) {
    return <h1 className="video-status-msg error">Video Not Found</h1>;
  }

  return (
    <div className="lesson-player-page">
      <div className="lesson-player-top">
        <button className="lesson-back-btn" onClick={() => navigate(-1)}>
          Back
        </button>

        <h1>{course?.title || video.courseTitle || "Course"}</h1>
      </div>

      <div className="lesson-player-layout">
        <div className="lesson-player-main">
          <div className="video-player-box">
            <video
              key={video.id}
              ref={videoRef}
              controls
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleVideoProgress}
              onPause={handleVideoPause}
              onEnded={handleVideoEnd}
              className="video-player-frame"
            >
              <source src={video.videoUrl} type="video/mp4" />
            </video>
          </div>

          <div className="lesson-info-box">
            <h2>{video.title}</h2>
            <p>{video.description || "Training video lesson."}</p>

            <div className="current-video-progress">
              <div>
                <span>Current Video Progress</span>
                <strong>{watchPercent}%</strong>
              </div>

              <div className="lesson-progress-track">
                <span style={{ width: `${watchPercent}%` }}></span>
              </div>
            </div>
          </div>
        </div>

        <aside className="lesson-right-panel">
          <div className="lesson-progress-box">
            <div className="lesson-progress-head">
              <span>Course Progress</span>
              <strong>{overallProgress}%</strong>
            </div>

            <div className="lesson-progress-track">
              <span style={{ width: `${overallProgress}%` }}></span>
            </div>
          </div>

          <div className="lesson-list-box">
            <h2>Lessons</h2>

            <div className="lesson-list">
              {lessons.map((lesson, index) => {
                const completed = isLessonCompleted(lesson.id);
                const active = lesson.id === id;

                return (
                  <Link
                    to={`/video/${lesson.id}`}
                    className={`lesson-list-item ${active ? "active" : ""}`}
                    key={lesson.id}
                  >
                    <div>
                      <span>
                        {index + 1}. {lesson.title}
                      </span>
                    </div>

                    <strong>{completed ? "Completed" : ""}</strong>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="course-quiz-note">
            <h3>Course Quiz</h3>

            {allVideosCompleted ? (
              <>
                <p>All videos are completed. You can now start the course quiz.</p>

                <button
                  type="button"
                  className="start-course-quiz-btn"
                  onClick={() => navigate(`/quiz/${video.courseId}`)}
                >
                  Start Quiz
                </button>
              </>
            ) : (
              <p>Quiz will unlock after completing all course videos.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default VideoPage;