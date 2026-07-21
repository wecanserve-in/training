import { useEffect, useMemo, useState } from "react";
import { ref, get } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { database, auth } from "../firebase";
import {
  coursePath,
  courseProgressForCoursePath,
  videoProgressForCoursePath,
  courseVideosForCoursePath,
  legacyCompletedCoursePath,
  legacyAttemptsPath,
  legacyResultsPath,
  quizAttemptsForCoursePath,
} from "../services/dbPaths";

import "../styles/courseDetails.css";

function CourseDetails() {
  const { id: courseId } = useParams();

  const navigate = useNavigate();
  const location = useLocation();

  const [course, setCourse] = useState(null);
  const [videos, setVideos] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [finalResult, setFinalResult] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Detect the current portal.
   *
   * Examples:
   * /super-admin/course/123
   * /admin/course/123
   * /department-admin/course/123
   * /course/123
   */
  const portalBasePath = useMemo(() => {
    if (location.pathname.startsWith("/super-admin")) {
      return "/super-admin";
    }

    if (location.pathname.startsWith("/admin")) {
      return "/admin";
    }

    if (location.pathname.startsWith("/department-admin")) {
      return "/department-admin";
    }

    return "";
  }, [location.pathname]);

  const assignedCoursesPath = portalBasePath
    ? `${portalBasePath}/assigned-courses`
    : "/assigned-courses";

  const getCourseVideoPath = (videoId) => {
    return portalBasePath
      ? `${portalBasePath}/course/${courseId}/video/${videoId}`
      : `/course/${courseId}/video/${videoId}`;
  };

  const getQuizPath = (mode = "") => {
    const baseQuizPath = portalBasePath
      ? `${portalBasePath}/quiz/${courseId}`
      : `/quiz/${courseId}`;

    return mode ? `${baseQuizPath}?mode=${mode}` : baseQuizPath;
  };

  useEffect(() => {
    let isMounted = true;

    const resetPageState = () => {
      setCourse(null);
      setVideos([]);
      setProgressMap({});
      setFinalResult(null);
      setLoading(true);
    };

    resetPageState();

    const loadCourseDetails = async (user) => {
      try {
        const [
          courseSnap,
          videoProgressSnap,
          courseProgressSnap,
          oldVideosSnap,
          courseVideosSnap,
          videoLibrarySnap,
          completedCourseSnap,
          attemptsSnap,
          resultsSnap,
          quizAttemptsSnap,
        ] = await Promise.all([
          get(ref(database, coursePath(courseId))),

          // Course-specific video progress only.
          get(
            ref(
              database,
              videoProgressForCoursePath(
                user.uid,
                courseId
              )
            )
          ),

          get(
            ref(
              database,
              courseProgressForCoursePath(
                user.uid,
                courseId
              )
            )
          ),

          get(ref(database, "videos")),

          // Only fetch this course's video mapping.
          get(
            ref(
              database,
              courseVideosForCoursePath(courseId)
            )
          ),

          get(ref(database, "videoLibrary")),

          get(
            ref(
              database,
              legacyCompletedCoursePath(
                user.uid,
                courseId
              )
            )
          ),

          get(
            ref(
              database,
              legacyAttemptsPath(user.uid)
            )
          ),

          get(
            ref(
              database,
              legacyResultsPath(user.uid)
            )
          ),

          // Already scoped to the current course.
          get(
            ref(
              database,
              quizAttemptsForCoursePath(
                user.uid,
                courseId
              )
            )
          ),
        ]);

        if (!isMounted) return;

        if (!courseSnap.exists()) {
          alert("Course not found");
          navigate(assignedCoursesPath, {
            replace: true,
          });
          return;
        }

        const courseData = {
          id: courseId,
          ...courseSnap.val(),
        };

        setCourse(courseData);

        /**
         * Progress now comes only from:
         *
         * videoProgress/{uid}/{courseId}/{videoId}
         *
         * We intentionally do not read:
         *
         * progress/{uid}/{videoId}
         *
         * because that legacy path shares a video's progress
         * between every course using that video.
         */
        const courseVideoProgress =
          videoProgressSnap.exists()
            ? videoProgressSnap.val()
            : {};

        setProgressMap(courseVideoProgress);

        const oldVideos = oldVideosSnap.exists()
          ? Object.entries(oldVideosSnap.val()).map(
              ([videoId, video]) => ({
                id: videoId,
                ...(video || {}),
              })
            )
          : [];

        const libraryVideos =
          videoLibrarySnap.exists()
            ? Object.entries(
                videoLibrarySnap.val()
              ).map(([videoId, video]) => ({
                id: videoId,
                ...(video || {}),
              }))
            : [];

        const courseVideosData =
          courseVideosSnap.exists()
            ? courseVideosSnap.val()
            : {};

        let finalVideos = [];

        /**
         * Primary structure:
         *
         * courseVideos/{courseId}/{mappingId}
         */
        if (
          courseVideosData &&
          typeof courseVideosData === "object"
        ) {
          finalVideos = Object.entries(
            courseVideosData
          ).map(([mappingId, mappedVideo]) => {
            const safeMappedVideo =
              mappedVideo &&
              typeof mappedVideo === "object"
                ? mappedVideo
                : {};

            const actualVideoId =
              safeMappedVideo.videoId || mappingId;

            return {
              id: actualVideoId,
              mappingId,
              ...safeMappedVideo,
              courseId,
            };
          });
        } else if (
          Array.isArray(courseData.videoIds) &&
          courseData.videoIds.length > 0
        ) {
          /**
           * Fallback for courses that store a videoIds array.
           */
          finalVideos = courseData.videoIds
            .map((videoId, index) => {
              const libraryVideo =
                libraryVideos.find(
                  (video) => video.id === videoId
                );

              const oldVideo = oldVideos.find(
                (video) => video.id === videoId
              );

              const matchedVideo =
                libraryVideo || oldVideo;

              if (!matchedVideo) return null;

              return {
                ...matchedVideo,
                id: videoId,
                mappingId: videoId,
                order:
                  matchedVideo.order ?? index,
                courseId,
              };
            })
            .filter(Boolean);
        } else {
          /**
           * Legacy fallback:
           * videos/{videoId}.courseId
           */
          finalVideos = oldVideos
            .filter(
              (video) =>
                video.courseId === courseId
            )
            .map((video) => ({
              ...video,
              mappingId:
                video.mappingId || video.id,
              courseId,
            }));
        }

        /**
         * Hydrate mapped course-video records using the
         * full video library or legacy videos collection.
         */
        finalVideos = finalVideos
          .map((mappedVideo) => {
            const actualVideoId =
              mappedVideo.videoId ||
              mappedVideo.id;

            const fullLibraryVideo =
              libraryVideos.find(
                (item) =>
                  item.id === actualVideoId
              ) || {};

            const fullOldVideo =
              oldVideos.find(
                (item) =>
                  item.id === actualVideoId
              ) || {};

            return {
              ...fullOldVideo,
              ...fullLibraryVideo,
              ...mappedVideo,
              id: actualVideoId,
              mappingId:
                mappedVideo.mappingId ||
                actualVideoId,
              courseId,
            };
          })
          .sort(
            (a, b) =>
              Number(a.order || 0) -
                Number(b.order || 0) ||
              new Date(a.createdAt || 0) -
                new Date(b.createdAt || 0)
          );

        setVideos(finalVideos);

        const completedRecord =
          completedCourseSnap.exists()
            ? completedCourseSnap.val()
            : null;

        const courseProgressRecord =
          courseProgressSnap.exists()
            ? courseProgressSnap.val()
            : null;

        const attemptsData =
          attemptsSnap.exists()
            ? attemptsSnap.val()
            : {};

        const resultsData =
          resultsSnap.exists()
            ? resultsSnap.val()
            : {};

        /**
         * This snapshot is already:
         *
         * quizAttempts/{uid}/{courseId}
         *
         * Therefore, do not use quizAttemptsData[courseId].
         */
        const courseQuizAttempts =
          quizAttemptsSnap.exists()
            ? quizAttemptsSnap.val()
            : {};

        const allFinalRecords = [
          ...Object.entries(
            attemptsData || {}
          ).map(([attemptId, item]) => ({
            id: attemptId,
            source: "attempts",
            ...(item || {}),
          })),

          ...Object.entries(
            resultsData || {}
          ).map(([resultId, item]) => ({
            id: resultId,
            source: "results",
            ...(item || {}),
          })),
        ].filter((item) => {
          const belongsToCourse =
            item.courseId === courseId;

          const isFinalAttempt =
            !item.videoId &&
            item.quizType !== "practice";

          return (
            belongsToCourse && isFinalAttempt
          );
        });

        Object.entries(
          courseQuizAttempts || {}
        ).forEach(([quizId, attempt]) => {
          if (
            !attempt ||
            typeof attempt !== "object"
          ) {
            return;
          }

          const isFinalAttempt =
            attempt.quizType === "final" ||
            (!attempt.videoId &&
              attempt.quizType !== "practice");

          if (isFinalAttempt) {
            allFinalRecords.push({
              id: quizId,
              source: "quizAttempts",
              ...attempt,
            });
          }
        });

        const latestPassedRecord =
          allFinalRecords
            .filter(
              (item) =>
                item.passed === true ||
                item.isPassed === true ||
                String(
                  item.status || ""
                ).toLowerCase() === "passed"
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
            )[0] || null;

        const coursePassed =
          Boolean(completedRecord) ||
          Boolean(
            courseProgressRecord?.courseTestPassed
          ) ||
          Boolean(
            courseProgressRecord?.passed
          ) ||
          Boolean(latestPassedRecord);

        if (coursePassed) {
          const source =
            latestPassedRecord ||
            completedRecord ||
            courseProgressRecord ||
            {};

          const rawScore = Number(
            source.score ??
              source.percentage ??
              source.correct ??
              0
          );

          const total = Number(
            source.total ??
              source.totalMarks ??
              source.totalQuestions ??
              0
          );

          const percentage =
            total > 0 && rawScore <= total
              ? Math.round(
                  (rawScore / total) * 100
                )
              : Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(rawScore)
                  )
                );

          setFinalResult({
            passed: true,
            score: rawScore,
            total,
            percentage,
            submittedAt:
              source.submittedAt ||
              source.attemptedAt ||
              source.completedAt ||
              source.createdAt ||
              "",
          });
        } else {
          setFinalResult(null);
        }
      } catch (error) {
        console.error(
          "Failed to load course details:",
          error
        );

        if (isMounted) {
          alert("Failed to load course");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (!user) {
          navigate("/", {
            replace: true,
          });
          return;
        }

        loadCourseDetails(user);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [
    courseId,
    navigate,
    assignedCoursesPath,
  ]);

  const getVideoProgress = (video) => {
    return progressMap?.[video.id] || null;
  };

  const isVideoComplete = (video) => {
    const progress = getVideoProgress(video);

    return Boolean(
      progress?.completed ||
        Number(
          progress?.watchedPercent || 0
        ) >= 100
    );
  };

  const completedCount = useMemo(() => {
    return videos.filter((video) => {
      const progress =
        progressMap?.[video.id];

      return Boolean(
        progress?.completed ||
          Number(
            progress?.watchedPercent || 0
          ) >= 100
      );
    }).length;
  }, [videos, progressMap]);

  const overallWatchedPercent = useMemo(() => {
    if (videos.length === 0) {
      return 0;
    }

    const totalProgress = videos.reduce(
      (sum, video) => {
        const progress =
          progressMap?.[video.id];

        if (
          progress?.completed ||
          Number(
            progress?.watchedPercent || 0
          ) >= 100
        ) {
          return sum + 100;
        }

        return (
          sum +
          Math.max(
            0,
            Math.min(
              100,
              Number(
                progress?.watchedPercent || 0
              )
            )
          )
        );
      },
      0
    );

    return Math.round(
      totalProgress / videos.length
    );
  }, [videos, progressMap]);

  /**
   * Find the first unfinished lesson.
   *
   * Every video up to and including this index
   * is accessible. Videos after it stay locked.
   *
   * When every lesson is complete, all videos
   * remain accessible for review.
   */
  const firstIncompleteIndex =
    useMemo(() => {
      return videos.findIndex((video) => {
        const progress =
          progressMap?.[video.id];

        return !(
          progress?.completed ||
          Number(
            progress?.watchedPercent || 0
          ) >= 100
        );
      });
    }, [videos, progressMap]);

  const lastUnlockedIndex =
    firstIncompleteIndex === -1
      ? videos.length - 1
      : firstIncompleteIndex;

  const getThumbnail = (video) =>
    video.thumbnailUrl ||
    video.thumbnail ||
    video.imageUrl ||
    video.coverImage ||
    video.courseThumbnail ||
    "";

  const courseTitle =
    course?.title ||
    course?.courseTitle ||
    "";

  const courseDescription =
    course?.description ||
    course?.courseDescription ||
    course?.overview ||
    "";

  const passingScore =
    course?.passingScore ??
    course?.passPercentage ??
    course?.minimumPassingScore ??
    "";

  const allVideosCompleted =
    videos.length > 0 &&
    completedCount === videos.length;

  if (loading) {
    return (
      <h2 className="course-loading">
        Loading course...
      </h2>
    );
  }

  if (!course) {
    return (
      <h2 className="course-loading">
        Course not found
      </h2>
    );
  }

  return (
    <div className="course-detail-page">
      <button
        type="button"
        className="course-back-btn"
        onClick={() =>
          navigate(assignedCoursesPath)
        }
      >
        ← Back to My Courses
      </button>

      <section className="course-hero">
        <div>
          <p className="course-label">
            Course Overview
          </p>

          <h1>{courseTitle}</h1>

          {courseDescription && (
            <p className="course-desc">
              {courseDescription}
            </p>
          )}

          <div className="course-meta">
            <span>
              {videos.length} Videos
            </span>

            <span>
              {overallWatchedPercent}% Watched
            </span>

            {completedCount > 0 && (
              <span>
                {completedCount}/{videos.length}{" "}
                Completed
              </span>
            )}

            {passingScore !== "" && (
              <span>
                {passingScore}% Passing Score
              </span>
            )}

            {finalResult?.passed && (
              <span>
                ✓ Course Passed
              </span>
            )}
          </div>
        </div>

        <div className="course-progress-box">
          <strong>
            {overallWatchedPercent}%
          </strong>
          <span>Your Progress</span>
        </div>
      </section>

      <section className="course-content">
        <div className="course-section-title">
          <h2>Course Videos</h2>
          <p>
            Complete each video to unlock the
            next one.
          </p>
        </div>

        <div className="video-list">
          {videos.length === 0 ? (
            <p className="empty-text">
              No videos added yet.
            </p>
          ) : (
            videos.map((video, index) => {
              const videoProgress =
                getVideoProgress(video);

              const isCompleted =
                isVideoComplete(video);

              const videoWatched =
                isCompleted
                  ? 100
                  : Math.max(
                      0,
                      Math.min(
                        100,
                        Number(
                          videoProgress?.watchedPercent ||
                            0
                        )
                      )
                    );

              const isUnlocked =
                index <= lastUnlockedIndex;

              const thumbnail =
                getThumbnail(video);

              return (
                <div
                  key={
                    video.mappingId ||
                    video.id
                  }
                  className={`video-row ${
                    !isUnlocked ? "locked" : ""
                  }`}
                >
                  <div className="video-thumb">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={
                          video.title ||
                          video.videoTitle ||
                          `Video ${index + 1}`
                        }
                      />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>

                  <div className="video-info">
                    <h3>
                      {video.title ||
                        video.videoTitle ||
                        `Video ${index + 1}`}
                    </h3>

                    {(video.description ||
                      video.videoDescription) && (
                      <p>
                        {video.description ||
                          video.videoDescription}
                      </p>
                    )}

                    {videoWatched > 0 &&
                      videoWatched < 100 && (
                        <div className="video-progress-bar">
                          <div className="video-progress-track">
                            <div
                              className="video-progress-fill"
                              style={{
                                width: `${videoWatched}%`,
                              }}
                            />
                          </div>

                          <span>
                            {videoWatched}%
                          </span>
                        </div>
                      )}

                    <div className="video-status">
                      {isCompleted
                        ? "Completed"
                        : videoWatched > 0
                          ? `${videoWatched}% Watched`
                          : isUnlocked
                            ? "Available"
                            : "Locked"}
                    </div>
                  </div>

                  {isUnlocked ? (
                    <Link
                      to={getCourseVideoPath(
                        video.id
                      )}
                    >
                      <button
                        type="button"
                        className="start-btn"
                      >
                        {isCompleted
                          ? "Review"
                          : videoWatched > 0
                            ? "Continue"
                            : "Start Learning"}
                      </button>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="locked-btn"
                      disabled
                    >
                      Locked
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {allVideosCompleted && (
          <div
            className={`course-final-test-card ${
              finalResult?.passed
                ? "course-final-test-passed"
                : ""
            }`}
          >
            {finalResult?.passed ? (
              <>
                <div className="course-complete-icon">
                  ✓
                </div>

                <div className="course-final-content">
                  <span className="course-complete-label">
                    Course Completed
                  </span>

                  <h2>
                    Course Successfully Completed
                  </h2>

                  <p>
                    Congratulations! You have
                    successfully passed the final
                    course test. This test cannot be
                    attempted again.
                  </p>

                  <div className="course-final-score-row">
                    <div className="course-final-score-box">
                      <strong>
                        {finalResult.percentage}%
                      </strong>
                      <span>Final Score</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="course-view-marks-btn"
                    onClick={() =>
                      navigate(
                        getQuizPath("result")
                      )
                    }
                  >
                    View Marks
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="course-final-content">
                  <span className="course-complete-label">
                    Final Assessment
                  </span>

                  <h2>
                    Course Videos Completed
                  </h2>

                  <p>
                    You have completed all course
                    videos. You can now take the
                    final course test.
                  </p>

                  <Link to={getQuizPath()}>
                    <button
                      type="button"
                      className="course-start-test-btn"
                    >
                      Start Final Test
                    </button>
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default CourseDetails;