import { useEffect, useMemo, useState } from "react";
import { ref, get } from "firebase/database";
import { database, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, Link, useNavigate } from "react-router-dom";
import "../styles/dashboard.css";

function CourseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [videos, setVideos] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [completedCourse, setCompletedCourse] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/");
        return;
      }

      try {
        const courseSnapshot = await get(ref(database, `courses/${id}`));

        if (!courseSnapshot.exists()) {
          alert("Course not found");
          navigate("/dashboard");
          return;
        }

        setCourse({
          id,
          ...courseSnapshot.val(),
        });

        const [videosSnapshot, progressSnapshot, completedSnapshot] =
          await Promise.all([
            get(ref(database, "videos")),
            get(ref(database, `progress/${user.uid}`)),
            get(ref(database, `completedCourses/${user.uid}/${id}`)),
          ]);

        if (progressSnapshot.exists()) {
          setProgressMap(progressSnapshot.val());
        }

        if (completedSnapshot.exists()) {
          setCompletedCourse(completedSnapshot.val());
        }

        if (videosSnapshot.exists()) {
          const data = videosSnapshot.val();

          const courseVideos = Object.keys(data)
            .map((key) => ({
              id: key,
              ...data[key],
            }))
            .filter((video) => video.courseId === id)
            .sort(
              (a, b) =>
                new Date(a.createdAt || 0).getTime() -
                new Date(b.createdAt || 0).getTime()
            );

          setVideos(courseVideos);
        } else {
          setVideos([]);
        }
      } catch (error) {
        console.error(error);
        alert("Failed to load course");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [id, navigate]);

  const completedVideoCount = useMemo(() => {
    if (completedCourse) return videos.length;

    return videos.filter((video) => progressMap?.[video.id]?.completed).length;
  }, [videos, progressMap, completedCourse]);

  const progressPercent = useMemo(() => {
    if (videos.length === 0) return 0;
    return Math.round((completedVideoCount / videos.length) * 100);
  }, [completedVideoCount, videos]);

  const courseStatus = useMemo(() => {
    if (progressPercent >= 100) return "Completed";
    if (progressPercent > 0) return "In Progress";
    return "Not Started";
  }, [progressPercent]);

  const firstVideo = useMemo(() => {
    const incompleteVideo = videos.find(
      (video) => !progressMap?.[video.id]?.completed
    );

    return incompleteVideo || videos[0];
  }, [videos, progressMap]);

  const passingScore = useMemo(() => {
    return videos[0]?.passingScore || course?.passingScore || 70;
  }, [videos, course]);

  const durationText = useMemo(() => {
    if (course?.duration) return course.duration;
    return `${videos.length || 0} Lessons`;
  }, [course, videos]);

  const courseDescription =
    course?.description ||
    course?.courseDescription ||
    "This course includes structured video lessons created by the training team.";

  const getVideoThumbnail = (video) => {
    return (
      video.thumbnailUrl ||
      video.thumbnail ||
      video.imageUrl ||
      video.coverImage ||
      video.videoThumbnail ||
      ""
    );
  };

  if (loading) {
    return <h2 className="dashboard-loading">Loading Course...</h2>;
  }

  return (
    <div className="course-detail-new-page">
      <button
        type="button"
        onClick={() => navigate("/assigned-courses")}
        className="course-back-link"
      >
        Back to My Courses
      </button>

      <div className="course-detail-header-card">
        <div className="course-detail-icon">
          {(course?.title || course?.courseTitle || "C").charAt(0).toUpperCase()}
        </div>

        <div className="course-detail-title">
          <h1>{course?.title || course?.courseTitle}</h1>
          <p>
            {course?.department ||
              course?.courseDepartment ||
              "Training Course"}
          </p>
        </div>
      </div>

      <div className="course-detail-stats-card">
        <div>
          <span>Duration</span>
          <strong>{durationText}</strong>
        </div>

        <div>
          <span>Lessons</span>
          <strong>{videos.length}</strong>
        </div>

        <div>
          <span>Passing Score</span>
          <strong>{passingScore}%</strong>
        </div>

        <div>
          <span>Status</span>
          <strong>{courseStatus}</strong>
        </div>
      </div>

      <div className="course-tabs">
        <button
          className={activeTab === "overview" ? "active" : ""}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>

        <button
          className={activeTab === "lessons" ? "active" : ""}
          onClick={() => setActiveTab("lessons")}
        >
          Lessons
        </button>

        <button
          className={activeTab === "resources" ? "active" : ""}
          onClick={() => setActiveTab("resources")}
        >
          Resources
        </button>

        <button
          className={activeTab === "quiz" ? "active" : ""}
          onClick={() => setActiveTab("quiz")}
        >
          Quiz
        </button>
      </div>

      <div className="course-detail-content-grid">
        <div className="course-detail-main-card">
          {activeTab === "overview" && (
            <>
              <h3>Course Description</h3>

              <p className="course-overview-text">{courseDescription}</p>

              <h3>Lessons Included</h3>

              <ul className="course-learn-list">
                {videos.length > 0 ? (
                  videos.map((video, index) => (
                    <li key={video.id}>
                      Lesson {index + 1}: {video.title || "Untitled Lesson"}
                    </li>
                  ))
                ) : (
                  <li>No lessons added yet.</li>
                )}
              </ul>
            </>
          )}

          {activeTab === "lessons" && (
            <div className="course-lesson-list">
              {videos.length === 0 ? (
                <p className="no-data-msg">No lessons added yet.</p>
              ) : (
                videos.map((video, index) => {
                  const thumbnail = getVideoThumbnail(video);

                  return (
                    <div className="course-lesson-row" key={video.id}>
                      <div className="lesson-thumbnail">
                        {thumbnail ? (
                          <img src={thumbnail} alt={video.title} />
                        ) : (
                          <span>{index + 1}</span>
                        )}
                      </div>

                      <div>
                        <h3>{video.title || "Untitled Lesson"}</h3>
                        <p>{video.description || "Video training module"}</p>
                      </div>

                      <Link to={`/video/${video.id}`}>
                        <button>
                          {progressMap?.[video.id]?.completed
                            ? "Review"
                            : "Start"}
                        </button>
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "resources" && (
            <p className="no-data-msg">
              Resources will be available if added by the training team.
            </p>
          )}

          {activeTab === "quiz" && (
            <div>
              <h3>Course Quiz</h3>
              <p className="course-overview-text">
                The quiz will unlock after completing all videos in this course.
              </p>
            </div>
          )}
        </div>

        <div className="course-progress-card">
          <h2>Your Progress</h2>

          <div
            className="course-progress-ring-new"
            style={{
              background: `conic-gradient(#06964f ${progressPercent}%, #edf1f5 0)`,
            }}
          >
            <div>
              <strong>{progressPercent}%</strong>
            </div>
          </div>

          <p>{courseStatus}</p>

          {firstVideo ? (
            <Link to={`/video/${firstVideo.id}`}>
              <button>
                {progressPercent >= 100 ? "Review Course" : "Continue Learning"}
              </button>
            </Link>
          ) : (
            <button disabled>No Lessons Available</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CourseDetails;