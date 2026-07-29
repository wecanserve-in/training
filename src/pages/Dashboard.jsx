import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import useBasePath from "../hooks/useBasePath";
import {
  isCompletedRecord,
} from "../utils/trainingAnalytics";
import "../styles/dashboard.css";

import {
  FaBookOpen,
  FaCheckCircle,
  FaCertificate,
  FaClipboardCheck,
  FaChartLine,
  FaPlayCircle,
  FaVideo,
  FaArrowRight,
} from "react-icons/fa";

function Dashboard() {
  const navigate = useNavigate();
  const basePath = useBasePath();

  const [courses, setCourses] = useState([]);
  const [courseVideosMap, setCourseVideosMap] = useState({});
  const [progressMap, setProgressMap] = useState({});
  const [courseVideoProgress, setCourseVideoProgress] = useState({});
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
          legacyProgressSnapshot,
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
          get(ref(database, `progress/${user.uid}`)),
        ]);

        if (userSnapshot.exists()) {
          setUserData({
            id: user.uid,
            email: user.email,
            ...userSnapshot.val(),
          });
        }

        const userResults = resultsSnapshot.exists()
          ? resultsSnapshot.val()
          : {};

        const userCompletedCourses = completedSnapshot.exists()
          ? completedSnapshot.val()
          : {};

        const rawCourseVideoProgress = videoProgressSnapshot.exists()
          ? videoProgressSnapshot.val()
          : {};

        setCourseVideoProgress(rawCourseVideoProgress);

        const mergedProgressMap = {};

        Object.values(rawCourseVideoProgress).forEach((courseVideos) => {
          if (!courseVideos || typeof courseVideos !== "object") return;

          Object.entries(courseVideos).forEach(([videoId, videoProgress]) => {
            const currentProgress = mergedProgressMap[videoId];
            const currentPercent = Number(currentProgress?.watchedPercent || 0);
            const newPercent = Number(videoProgress?.watchedPercent || 0);

            if (
              !currentProgress ||
              videoProgress?.completed ||
              newPercent > currentPercent
            ) {
              mergedProgressMap[videoId] = videoProgress;
            }
          });
        });

        if (legacyProgressSnapshot.exists()) {
          Object.entries(legacyProgressSnapshot.val()).forEach(
            ([videoId, progress]) => {
              if (!mergedProgressMap[videoId]) {
                mergedProgressMap[videoId] = progress;
              }
            }
          );
        }

        setResults(userResults);
        setCompletedCourses(userCompletedCourses);
        setProgressMap(mergedProgressMap);
        setQuizAttempts(
          quizAttemptsSnapshot.exists() ? quizAttemptsSnapshot.val() : {}
        );

        const userCourseProgress = courseProgressSnapshot.exists()
          ? courseProgressSnapshot.val()
          : {};

        setCourseProgressData(userCourseProgress);

        if (!assignmentsSnapshot.exists() || !coursesSnapshot.exists()) {
          setCourses([]);
          setCourseVideosMap({});
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
          ? Object.entries(videoLibrarySnapshot.val()).map(
              ([videoId, video]) => ({
                id: videoId,
                ...video,
              })
            )
          : [];

        const courseVideosData = courseVideosSnapshot.exists()
          ? courseVideosSnapshot.val()
          : {};

        const map = {};

        courseArray.forEach((course) => {
          const mappedVideos = courseVideosData?.[course.id]
            ? Object.entries(courseVideosData[course.id]).map(
                ([videoId, video]) => {
                  const libraryVideo = libraryVideos.find(
                    (item) => item.id === videoId
                  );

                  return {
                    id: videoId,
                    ...libraryVideo,
                    ...video,
                  };
                }
              )
            : [];

          if (mappedVideos.length > 0) {
            map[course.id] = mappedVideos.sort(
              (a, b) => Number(a.order || 0) - Number(b.order || 0)
            );
            return;
          }

          if (Array.isArray(course.videoIds) && course.videoIds.length > 0) {
            map[course.id] = course.videoIds
              .map((videoId, index) => {
                const video = libraryVideos.find(
                  (item) => item.id === videoId
                );

                return video
                  ? {
                      ...video,
                      order: video.order ?? index,
                    }
                  : null;
              })
              .filter(Boolean);
            return;
          }

          map[course.id] = [];
        });

        courseArray.sort(
          (a, b) =>
            new Date(
              b.assignment?.assignedAt || b.createdAt || 0
            ).getTime() -
            new Date(
              a.assignment?.assignedAt || a.createdAt || 0
            ).getTime()
        );

        setCourses(courseArray);
        setCourseVideosMap(map);
      } catch (error) {
        console.error("Dashboard load error:", error);
        alert("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const getVideoProgress = (courseId, videoId) => {
    return (
      courseVideoProgress?.[courseId]?.[videoId] ||
      progressMap?.[videoId] ||
      {}
    );
  };

  const getCourseProgress = (courseId) => {
    const courseVideos = courseVideosMap[courseId] || [];

    if (
      completedCourses?.[courseId]?.passed ||
      completedCourses?.[courseId]?.completed
    ) {
      return 100;
    }

    if (courseVideos.length > 0) {
      const total = courseVideos.reduce((sum, video) => {
        const videoProgress = getVideoProgress(courseId, video.id);

        if (videoProgress?.completed) {
          return sum + 100;
        }

        return sum + Number(videoProgress?.watchedPercent || 0);
      }, 0);

      const calculated = Math.min(
        100,
        Math.max(0, Math.round(total / courseVideos.length))
      );

      return calculated;
    }

    return 0;
  };

  const getCourseThumbnail = (course) => {
    if (course.thumbnailUrl) return course.thumbnailUrl;
    if (course.courseThumbnail) return course.courseThumbnail;
    if (course.assignment?.courseThumbnail) {
      return course.assignment.courseThumbnail;
    }

    const videos = courseVideosMap[course.id] || [];
    const videoWithThumbnail = videos.find(
      (video) => video.thumbnailUrl || video.thumbnail
    );

    return (
      videoWithThumbnail?.thumbnailUrl ||
      videoWithThumbnail?.thumbnail ||
      ""
    );
  };

  const getVideoThumbnail = (video, course) => {
    return (
      video.thumbnailUrl ||
      video.thumbnail ||
      video.imageUrl ||
      getCourseThumbnail(course)
    );
  };

  const getVideoTitle = (video) => {
    return (
      video.title ||
      video.videoTitle ||
      video.name ||
      video.lessonTitle ||
      "Training Video"
    );
  };

  const getVideoAddedTime = (video) => {
    return (
      video.addedAt ||
      video.createdAt ||
      video.updatedAt ||
      video.uploadedAt ||
      ""
    );
  };

  const hasNewVideos = (courseId) => {
    const lastAccessed = courseProgressData?.[courseId]?.lastAccessedAt;
    const assignmentDate = courses.find(
      (course) => course.id === courseId
    )?.assignment?.assignedAt;

    const comparisonDate = lastAccessed || assignmentDate;
    if (!comparisonDate) return false;

    return (courseVideosMap[courseId] || []).some((video) => {
      const addedAt = getVideoAddedTime(video);
      return (
        addedAt &&
        new Date(addedAt).getTime() >
          new Date(comparisonDate).getTime()
      );
    });
  };

  const totalCourses = courses.length;

  const completedCount = useMemo(() => {
    return courses.filter(
      (course) => getCourseProgress(course.id) >= 100
    ).length;
  }, [
    courses,
    courseVideosMap,
    progressMap,
    courseVideoProgress,
    completedCourses,
  ]);

  const inProgressCount = useMemo(() => {
    return courses.filter((course) => {
      const progress = getCourseProgress(course.id);
      return progress > 0 && progress < 100;
    }).length;
  }, [
    courses,
    courseVideosMap,
    progressMap,
    courseVideoProgress,
    completedCourses,
  ]);

  const passedCount = useMemo(() => {
    return courses.filter((course) => {
      const result = results?.[course.id];
      const completed = completedCourses?.[course.id];
      return result?.passed || completed?.passed;
    }).length;
  }, [courses, results, completedCourses]);

  const certificatesIssuedCount = useMemo(() => {
    let count = 0;
    const checked = new Set();
    const assignedIds = new Set(courses.map((c) => c.id));

    if (completedCourses && typeof completedCourses === "object") {
      Object.entries(completedCourses).forEach(([courseId, item]) => {
        if (!assignedIds.has(courseId)) return;
        if (item?.passed === true || item?.completed === true) {
          checked.add(courseId);
          count += 1;
        }
      });
    }

    if (courseProgressData && typeof courseProgressData === "object") {
      Object.entries(courseProgressData).forEach(([courseId, item]) => {
        if (!assignedIds.has(courseId)) return;
        if (!checked.has(courseId) && (item?.courseTestPassed === true || item?.passed === true)) {
          count += 1;
        }
      });
    }

    return count;
  }, [courses, completedCourses, courseProgressData]);

  const videosWatchedCount = useMemo(() => {
    let watched = 0;

    courses.forEach((course) => {
      const videos = courseVideosMap[course.id] || [];

      videos.forEach((video) => {
        const videoProgress = getVideoProgress(course.id, video.id);

        if (
          videoProgress?.completed ||
          Number(videoProgress?.watchedPercent || 0) >= 100
        ) {
          watched += 1;
        }
      });
    });

    return watched;
  }, [
    courses,
    courseVideosMap,
    courseVideoProgress,
    progressMap,
  ]);

  const finalTestsTaken = useMemo(() => {
    let count = 0;
    const counted = new Set();
    const assignedIds = new Set(courses.map((c) => c.id));

    Object.values(quizAttempts).forEach((attempts) => {
      if (!attempts || typeof attempts !== "object") return;
      Object.values(attempts).forEach((attempt) => {
        const cid = attempt?.courseId;
        if (
          (attempt?.quizType === "final" || attempt?.type === "final") &&
          assignedIds.has(cid) &&
          !counted.has(cid)
        ) {
          counted.add(cid);
          count += 1;
        }
      });
    });

    if (courseProgressData && typeof courseProgressData === "object") {
      Object.entries(courseProgressData).forEach(([courseId, item]) => {
        if (assignedIds.has(courseId) && !counted.has(courseId) && item?.courseTestPassed === true) {
          counted.add(courseId);
          count += 1;
        }
      });
    }

    return count;
  }, [courses, quizAttempts, courseProgressData]);

  const avgFinalScore = useMemo(() => {
    let total = 0;
    let count = 0;
    const counted = new Set();
    const assignedIds = new Set(courses.map((c) => c.id));

    Object.values(quizAttempts).forEach((attempts) => {
      if (!attempts || typeof attempts !== "object") return;

      Object.values(attempts).forEach((attempt) => {
        const isFinal =
          attempt?.quizType === "final" ||
          attempt?.type === "final";
        const cid = attempt?.courseId;

        if (isFinal && assignedIds.has(cid) && attempt?.percentage != null && !counted.has(cid)) {
          counted.add(cid);
          total += Number(attempt.percentage);
          count += 1;
        }
      });
    });

    if (courseProgressData && typeof courseProgressData === "object") {
      Object.entries(courseProgressData).forEach(([courseId, item]) => {
        if (assignedIds.has(courseId) && !counted.has(courseId) && item?.courseTestPassed === true && (item?.percentage != null || item?.score != null)) {
          counted.add(courseId);
          total += Number(item.percentage ?? item.score ?? 0);
          count += 1;
        }
      });
    }

    return count > 0 ? Math.round(total / count) : 0;
  }, [courses, quizAttempts, courseProgressData]);

  const newlyAddedVideos = useMemo(() => {
    const videos = [];

    courses.forEach((course) => {
      const lastAccessedAt =
        courseProgressData?.[course.id]?.lastAccessedAt;
      const assignedAt = course.assignment?.assignedAt;
      const comparisonDate = lastAccessedAt || assignedAt || "";

      (courseVideosMap[course.id] || []).forEach((video) => {
        const addedAt = getVideoAddedTime(video);

        if (!addedAt) return;

        const isNew =
          !comparisonDate ||
          new Date(addedAt).getTime() >
            new Date(comparisonDate).getTime();

        if (!isNew) return;

        videos.push({
          ...video,
          courseId: course.id,
          courseTitle:
            course.title || course.courseTitle || "Course",
          department: course.department || "Training",
          course,
          addedAt,
        });
      });
    });

    return videos
      .sort(
        (a, b) =>
          new Date(b.addedAt).getTime() -
          new Date(a.addedAt).getTime()
      )
      .slice(0, 6);
  }, [courses, courseVideosMap, courseProgressData]);

  const isCourseCompleted = (courseId) => {
    const completedCourse = completedCourses?.[courseId];
    if (isCompletedRecord(completedCourse)) return true;
    
    const savedCourseProgress = courseProgressData?.[courseId];
    return Boolean(
      savedCourseProgress?.courseTestPassed ||
      savedCourseProgress?.passed
    );
  };

  const newlyAssignedCourses = useMemo(() => {
    return courses
      .filter((course) => !isCourseCompleted(course.id))
      .sort(
        (a, b) =>
          new Date(
            b.assignment?.assignedAt || b.createdAt || 0
          ).getTime() -
          new Date(
            a.assignment?.assignedAt || a.createdAt || 0
          ).getTime()
      )
      .slice(0, 5);
  }, [
    courses,
    courseVideosMap,
    progressMap,
    courseVideoProgress,
    completedCourses,
    courseProgressData,
    results,
  ]);

  const recentlyCompletedCourses = useMemo(() => {
    return courses
      .filter((course) => isCourseCompleted(course.id))
      .sort((a, b) => {
        const aDate =
          courseProgressData[a.id]?.completedAt ||
          completedCourses?.[a.id]?.completedAt ||
          "";

        const bDate =
          courseProgressData[b.id]?.completedAt ||
          completedCourses?.[b.id]?.completedAt ||
          "";

        return (
          new Date(bDate).getTime() - new Date(aDate).getTime()
        );
      })
      .slice(0, 5);
  }, [
    courses,
    courseVideosMap,
    progressMap,
    courseVideoProgress,
    completedCourses,
    courseProgressData,
    results,
  ]);

  if (loading) {
    return (
      <h2 className="dashboard-loading">Loading Dashboard...</h2>
    );
  }

  return (
    <div className="super-dashboard">
      <section className="dash-hero">
        <div className="hero-content">
          <h1>Hi, {userData?.name || "Learner"}</h1>
          <p>
            Continue your assigned learning and keep your progress
            moving.
          </p>

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
                <strong>{certificatesIssuedCount}</strong>
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
        {/* <div className="stat-card stat-courses">
          <div className="stat-card-icon">
            <FaBookOpen />
          </div>
          <div className="stat-card-info">
            <span>Total Courses</span>
            <strong>{totalCourses}</strong>
          </div>
        </div> */}


        <div className="stat-card stat-completed">
          <div className="stat-card-icon">
            <FaCheckCircle />
          </div>
          <div className="stat-card-info">
            <span>Completed Courses</span>
            <strong>{completedCount}</strong>
          </div>
        </div>


        <div className="stat-card stat-watched">
          <div className="stat-card-icon">
            <FaPlayCircle />
          </div>
          <div className="stat-card-info">
            <span>Videos Watched</span>
            <strong>{videosWatchedCount}</strong>
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
            <span>Certificates Issued</span>
            <strong>{certificatesIssuedCount}</strong>
          </div>
        </div>
      </section>

      {/* <section className="new-videos-section">
        <div className="card-head">
          <div>
            <h2>New Videos Added</h2>
            <p>Latest videos added to your assigned courses</p>
          </div>
          <Link to={`${basePath}/assigned-courses`}>
            View Courses
          </Link>
        </div>

        <div className="new-videos-grid">
          {newlyAddedVideos.length === 0 ? (
            <div className="new-videos-empty">
              <FaVideo />
              <div>
                <h3>No new videos right now</h3>
                <p>
                  Newly added course videos will appear here.
                </p>
              </div>
            </div>
          ) : (
            newlyAddedVideos.map((video, index) => {
              const thumbnail = getVideoThumbnail(
                video,
                video.course
              );

              const colors = [
                "#f59e0b",
                "#10b981",
                "#8b5cf6",
                "#ec4899",
                "#0ea5e9",
                "#ef4444",
              ];

              return (
                <Link
                  to={`${basePath}/course/${video.courseId}`}
                  className="new-video-card"
                  key={`${video.courseId}-${video.id}`}
                >
                  <div className="new-video-thumbnail">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={getVideoTitle(video)}
                      />
                    ) : (
                      <div
                        className="new-video-placeholder"
                        style={{
                          background:
                            colors[index % colors.length],
                        }}
                      >
                        <FaPlayCircle />
                      </div>
                    )}

                    <span className="new-video-label">NEW</span>

                    <div className="new-video-play">
                      <FaPlayCircle />
                    </div>
                  </div>

                  <div className="new-video-content">
                    <span className="new-video-course-name">
                      {video.courseTitle}
                    </span>

                    <h3>{getVideoTitle(video)}</h3>

                    <div className="new-video-meta">
                      <span>{video.department}</span>
                      <span className="open-video-text">
                        Open Course <FaArrowRight />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section> */}

      <section className="newly-courses-section">
        <div className="card-head">
          <div>
            <h2>Courses Assigned to You</h2>
            <p>Your latest course assignments</p>
          </div>
          <Link to={`${basePath}/assigned-courses`}>
            View All
          </Link>
        </div>

        <div className="newly-courses-grid">
          {newlyAssignedCourses.length === 0 ? (
            <p className="empty-text">
              No courses assigned yet.
            </p>
          ) : (
            newlyAssignedCourses.map((course, index) => {
              const colors = [
                "#f59e0b",
                "#3b82f6",
                "#10b981",
                "#8b5cf6",
                "#ec4899",
              ];

              const letter = (
                course.title ||
                course.courseTitle ||
                "C"
              )
                .charAt(0)
                .toUpperCase();

              const thumbnail = getCourseThumbnail(course);
              const progress = getCourseProgress(course.id);

              return (
                <Link
                  to={`${basePath}/course/${course.id}`}
                  className="newly-course-card"
                  key={course.id}
                >
                  <div className="newly-course-thumb">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={
                          course.title || course.courseTitle
                        }
                      />
                    ) : (
                      <div
                        className="newly-course-placeholder"
                        style={{
                          background:
                            colors[index % colors.length],
                        }}
                      >
                        {letter}
                      </div>
                    )}

                    {hasNewVideos(course.id) && (
                      <span className="new-video-badge">
                        NEW VIDEO
                      </span>
                    )}
                  </div>

                  <div className="newly-course-info">
                    <h3>
                      {course.title || course.courseTitle}
                    </h3>

                    <span>
                      {course.department || "Training"}
                    </span>

                    <div className="newly-course-progress">
                      <div className="progress-bar">
                        <span
                          style={{ width: `${progress}%` }}
                        ></span>
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
            <Link to={`${basePath}/assigned-courses`}>
              View All
            </Link>
          </div>

          <div className="completed-courses-grid">
            {recentlyCompletedCourses.map(
              (course, index) => {
                const colors = [
                  "#10b981",
                  "#3b82f6",
                  "#8b5cf6",
                  "#f59e0b",
                  "#ec4899",
                ];

                const letter = (
                  course.title ||
                  course.courseTitle ||
                  "C"
                )
                  .charAt(0)
                  .toUpperCase();

                const thumbnail =
                  getCourseThumbnail(course);

                const completedAt =
                  courseProgressData[course.id]
                    ?.completedAt ||
                  completedCourses?.[course.id]
                    ?.completedAt ||
                  "";

                const score =
                  courseProgressData[course.id]?.score ??
                  courseProgressData[course.id]
                    ?.percentage ??
                  "";

                return (
                  <Link
                    to={`${basePath}/course/${course.id}`}
                    className="completed-course-card"
                    key={course.id}
                  >
                    <div className="completed-course-thumb">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={
                            course.title ||
                            course.courseTitle
                          }
                        />
                      ) : (
                        <div
                          className="completed-course-placeholder"
                          style={{
                            background:
                              colors[
                                index % colors.length
                              ],
                          }}
                        >
                          {letter}
                        </div>
                      )}

                      <div className="completed-check">
                        <FaCheckCircle />
                      </div>
                    </div>

                    <div className="completed-course-info">
                      <h3>
                        {course.title ||
                          course.courseTitle}
                      </h3>

                      <span>
                        {course.department || "Training"}
                      </span>

                      {completedAt && (
                        <span className="completed-date">
                          Completed{" "}
                          {new Date(
                            completedAt
                          ).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}

                      {score !== "" && (
                        <span className="completed-score">
                          Score: {Math.round(Number(score))}%
                        </span>
                      )}
                    </div>
                  </Link>
                );
              }
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default Dashboard;