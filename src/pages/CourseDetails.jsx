import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { database } from "../firebase";
import { useParams, Link, useNavigate } from "react-router-dom";

function CourseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        const courseSnapshot = await get(
          ref(database, `courses/${id}`)
        );

        if (!courseSnapshot.exists()) {
          alert("Course not found");
          navigate("/dashboard");
          return;
        }

        setCourse(courseSnapshot.val());

        const videosSnapshot = await get(ref(database, "videos"));

        if (videosSnapshot.exists()) {
          const data = videosSnapshot.val();

          const videoArray = Object.keys(data)
            .map((key) => ({
              id: key,
              ...data[key],
            }))
            .filter((video) => video.courseId === id);

          setVideos(videoArray);
        }

        setLoading(false);
      } catch (error) {
        console.error(error);
        alert("Failed to load course");
        navigate("/dashboard");
      }
    };

    fetchCourseData();
  }, [id, navigate]);

  if (loading) {
    return <h2 style={{ padding: "30px" }}>Loading Course...</h2>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>{course?.title}</h1>

          <p
            style={{
              color: "#666",
              marginTop: "8px",
            }}
          >
            {course?.description}
          </p>

          <p
            style={{
              marginTop: "10px",
              fontWeight: "600",
            }}
          >
            Department: {course?.department}
          </p>
        </div>

        <button
          onClick={() => navigate("/dashboard")}
          className="btn-secondary"
        >
          Back
        </button>
      </div>

      <div className="course-section">
        <h2 className="section-title">
          Training Videos ({videos.length})
        </h2>

        {videos.length === 0 ? (
          <p className="no-data-msg">
            No videos added to this course yet.
          </p>
        ) : (
          <div className="horizontal-course-row">
            {videos.map((video) => (
              <div
                key={video.id}
                className="course-card"
              >
                <div className="course-thumbnail">
                  <video
                    src={video.videoUrl}
                    preload="metadata"
                    muted
                  />
                </div>

                <div className="course-content">
                  <div className="course-top">
                    <span className="course-tag">
                      Video Module
                    </span>
                  </div>

                  <h2>{video.title}</h2>

                  <p className="course-desc">
                    {video.description}
                  </p>

                  <div className="course-actions">
                    <Link to={`/video/${video.id}`}>
                      <button className="btn-action">
                        Start Training
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CourseDetails;