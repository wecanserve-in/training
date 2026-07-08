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

  useEffect(() => {
    // Reset refs & state on ID change
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
    setLoading(true);

    const fetchData = async (user) => {
      try {
        const [oldVideosSnap, videoLibrarySnap, courseVideosSnap, progressSnap] =
          await Promise.all([
            get(ref(database, "videos")),
            get(ref(database, "videoLibrary")),
            get(ref(database, "courseVideos")),
            get(ref(database, `progress/${user.uid}`)),
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

        courseLessons = courseLessons.sort((a, b) => {
          return (
            Number(a.order || 0) - Number(b.order || 0) ||
            new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
          );
        });

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

        setLoading(false);
      } catch (error) {
        console.error(error);
        alert("Failed to load video");
        setLoading(false);
      }
    };

    // Safely wait for Firebase to initialize auth state
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/");
      } else {
        fetchData(user);
      }
    });

    return () => unsubscribe(); // Cleanup listener on unmount
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

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
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
  const nextVideo = lessons[currentIndex + 1] || null;

  const isVideoCompleted = watchPercent >= 90 || progressMap?.[video?.id]?.completed;

  // Course Progress Calculations
  const completedLessonsCount = lessons.filter(l => progressMap?.[l.id]?.completed || (l.id === video?.id && isVideoCompleted)).length;
  const courseOverallProgress = lessons.length > 0 ? Math.floor((completedLessonsCount / lessons.length) * 100) : 0;
  
  const allCourseVideosCompleted =
    lessons.length > 0 &&
    lessons.every((lesson) =>
      lesson.id === video?.id ? isVideoCompleted : progressMap?.[lesson.id]?.completed
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

    const isLastVideo = currentIndex === lessons.length - 1;
    if (isLastVideo) {
      setShowCourseCompleteModal(true);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const videoTitle = video?.title || video?.videoTitle || "";
  const videoDescription = video?.description || video?.videoDescription || "";
  const videoUrl = video?.videoUrl || video?.url || video?.fileUrl || "";
  const hasRevisionQuiz = video?.hasQuiz || Number(video?.totalQuizQuestions || 0) > 0;
  const videoQuizId = video?.id || "";
  const courseId = video?.courseId;

  if (loading) return <h2 className="video-status-msg">Loading Video...</h2>;

  if (!video || !videoUrl) {
    return <h1 className="video-status-msg error">Video Not Found</h1>;
  }

  return (
    <div className="video-page-clean">
      {showCourseCompleteModal && (
        <div className="course-complete-modal-backdrop">
          <div className="course-complete-modal">
            <div className="modal-success-icon">✓</div>
            <h2>Course videos completed</h2>
            <p>
              You have completed all videos in this course. You can now take the
              final course test.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-secondary-btn"
                onClick={() => navigate(`../course/${courseId}`)}
              >
                Back to Course
              </button>
              <button
                type="button"
                className="modal-primary-btn"
                onClick={() => navigate(`../quiz/${courseId}`)}
              >
                Start Final Test
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        className="video-back-btn"
        onClick={() => navigate(`../course/${courseId}`)}
      >
        ← Back to Course
      </button>

      {/* Main Layout (Both sides scroll together now) */}
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

          {/* ABOUT */}
          <div className="video-about-card">
            <p>{course?.title || course?.courseTitle}</p>
            <h1>{videoTitle}</h1>
            {videoDuration > 0 && (
              <span className="video-duration-pill">
                {formatTime(videoDuration)}
              </span>
            )}
            {videoDescription && (
              <div className="video-description">
                <h3>About this lesson</h3>
                <p>{videoDescription}</p>
              </div>
            )}
          </div>
        </main>

        {/* RIGHT (Normal scrolling, no sticky) */}
        <aside className="video-side-area">
          
          {/* COURSE CONTENT */}
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

                return (
                  <button
                    key={item.id}
                    className={`video-list-item ${active ? "active" : ""} ${
                      completed ? "completed" : ""
                    }`}
                    onClick={() => navigate(`../video/${item.id}`)}
                  >
                    <div className="video-list-number">
                      {active ? "▶" : completed ? "✓" : index + 1}
                    </div>

                    <div className="video-list-content">
                      <strong>
                        {index + 1}. {item.title || item.videoTitle}
                      </strong>
                      <span>{formatTime(item.duration || 0)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* COURSE PROGRESS */}
          <div className="course-progress-card">
            <div className="progress-header">
              <h3>Course Progress</h3>
              <strong>{courseOverallProgress}%</strong>
            </div>
            
            {/* Reduced width progress bar container */}
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${courseOverallProgress}%` }}></div>
            </div>
            
            <p className="progress-text">
              {completedLessonsCount} of {lessons.length} lessons
            </p>
          </div>

          {/* REVISION QUIZ */}
          {hasRevisionQuiz && (
            <div className="quiz-card">
              <h2>Revision Quiz</h2>
              {isVideoCompleted ? (
                <>
                  <p>Test your understanding before moving ahead.</p>
                  <button
                    type="button"
                    className="quiz-btn active"
                    onClick={() =>
                      navigate(
                        `../quiz/${videoQuizId}?type=video&courseId=${courseId}&videoId=${videoQuizId}`
                      )
                    }
                  >
                    Start Revision Quiz
                  </button>
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

          {/* FINAL TEST */}
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