import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import useBasePath from "../hooks/useBasePath";
import "../styles/dashboard.css";

import {
  FaBookOpen,
  FaCheckCircle,
  FaCertificate,
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
          courseVideosSnapshot,
          videoLibrarySnapshot,
          quizAttemptsSnapshot,
        ] = await Promise.all([
          get(ref(database, `users/${user.uid}`)),
          get(ref(database, `userAssignments/${user.uid}`)),
          get(ref(database, `results/${user.uid}`)),
          get(ref(database, `completedCourses/${user.uid}`)),
          get(ref(database, `courseProgress/${user.uid}`)),
          get(ref(database, `videoProgress/${user.uid}`)),
          get(ref(database, "courses")),
          get(ref(database, "courseVideos")),
          get(ref(database, "videoLibrary")),
          get(ref(database, `quizAttempts/${user.uid}`)),
        ]);

        if (userSnapshot.exists()) {
          setUserData({ id: user.uid, email: user.email, ...userSnapshot.val() });
        }

        const userResults = resultsSnapshot.exists() ? resultsSnapshot.val() : {};
        const userCompletedCourses = completedSnapshot.exists()
          ? completedSnapshot.val()
          : {};

        const newVideoProgress = videoProgressSnapshot.exists() ? videoProgressSnapshot.val() : {};
        const mergedProgressMap = {};
        Object.values(newVideoProgress).forEach((courseVideos) => {
          if (courseVideos && typeof courseVideos === "object") {
            Object.entries(courseVideos).forEach(([videoId, videoProg]) => {
              mergedProgressMap[videoId] = videoProg;
            });
          }
        });

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

  const hasNewVideos = (courseId) => {
    const lastAccessed = courseProgressData[courseId]?.lastAccessedAt;
    if (!lastAccessed) return false;
    const videos = courseVideosMap[courseId] || [];
    return videos.some((v) => v.addedAt && new Date(v.addedAt) > new Date(lastAccessed));
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

  const continueLearningCourses = useMemo(() => {
    return courses
      .filter((course) => {
        const progress = getCourseProgress(course.id);
        return progress > 0 && progress < 100;
      })
      .sort((a, b) => {
        const aProgress = courseProgressData[a.id]?.lastAccessedAt || a.assignment?.assignedAt || "";
        const bProgress = courseProgressData[b.id]?.lastAccessedAt || b.assignment?.assignedAt || "";
        return new Date(bProgress).getTime() - new Date(aProgress).getTime();
      })
      .slice(0, 5);
  }, [courses, courseVideosMap, progressMap, completedCourses, courseProgressData]);

  const newlyAssignedCourses = useMemo(() => {
    return [...courses]
      .sort(
        (a, b) =>
          new Date(b.assignment?.assignedAt || b.createdAt || 0) -
          new Date(a.assignment?.assignedAt || a.createdAt || 0)
      )
      .slice(0, 5);
  }, [courses]);

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
      .slice(0, 5);
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
              <div className="hero-stat-icon">
                <FaBookOpen />
              </div>
              <div>
                <strong>{totalCourses}</strong>
                <span>Total Courses</span>
              </div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-icon admins-icon">
                <FaClipboardCheck />
              </div>
              <div>
                <strong>{inProgressCount}</strong>
                <span>In Progress</span>
              </div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-icon dept-icon">
                <FaCheckCircle />
              </div>
              <div>
                <strong>{completedCount}</strong>
                <span>Completed</span>
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
        <div className="stat-card stat-courses">
          <div className="stat-card-icon">
            <FaBookOpen />
          </div>
          <div className="stat-card-info">
            <span>Total Courses</span>
            <strong>{totalCourses}</strong>
          </div>
        </div>
        <div className="stat-card stat-progress">
          <div className="stat-card-icon">
            <FaClipboardCheck />
          </div>
          {/* <div className="stat-card-info">
            <span>In Progress</span>
            <strong>{inProgressCount}</strong>
          </div>
        </div>
        <div className="stat-card stat-completed">
          <div className="stat-card-icon">
            <FaCheckCircle />
          </div> */}
          <div className="stat-card-info">
            <span>Completed</span>
            <strong>{completedCount}</strong>
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

      {continueLearningCourses.length > 0 && (
        <section className="continue-section">
          <div className="card-head">
            <div>
              <h2>Continue Learning</h2>
              <p>Pick up where you left off</p>
            </div>
            <Link to={`${basePath}/assigned-courses`}>View All</Link>
          </div>
          <div className="continue-courses-grid">
            {continueLearningCourses.map((course, i) => {
              const colors = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"];
              const letter = (course.title || course.courseTitle || "C").charAt(0).toUpperCase();
              const thumbnail = getCourseThumbnail(course);
              const progress = getCourseProgress(course.id);
              return (
                <Link to={`${basePath}/course/${course.id}`} className="continue-course-card" key={course.id}>
                  <div className="continue-course-thumb">
                    {thumbnail ? (
                      <img src={thumbnail} alt={course.title || course.courseTitle} />
                    ) : (
                      <div className="continue-course-placeholder" style={{ background: colors[i % colors.length] }}>
                        {letter}
                      </div>
                    )}
                    {hasNewVideos(course.id) && <span className="new-video-badge">NEW</span>}
                    <div className="continue-course-overlay">
                      <span className="continue-badge">Continue</span>
                    </div>
                  </div>
                  <div className="continue-course-info">
                    <h3>{course.title || course.courseTitle}</h3>
                    <span>{course.department || "Training"}</span>
                    <div className="continue-course-progress">
                      <div className="progress-bar">
                        <span style={{ width: `${progress}%` }}></span>
                      </div>
                      <strong>{progress}%</strong>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="newly-courses-section">
        <div className="card-head">
          <div>
            <h2>Courses Assigned to You</h2>
            <p>Your latest course assignments</p>
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
                    {hasNewVideos(course.id) && <span className="new-video-badge">NEW</span>}
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