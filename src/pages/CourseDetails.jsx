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
        ] = await Promise.all([
          get(ref(database, `courses/${id}`)),
          get(ref(database, `progress/${user.uid}`)),
          get(ref(database, "videos")),
          get(ref(database, "courseVideos")),
          get(ref(database, "videoLibrary")),
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
        } else if (Array.isArray(courseData.videoIds) && courseData.videoIds.length > 0) {
          finalVideos = courseData.videoIds
            .map((videoId) => libraryVideos.find((video) => video.id === videoId))
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
          .sort((a, b) => {
            return (
              Number(a.order || 0) - Number(b.order || 0) ||
              new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
            );
          });

        setVideos(finalVideos);
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

  const getThumbnail = (video) => {
    return (
      video.thumbnailUrl ||
      video.thumbnail ||
      video.imageUrl ||
      video.coverImage ||
      video.courseThumbnail ||
      ""
    );
  };

  const courseTitle = course?.title || course?.courseTitle || "";

  const courseDescription =
    course?.description || course?.courseDescription || course?.overview || "";

  const passingScore =
    course?.passingScore || course?.passPercentage || course?.minimumPassingScore || "";

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

          {courseDescription && <p className="course-desc">{courseDescription}</p>}

          <div className="course-meta">
            <span>{videos.length} Videos</span>
            <span>{progressPercent}% Completed</span>
            {passingScore && <span>{passingScore}% Passing Score</span>}
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
                      <img src={thumbnail} alt={video.title || "Video thumbnail"} />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>

                  <div className="video-info">
                    <h3>{video.title || video.videoTitle || `Video ${index + 1}`}</h3>

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
  <div className="course-final-test-card">
    <h2>Course Videos Completed</h2>
    <p>You can now take the final course test.</p>

    <Link to={`../quiz/${course.id}`}>
      <button>Start Final Test</button>
    </Link>
  </div>
)}
      </section>
    </div>
  );
}

export default CourseDetails;