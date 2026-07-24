import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import useBasePath from "../hooks/useBasePath";
import "../styles/dashboard.css";

import {
  FaBookOpen,
  FaClock,
  FaCheckCircle,
  FaCertificate,
  FaPlay,
  FaVideo,
  FaClipboardCheck,
  FaChartLine,
} from "react-icons/fa";

function Dashboard() {
  const navigate = useNavigate();
  const basePath = useBasePath();

  const [courses, setCourses] = useState([]);
  const [courseVideosMap, setCourseVideosMap] = useState({});
  const [progressMap, setProgressMap] = useState({});
  const [results, setResults] = useState({});
  const [completedCourses, setCompletedCourses] = useState({});
  const [quizAttempts, setQuizAttempts] = useState({});
  const [courseContentUpdates, setCourseContentUpdates] = useState({});
  const [courseProgressData, setCourseProgressData] = useState({});
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/");
        return;
      }

      try {
        const [
          userSnapshot,
          assignmentsSnapshot,
          resultsSnapshot,
          completedSnapshot,
          courseProgressSnapshot,
          videoProgressSnapshot,
          coursesSnapshot,
          videosSnapshot,
          courseVideosSnapshot,
          videoLibrarySnapshot,
          quizAttemptsSnapshot,
          courseContentUpdatesSnapshot,
        ] = await Promise.all([
          get(ref(database, `users/${user.uid}`)),
          get(ref(database, `userAssignments/${user.uid}`)),
          get(ref(database, `results/${user.uid}`)),
          get(ref(database, `completedCourses/${user.uid}`)),
          get(ref(database, `courseProgress/${user.uid}`)),
          get(ref(database, `videoProgress/${user.uid}`)),
          get(ref(database, "courses")),
          get(ref(database, "videos")),
          get(ref(database, "courseVideos")),
          get(ref(database, "videoLibrary")),
          get(ref(database, `quizAttempts/${user.uid}`)),
          get(ref(database, "courseContentUpdates")),
        ]);

        if (userSnapshot.exists()) {
          setUserData({ id: user.uid, email: user.email, ...userSnapshot.val() });
        }

        const userResults = resultsSnapshot.exists() ? resultsSnapshot.val() : {};
        const userCompletedCourses = completedSnapshot.exists()
          ? completedSnapshot.val()
          : {};
        // Merge video progress from new and legacy paths
        const newVideoProgress = videoProgressSnapshot.exists() ? videoProgressSnapshot.val() : {};
        const mergedProgressMap = {};
        Object.values(newVideoProgress).forEach((courseVideos) => {
          if (courseVideos && typeof courseVideos === "object") {
            Object.entries(courseVideos).forEach(([videoId, videoProg]) => {
              mergedProgressMap[videoId] = videoProg;
            });
          }
        });
        // Also include legacy progress
        const legacyProgressSnap = await get(ref(database, `progress/${user.uid}`));
        if (legacyProgressSnap.exists()) {
          Object.entries(legacyProgressSnap.val()).forEach(([videoId, prog]) => {
            if (!mergedProgressMap[videoId]) {
              mergedProgressMap[videoId] = prog;
            }
          });
        }

        setResults(userResults);
        setCompletedCourses(userCompletedCourses);
        setProgressMap(mergedProgressMap);
        setQuizAttempts(quizAttemptsSnapshot.exists() ? quizAttemptsSnapshot.val() : {});
        setCourseContentUpdates(courseContentUpdatesSnapshot.exists() ? courseContentUpdatesSnapshot.val() : {});

        const userCourseProgress = courseProgressSnapshot.exists() ? courseProgressSnapshot.val() : {};
        setCourseProgressData(userCourseProgress);

        if (!assignmentsSnapshot.exists() || !coursesSnapshot.exists()) {
          setCourses([]);
          setCourseVideosMap({});
          setLoading(false);
          return;
        }

        const assignments = assignmentsSnapshot.val();
        const allCourses = coursesSnapshot.val();

        const assignedCourseIds = Object.keys(assignments).filter(
          (courseId) => assignments[courseId]?.assigned
        );

        const courseArray = assignedCourseIds
          .map((courseId) => ({
            id: courseId,
            ...allCourses[courseId],
            assignment: assignments[courseId],
          }))
          .filter((course) => course.title || course.courseTitle);

        const oldVideos = videosSnapshot.exists()
          ? Object.entries(videosSnapshot.val()).map(([videoId, video]) => ({
            id: videoId,
            ...video,
          }))
          : [];

        const libraryVideos = videoLibrarySnapshot.exists()
          ? Object.entries(videoLibrarySnapshot.val()).map(([videoId, video]) => ({
            id: videoId,
            ...video,
          }))
          : [];

        const courseVideosData = courseVideosSnapshot.exists()
          ? courseVideosSnapshot.val()
          : {};

        const map = {};

        courseArray.forEach((course) => {
          const mappedVideos = courseVideosData?.[course.id]
            ? Object.entries(courseVideosData[course.id]).map(([videoId, video]) => ({
              id: videoId,
              ...video,
            }))
            : [];

          if (mappedVideos.length > 0) {
            map[course.id] = mappedVideos.sort((a, b) => (a.order || 0) - (b.order || 0));
            return;
          }

          if (Array.isArray(course.videoIds) && course.videoIds.length > 0) {
            map[course.id] = course.videoIds
              .map((videoId) => libraryVideos.find((video) => video.id === videoId))
              .filter(Boolean);
            return;
          }

          map[course.id] = oldVideos
            .filter((video) => video.courseId === course.id)
            .sort(
              (a, b) =>
                new Date(a.createdAt || 0).getTime() -
                new Date(b.createdAt || 0).getTime()
            );
        });

        courseArray.sort(
          (a, b) =>
            new Date(b.assignment?.assignedAt || b.createdAt || 0) -
            new Date(a.assignment?.assignedAt || a.createdAt || 0)
        );

        setCourses(courseArray);
        setCourseVideosMap(map);
      } catch (error) {
        console.error(error);
        alert("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const getCourseProgress = (courseId) => {
    const courseVideos = courseVideosMap[courseId] || [];

    if (courseVideos.length > 0) {
      const total = courseVideos.reduce((sum, video) => {
        const progress = progressMap?.[video.id];
        if (progress?.completed) return sum + 100;
        return sum + Number(progress?.watchedPercent || 0);
      }, 0);
      const calculated = Math.round(total / courseVideos.length);

      if (calculated >= 100 && (completedCourses?.[courseId]?.passed || completedCourses?.[courseId]?.completed)) {
        return 100;
      }

      return calculated;
    }

    if (completedCourses?.[courseId]?.passed || completedCourses?.[courseId]?.completed) {
      return 100;
    }

    return 0;
  };

  const getCourseThumbnail = (course) => {
    if (course.thumbnailUrl) return course.thumbnailUrl;
    if (course.courseThumbnail) return course.courseThumbnail;
    if (course.assignment?.courseThumbnail) return course.assignment.courseThumbnail;

    const videos = courseVideosMap[course.id] || [];
    const videoWithThumb = videos.find((video) => video.thumbnailUrl);

    return videoWithThumb?.thumbnailUrl || "";
  };

  const totalCourses = courses.length;

  const completedCount = useMemo(() => {
    return courses.filter((course) => getCourseProgress(course.id) >= 100).length;
  }, [courses, courseVideosMap, progressMap, completedCourses]);

  const inProgressCount = useMemo(() => {
    return courses.filter((course) => {
      const progress = getCourseProgress(course.id);
      return progress > 0 && progress < 100;
    }).length;
  }, [courses, courseVideosMap, progressMap, completedCourses]);

  const passedCount = useMemo(() => {
    return courses.filter((course) => {
      const result = results?.[course.id];
      const completed = completedCourses?.[course.id];
      return result?.passed || completed?.passed;
    }).length;
  }, [courses, results, completedCourses]);

  const progressPercent =
    totalCourses > 0 ? Math.round((completedCount / totalCourses) * 100) : 0;

  const totalVideosCompleted = useMemo(() => {
    return Object.values(progressMap).filter((p) => p?.completed).length;
  }, [progressMap]);

  const totalTimeWatched = useMemo(() => {
    let totalSeconds = 0;
    Object.values(progressMap).forEach((p) => {
      if (p?.watchedSeconds && typeof p.watchedSeconds === "object") {
        totalSeconds += Object.keys(p.watchedSeconds).length;
      } else if (p?.watchedSeconds && typeof p.watchedSeconds === "number") {
        totalSeconds += p.watchedSeconds;
      } else if (p?.watchedPercent && p?.duration) {
        totalSeconds += (Number(p.watchedPercent) / 100) * Number(p.duration);
      }
    });
    return totalSeconds;
  }, [progressMap]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const finalTestsTaken = useMemo(() => {
    let count = 0;
    Object.values(quizAttempts).forEach((attempts) => {
      if (typeof attempts === "object") {
        Object.values(attempts).forEach((attempt) => {
          if (attempt?.quizType === "final" || attempt?.type === "final") count++;
        });
      }
    });
    return count;
  }, [quizAttempts]);

  const avgFinalScore = useMemo(() => {
    let total = 0;
    let count = 0;
    Object.values(quizAttempts).forEach((attempts) => {
      if (typeof attempts === "object") {
        Object.values(attempts).forEach((attempt) => {
          if ((attempt?.quizType === "final" || attempt?.type === "final") && attempt?.percentage != null) {
            total += Number(attempt.percentage);
            count++;
          }
        });
      }
    });
    return count > 0 ? Math.round(total / count) : 0;
  }, [quizAttempts]);

  const allVideosFlat = useMemo(() => {
    return courses.flatMap((course) => {
      const videos = courseVideosMap[course.id] || [];

      return videos.map((video) => ({
        ...video,
        courseId: course.id,
        courseTitle: course.title || course.courseTitle,
        courseThumbnail: getCourseThumbnail(course),
        courseAssignedAt: course.assignment?.assignedAt || course.createdAt,
      }));
    });
  }, [courses, courseVideosMap, completedCourses, progressMap]);

  const continueVideo = useMemo(() => {
    const watchedVideos = allVideosFlat
      .map((video) => ({
        ...video,
        progress: progressMap?.[video.id] || {},
        watchedPercent: Number(progressMap?.[video.id]?.watchedPercent || 0),
      }))
      .filter((video) => video.watchedPercent > 0 && !video.progress?.completed)
      .sort((a, b) => {
        const aTime = new Date(a.progress?.updatedAt || a.progress?.lastWatchedAt || 0).getTime();
        const bTime = new Date(b.progress?.updatedAt || b.progress?.lastWatchedAt || 0).getTime();
        return bTime - aTime;
      });

    if (watchedVideos.length > 0) return watchedVideos[0];

    const firstNotStartedCourse = courses.find((course) => getCourseProgress(course.id) < 100);
    const firstVideo = firstNotStartedCourse
      ? (courseVideosMap[firstNotStartedCourse.id] || [])[0]
      : null;

    if (!firstVideo) return null;

    return {
      ...firstVideo,
      courseId: firstNotStartedCourse.id,
      courseTitle: firstNotStartedCourse.title || firstNotStartedCourse.courseTitle,
      courseThumbnail: getCourseThumbnail(firstNotStartedCourse),
      watchedPercent: 0,
    };
  }, [allVideosFlat, progressMap, courses, courseVideosMap]);

  const newlyAssignedCourses = useMemo(() => {
    return [...courses]
      .sort(
        (a, b) =>
          new Date(b.assignment?.assignedAt || b.createdAt || 0) -
          new Date(a.assignment?.assignedAt || a.createdAt || 0)
      )
      .slice(0, 3);
  }, [courses]);

  const newInCoursesVideos = useMemo(() => {
    const results = [];
    courses.forEach((course) => {
      const contentUpdate = courseContentUpdates[course.id];
      if (!contentUpdate?.newVideoIds?.length) return;

      const lastAccessed = courseProgressData[course.id]?.lastAccessedAt
        || course.assignment?.assignedAt
        || course.createdAt
        || "";

      const videos = courseVideosMap[course.id] || [];
      contentUpdate.newVideoIds.forEach((videoId) => {
        const video = videos.find((v) => v.id === videoId);
        if (!video) return;
        const addedAt = video.addedAt || contentUpdate.lastUpdatedAt || "";
        if (lastAccessed && addedAt && new Date(addedAt) <= new Date(lastAccessed)) return;
        if (progressMap[videoId]?.completed) return;
        results.push({
          ...video,
          courseId: course.id,
          courseTitle: course.title || course.courseTitle,
          courseThumbnail: getCourseThumbnail(course),
          addedAt,
        });
      });
    });
    results.sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));
    return results.slice(0, 6);
  }, [courses, courseContentUpdates, courseVideosMap, progressMap, courseProgressData]);

  const recentlyCompletedCourses = useMemo(() => {
    return courses
      .filter((course) => {
        const progress = courseProgressData[course.id];
        return progress?.completed || progress?.courseTestPassed
          || completedCourses?.[course.id]?.completed
          || completedCourses?.[course.id]?.passed;
      })
      .sort((a, b) => {
        const aDate = courseProgressData[a.id]?.completedAt
          || completedCourses?.[a.id]?.completedAt
          || "";
        const bDate = courseProgressData[b.id]?.completedAt
          || completedCourses?.[b.id]?.completedAt
          || "";
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      })
      .slice(0, 4);
  }, [courses, courseProgressData, completedCourses]);

  if (loading) {
    return <h2 className="dashboard-loading">Loading Dashboard...</h2>;
  }

return (
  <div className="super-dashboard">
    <section className="dash-hero">
      <div className="hero-content">
        <h1>Hi, {userData?.name || "Learner"}</h1>
        <p>Continue your assigned learning and keep your progress moving.</p>
        <div className="hero-stats">
          <div className="hero-stat">
           
          </div>
          <div className="hero-stat">
            <div className="hero-stat-icon admins-icon">
              <FaVideo />
            </div>
            <div>
              <strong>{totalVideosCompleted}</strong>
              <span>Videos Done</span>
            </div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-icon dept-icon">
              <FaCheckCircle />
            </div>
            <div>
              <strong>{completedCount}</strong>
              <span>Courses Done</span>
            </div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-icon">
              <FaCertificate />
            </div>
            <div>
              <strong>{passedCount}</strong>
              <span>Certificates</span>
            </div>
          </div>
        </div>
      </div>
      <div className="hero-decoration">
        <div className="hero-circle-1"></div>
        <div className="hero-circle-2"></div>
      </div>
    </section>

    <section className="dash-stat-cards">
  
      <div className="stat-card stat-videos">
        <div className="stat-card-icon">
          <FaVideo />
        </div>
        <div className="stat-card-info">
          <span>Videos Completed</span>
          <strong>{totalVideosCompleted}</strong>
        </div>
      </div>
      <div className="stat-card stat-tests">
        <div className="stat-card-icon">
          <FaClipboardCheck />
        </div>
        <div className="stat-card-info">
          <span>Final Tests Taken</span>
          <strong>{finalTestsTaken}</strong>
        </div>
      </div>
      <div className="stat-card stat-score">
        <div className="stat-card-icon">
          <FaChartLine />
        </div>
        <div className="stat-card-info">
          <span>Avg Final Score</span>
          <strong>{avgFinalScore}%</strong>
        </div>
      </div>
      <div className="stat-card stat-completed">
        <div className="stat-card-icon">
          <FaCheckCircle />
        </div>
        <div className="stat-card-info">
          <span>Courses Completed</span>
          <strong>{completedCount}</strong>
        </div>
      </div>
      <div className="stat-card stat-cert">
        <div className="stat-card-icon">
          <FaCertificate />
        </div>
        <div className="stat-card-info">
          <span>Certificates</span>
          <strong>{passedCount}</strong>
        </div>
      </div>
    </section>

    {continueVideo && (
      <section className="continue-section">
        <div className="card-head">
          <div>
            <h2>Continue Learning</h2>
            <p>Resume where you left off</p>
          </div>
        </div>
        <Link to={`${basePath}/course/${continueVideo.courseId}`} className="continue-card">
          <div className="continue-image">
            {continueVideo.thumbnailUrl || continueVideo.courseThumbnail ? (
              <img
                src={continueVideo.thumbnailUrl || continueVideo.courseThumbnail}
                alt={continueVideo.title}
              />
            ) : (
              <div>
                <FaPlay />
              </div>
            )}
          </div>
          <div className="continue-content">
            <span>{continueVideo.courseTitle}</span>
            <h3>{continueVideo.title}</h3>
            <div className="continue-progress">
              <div>
                <span style={{ width: `${continueVideo.watchedPercent || 0}%` }} />
              </div>
              <strong>{continueVideo.watchedPercent || 0}%</strong>
            </div>
          </div>
          <button>Continue</button>
        </Link>
      </section>
    )}


     {newInCoursesVideos.length > 0 && (
      <section className="new-content-section">
        <div className="card-head">
          <div>
            <h2>New in Your Courses</h2>
            <p>Newly added videos you haven&apos;t watched yet</p>
          </div>
        </div>
        <div className="new-content-grid">
          {newInCoursesVideos.map((video) => (
            <Link to={`${basePath}/course/${video.courseId}`} className="new-content-card" key={`${video.courseId}-${video.id}`}>
              <div className="new-content-thumb">
                {video.thumbnailUrl ? (
                  <img src={video.thumbnailUrl} alt={video.title} />
                ) : (
                  <div className="new-content-placeholder">
                    <FaPlay />
                  </div>
                )}
                <span className="new-badge">NEW</span>
              </div>
              <div className="new-content-info">
                <h4>{video.title || video.videoTitle || "Untitled"}</h4>
                <span className="new-content-course">{video.courseTitle}</span>
                {video.metadata?.organName && (
                  <span className="new-content-meta">{video.metadata.organName}{video.metadata?.videoType ? ` \u2022 ${video.metadata.videoType}` : ""}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>
    )}


    <section className="newly-courses-section">
      <div className="card-head">
        <div>
          <h2>Newly Assigned</h2>
          <p>Courses assigned to you recently</p>
        </div>
        <Link to={`${basePath}/assigned-courses`}>View All</Link>
      </div>
      <div className="newly-courses-grid">
        {newlyAssignedCourses.length === 0 ? (
          <p className="empty-text">No courses assigned yet.</p>
        ) : (
          newlyAssignedCourses.map((course, i) => {
            const colors = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"];
            const letter = (course.title || course.courseTitle || "C").charAt(0).toUpperCase();
            const thumbnail = getCourseThumbnail(course);
            const progress = getCourseProgress(course.id);
            return (
              <Link to={`${basePath}/course/${course.id}`} className="newly-course-card" key={course.id}>
                <div className="newly-course-thumb">
                  {thumbnail ? (
                    <img src={thumbnail} alt={course.title || course.courseTitle} />
                  ) : (
                    <div className="newly-course-placeholder" style={{ background: colors[i % colors.length] }}>
                      {letter}
                    </div>
                  )}
                </div>
                <div className="newly-course-info">
                  <h3>{course.title || course.courseTitle}</h3>
                  <span>{course.department || "Training"}</span>
                  <div className="newly-course-progress">
                    <div className="progress-bar">
                      <span style={{ width: `${progress}%` }}></span>
                    </div>
                    <strong>{progress}%</strong>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </section>

   
    {recentlyCompletedCourses.length > 0 && (
      <section className="completed-courses-section">
        <div className="card-head">
          <div>
            <h2>Recently Completed</h2>
            <p>Courses you&apos;ve finished</p>
          </div>
          <Link to={`${basePath}/assigned-courses`}>View All</Link>
        </div>
        <div className="completed-courses-grid">
          {recentlyCompletedCourses.map((course, i) => {
            const colors = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"];
            const letter = (course.title || course.courseTitle || "C").charAt(0).toUpperCase();
            const thumbnail = getCourseThumbnail(course);
            const completedAt = courseProgressData[course.id]?.completedAt
              || completedCourses?.[course.id]?.completedAt
              || "";
            const score = courseProgressData[course.id]?.score
              || courseProgressData[course.id]?.percentage
              || "";
            return (
              <Link to={`${basePath}/course/${course.id}`} className="completed-course-card" key={course.id}>
                <div className="completed-course-thumb">
                  {thumbnail ? (
                    <img src={thumbnail} alt={course.title || course.courseTitle} />
                  ) : (
                    <div className="completed-course-placeholder" style={{ background: colors[i % colors.length] }}>
                      {letter}
                    </div>
                  )}
                  <div className="completed-check">
                    <FaCheckCircle />
                  </div>
                </div>
                <div className="completed-course-info">
                  <h3>{course.title || course.courseTitle}</h3>
                  <span>{course.department || "Training"}</span>
                  {completedAt && (
                    <span className="completed-date">
                      Completed {new Date(completedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  )}
                  {score !== "" && (
                    <span className="completed-score">Score: {Math.round(score)}%</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    )}
  </div>
);
}

export default Dashboard;
