import { useEffect, useMemo, useState } from "react";
import { ref, get } from "firebase/database";
import { database, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, Link, useNavigate } from "react-router-dom";
import "../styles/courseDetails.css";

function CourseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [videos, setVideos] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [finalResult, setFinalResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/");
        return;
      }

      try {
        const [
          courseSnap,
          progressSnap,
          oldVideosSnap,
          courseVideosSnap,
          videoLibrarySnap,
          completedCourseSnap,
          attemptsSnap,
          resultsSnap,
        ] = await Promise.all([
          get(ref(database, `courses/${id}`)),
          get(ref(database, `progress/${user.uid}`)),
          get(ref(database, "videos")),
          get(ref(database, "courseVideos")),
          get(ref(database, "videoLibrary")),
          get(ref(database, `completedCourses/${user.uid}/${id}`)),
          get(ref(database, `attempts/${user.uid}`)),
          get(ref(database, `results/${user.uid}`)),
        ]);

        if (!courseSnap.exists()) {
          alert("Course not found");
          navigate("../assigned-courses");
          return;
        }

        const courseData = { id, ...courseSnap.val() };
        setCourse(courseData);

        const userProgress = progressSnap.exists() ? progressSnap.val() : {};
        setProgressMap(userProgress);

        const oldVideos = oldVideosSnap.exists()
          ? Object.entries(oldVideosSnap.val()).map(([videoId, video]) => ({
              id: videoId,
              ...video,
            }))
          : [];

        const libraryVideos = videoLibrarySnap.exists()
          ? Object.entries(videoLibrarySnap.val()).map(([videoId, video]) => ({
              id: videoId,
              ...video,
            }))
          : [];

        const courseVideosData = courseVideosSnap.exists()
          ? courseVideosSnap.val()
          : {};

        let finalVideos = [];

        if (courseVideosData?.[id]) {
          finalVideos = Object.entries(courseVideosData[id]).map(
            ([videoId, video]) => ({
              id: video.videoId || videoId,
              mappingId: videoId,
              ...video,
            })
          );
        } else if (
          Array.isArray(courseData.videoIds) &&
          courseData.videoIds.length > 0
        ) {
          finalVideos = courseData.videoIds
            .map((videoId) =>
              libraryVideos.find((video) => video.id === videoId)
            )
            .filter(Boolean);
        } else {
          finalVideos = oldVideos.filter((video) => video.courseId === id);
        }

        finalVideos = finalVideos
          .map((video) => {
            const fullLibraryVideo =
              libraryVideos.find((item) => item.id === video.id) ||
              libraryVideos.find((item) => item.id === video.videoId);

            const fullOldVideo =
              oldVideos.find((item) => item.id === video.id) ||
              oldVideos.find((item) => item.id === video.videoId);

            return {
              ...fullOldVideo,
              ...fullLibraryVideo,
              ...video,
              id: video.videoId || video.id,
            };
          })
          .sort(
            (a, b) =>
              Number(a.order || 0) - Number(b.order || 0) ||
              new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
          );

        setVideos(finalVideos);

        const completedRecord = completedCourseSnap.exists()
          ? completedCourseSnap.val()
          : null;

        const attemptsData = attemptsSnap.exists() ? attemptsSnap.val() : {};
        const resultsData = resultsSnap.exists() ? resultsSnap.val() : {};

        const allFinalRecords = [
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
        ].filter((item) => item.courseId === id && !item.videoId);

        const latestPassedRecord = allFinalRecords
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

        const coursePassed =
          Boolean(completedRecord) ||
          Boolean(latestPassedRecord);

        if (coursePassed) {
          const source = latestPassedRecord || completedRecord || {};
          const rawScore = Number(
            source.score ??
              source.percentage ??
              source.correct ??
              completedRecord?.score ??
              completedRecord?.percentage ??
              0
          );
          const total = Number(
            source.total ??
              source.totalQuestions ??
              completedRecord?.total ??
              completedRecord?.totalQuestions ??
              0
          );

          const percentage =
            total > 0 && rawScore <= total
              ? Math.round((rawScore / total) * 100)
              : Math.max(0, Math.min(100, Math.round(rawScore)));

          setFinalResult({
            passed: true,
            score: rawScore,
            total,
            percentage,
            submittedAt:
              source.submittedAt ||
              source.completedAt ||
              source.createdAt ||
              completedRecord?.completedAt ||
              completedRecord?.createdAt ||
              "",
          });
        } else {
          setFinalResult(null);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to load course");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [id, navigate]);

  const completedCount = useMemo(() => {
    return videos.filter((video) => progressMap?.[video.id]?.completed).length;
  }, [videos, progressMap]);

  const progressPercent = videos.length
    ? Math.round((completedCount / videos.length) * 100)
    : 0;

  const nextUnlockedIndex = completedCount;

  const getThumbnail = (video) =>
    video.thumbnailUrl ||
    video.thumbnail ||
    video.imageUrl ||
    video.coverImage ||
    video.courseThumbnail ||
    "";

  const courseTitle = course?.title || course?.courseTitle || "";

  const courseDescription =
    course?.description || course?.courseDescription || course?.overview || "";

  const passingScore =
    course?.passingScore ||
    course?.passPercentage ||
    course?.minimumPassingScore ||
    "";

  if (loading) {
    return <h2 className="course-loading">Loading course...</h2>;
  }

  return (
    <div className="course-detail-page">
      <button
        className="course-back-btn"
        onClick={() => navigate("../assigned-courses")}
      >
        ← Back to My Courses
      </button>

      <section className="course-hero">
        <div>
          <p className="course-label">Course Overview</p>
          <h1>{courseTitle}</h1>

          {courseDescription && (
            <p className="course-desc">{courseDescription}</p>
          )}

          <div className="course-meta">
            <span>{videos.length} Videos</span>
            <span>{progressPercent}% Completed</span>
            {passingScore && <span>{passingScore}% Passing Score</span>}
            {finalResult?.passed && <span>✓ Course Passed</span>}
          </div>
        </div>

        <div className="course-progress-box">
          <strong>{progressPercent}%</strong>
          <span>Your Progress</span>
        </div>
      </section>

      <section className="course-content">
        <div className="course-section-title">
          <h2>Course Videos</h2>
          <p>Complete each video to unlock the next one.</p>
        </div>

        <div className="video-list">
          {videos.length === 0 ? (
            <p className="empty-text">No videos added yet.</p>
          ) : (
            videos.map((video, index) => {
              const isCompleted = progressMap?.[video.id]?.completed;
              const isUnlocked = index <= nextUnlockedIndex;
              const thumbnail = getThumbnail(video);

              return (
                <div
                  key={video.id}
                  className={`video-row ${!isUnlocked ? "locked" : ""}`}
                >
                  <div className="video-thumb">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={video.title || "Video thumbnail"}
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

                    {(video.description || video.videoDescription) && (
                      <p>{video.description || video.videoDescription}</p>
                    )}

                    <div className="video-status">
                      {isCompleted
                        ? "Completed"
                        : isUnlocked
                          ? "Available"
                          : "Locked"}
                    </div>
                  </div>

                  {isUnlocked ? (
                    <Link to={`../video/${video.id}`}>
                      <button className="start-btn">
                        {isCompleted ? "Review" : "Start Learning"}
                      </button>
                    </Link>
                  ) : (
                    <button className="locked-btn" disabled>
                      Locked
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

       {progressPercent >= 100 && (
  <div
    className={`course-final-test-card ${
      finalResult?.passed ? "course-final-test-passed" : ""
    }`}
  >
    {finalResult?.passed ? (
      <>
        <div className="course-complete-icon">✓</div>

        <div className="course-final-content">
          <span className="course-complete-label">
            Course Completed
          </span>

          <h2>Course Successfully Completed</h2>

          <p>
            Congratulations! You have successfully passed the final
            course test. This test cannot be attempted again.
          </p>

          <div className="course-final-score-row">
            <div className="course-final-score-box">
              <strong>{finalResult.percentage}%</strong>
              <span>Final Score</span>
            </div>

          
          </div>

          <button
            type="button"
            className="course-view-marks-btn"
            onClick={() =>
              navigate(`../quiz/${course.id}?mode=result`)
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

          <h2>Course Videos Completed</h2>

          <p>
            You have completed all course videos. You can now take
            the final course test.
          </p>

          <Link to={`../quiz/${course.id}`}>
            <button className="course-start-test-btn">
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
