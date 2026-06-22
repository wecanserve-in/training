import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/dashboard.css";

function AssignedCourses() {
  const [courses, setCourses] = useState([]);
  const [courseVideosMap, setCourseVideosMap] = useState({});
  const [progressMap, setProgressMap] = useState({});
  const [completedCourses, setCompletedCourses] = useState({});
  const [results, setResults] = useState({});
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        const [
          assignmentsSnap,
          completedSnap,
          resultsSnap,
          progressSnap,
          coursesSnap,
          videosSnap,
        ] = await Promise.all([
          get(ref(database, `userAssignments/${user.uid}`)),
          get(ref(database, `completedCourses/${user.uid}`)),
          get(ref(database, `results/${user.uid}`)),
          get(ref(database, `progress/${user.uid}`)),
          get(ref(database, "courses")),
          get(ref(database, "videos")),
        ]);

        setCompletedCourses(completedSnap.exists() ? completedSnap.val() : {});
        setResults(resultsSnap.exists() ? resultsSnap.val() : {});
        setProgressMap(progressSnap.exists() ? progressSnap.val() : {});

        if (!assignmentsSnap.exists() || !coursesSnap.exists()) {
          setCourses([]);
          setCourseVideosMap({});
          setLoading(false);
          return;
        }

        const assignments = assignmentsSnap.val();
        const allCourses = coursesSnap.val();

        const assignedIds = Object.keys(assignments).filter(
          (id) => assignments[id]?.assigned
        );

        const assignedCourses = assignedIds
          .map((id) => ({
            id,
            ...allCourses[id],
            assignment: assignments[id],
          }))
          .filter((course) => course.title || course.courseTitle);

        const allVideos = videosSnap.exists()
          ? Object.entries(videosSnap.val()).map(([videoId, video]) => ({
              id: videoId,
              ...video,
            }))
          : [];

        const videoMap = {};

        assignedCourses.forEach((course) => {
          videoMap[course.id] = allVideos
            .filter((video) => video.courseId === course.id)
            .sort(
              (a, b) =>
                new Date(a.createdAt || 0).getTime() -
                new Date(b.createdAt || 0).getTime()
            );
        });

        setCourses(assignedCourses);
        setCourseVideosMap(videoMap);
      } catch (error) {
        console.error(error);
        alert("Failed to load assigned courses");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const getCourseProgress = (courseId) => {
    if (completedCourses?.[courseId]) return 100;

    const videos = courseVideosMap[courseId] || [];

    if (videos.length === 0) return 0;

    const totalProgress = videos.reduce((sum, video) => {
      const progress = progressMap?.[video.id];

      if (progress?.completed) return sum + 100;

      return sum + Number(progress?.watchedPercent || 0);
    }, 0);

    return Math.round(totalProgress / videos.length);
  };

  const getCourseStatus = (courseId) => {
    const progress = getCourseProgress(courseId);

    if (progress >= 100) return "completed";
    if (progress > 0) return "inProgress";
    return "notStarted";
  };

  const getNextVideoId = (courseId) => {
    const videos = courseVideosMap[courseId] || [];

    if (videos.length === 0) return null;

    const incompleteVideo = videos.find(
      (video) => !progressMap?.[video.id]?.completed
    );

    return incompleteVideo?.id || videos[0]?.id || null;
  };

  const completedCount = useMemo(() => {
    return courses.filter((course) => getCourseStatus(course.id) === "completed")
      .length;
  }, [courses, courseVideosMap, progressMap, completedCourses]);

  const inProgressCount = useMemo(() => {
    return courses.filter((course) => getCourseStatus(course.id) === "inProgress")
      .length;
  }, [courses, courseVideosMap, progressMap, completedCourses]);

  const notStartedCount = useMemo(() => {
    return courses.filter((course) => getCourseStatus(course.id) === "notStarted")
      .length;
  }, [courses, courseVideosMap, progressMap, completedCourses]);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const status = getCourseStatus(course.id);

      const searchableText = `${course.title || course.courseTitle || ""} ${
        course.department || course.courseDepartment || ""
      }`.toLowerCase();

      const matchSearch = searchableText.includes(search.toLowerCase());

      const matchFilter = activeFilter === "all" || activeFilter === status;

      return matchSearch && matchFilter;
    });
  }, [
    courses,
    search,
    activeFilter,
    courseVideosMap,
    progressMap,
    completedCourses,
  ]);

  if (loading) return <h2 className="dashboard-loading">Loading Courses...</h2>;

  return (
    <div className="my-courses-page">
      <div className="my-courses-top">
        <div>
          <h1>My Courses</h1>
          <p>View and continue all trainings assigned to you.</p>
        </div>
      </div>

      <div className="course-filter-bar">
        <button
          className={activeFilter === "all" ? "active" : ""}
          onClick={() => setActiveFilter("all")}
        >
          All ({courses.length})
        </button>

        <button
          className={activeFilter === "inProgress" ? "active" : ""}
          onClick={() => setActiveFilter("inProgress")}
        >
          In Progress ({inProgressCount})
        </button>

        <button
          className={activeFilter === "completed" ? "active" : ""}
          onClick={() => setActiveFilter("completed")}
        >
          Completed ({completedCount})
        </button>

        <button
          className={activeFilter === "notStarted" ? "active" : ""}
          onClick={() => setActiveFilter("notStarted")}
        >
          Not Started ({notStartedCount})
        </button>

        <input
          placeholder="Search course..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="my-course-list">
        {filteredCourses.length === 0 ? (
          <p className="no-data-msg">No courses found.</p>
        ) : (
          filteredCourses.map((course) => {
            const progress = getCourseProgress(course.id);
            const status = getCourseStatus(course.id);
            const nextVideoId = getNextVideoId(course.id);
            const isPassed =
              results?.[course.id]?.passed || completedCourses?.[course.id]?.passed;

            const statusLabel =
              status === "completed"
                ? "Completed"
                : status === "inProgress"
                ? "In Progress"
                : "Not Started";

            return (
              <div className="my-course-row" key={course.id}>
                <div className="my-course-left">
                  <div className="my-course-icon">
                    {(course.title || course.courseTitle || "C")
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>
                    <h2>{course.title || course.courseTitle}</h2>
                    <p>
                      {course.department ||
                        course.courseDepartment ||
                        "Training"}
                    </p>
                  </div>
                </div>

                <div className="my-course-progress">
                  <div className="my-course-progress-bar">
                    <span style={{ width: `${progress}%` }}></span>
                  </div>

                  <strong>{progress}%</strong>
                </div>

                <div
                  className={`my-course-status ${
                    status === "completed" ? "completed" : "progress"
                  }`}
                >
                  {statusLabel}
                </div>

                <Link
                  to={
                    nextVideoId && progress < 100
                      ? `/video/${nextVideoId}`
                      : `/course/${course.id}`
                  }
                >
                  <button
                    className={status === "completed" ? "view-btn" : "continue-btn"}
                  >
                    {status === "completed"
                      ? isPassed
                        ? "View"
                        : "Review"
                      : status === "notStarted"
                      ? "Start Now"
                      : "Continue"}
                  </button>
                </Link>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default AssignedCourses;