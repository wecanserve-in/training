import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/assignedCourses.css";

function AssignedCourses() {
  const [courses, setCourses] = useState([]);
  const [courseVideosMap, setCourseVideosMap] = useState({});
  const [progressMap, setProgressMap] = useState({});
  const [completedCourses, setCompletedCourses] = useState({});
  const [results, setResults] = useState({});
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
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
          courseVideosSnap,
          videoLibrarySnap,
        ] = await Promise.all([
          get(ref(database, `userAssignments/${user.uid}`)),
          get(ref(database, `completedCourses/${user.uid}`)),
          get(ref(database, `results/${user.uid}`)),
          get(ref(database, `progress/${user.uid}`)),
          get(ref(database, "courses")),
          get(ref(database, "videos")),
          get(ref(database, "courseVideos")),
          get(ref(database, "videoLibrary")),
        ]);

        const completedData = completedSnap.exists() ? completedSnap.val() : {};
        const resultsData = resultsSnap.exists() ? resultsSnap.val() : {};
        const progressData = progressSnap.exists() ? progressSnap.val() : {};

        setCompletedCourses(completedData);
        setResults(resultsData);
        setProgressMap(progressData);

        if (!assignmentsSnap.exists() || !coursesSnap.exists()) {
          setCourses([]);
          setCourseVideosMap({});
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

        const oldVideos = videosSnap.exists()
          ? Object.entries(videosSnap.val()).map(([videoId, video]) => ({
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

        const videoMap = {};

        assignedCourses.forEach((course) => {
          const mappedVideos = courseVideosData?.[course.id]
            ? Object.entries(courseVideosData[course.id]).map(
              ([videoId, video]) => ({
                id: videoId,
                ...video,
              })
            )
            : [];

          if (mappedVideos.length > 0) {
            videoMap[course.id] = mappedVideos.sort(
              (a, b) => (a.order || 0) - (b.order || 0)
            );
            return;
          }

          if (Array.isArray(course.videoIds) && course.videoIds.length > 0) {
            videoMap[course.id] = course.videoIds
              .map((videoId) => libraryVideos.find((video) => video.id === videoId))
              .filter(Boolean);
            return;
          }

          videoMap[course.id] = oldVideos
            .filter((video) => video.courseId === course.id)
            .sort(
              (a, b) =>
                new Date(a.createdAt || 0).getTime() -
                new Date(b.createdAt || 0).getTime()
            );
        });

        assignedCourses.sort(
          (a, b) =>
            new Date(b.assignment?.assignedAt || b.createdAt || 0) -
            new Date(a.assignment?.assignedAt || a.createdAt || 0)
        );

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
    if (completedCourses?.[courseId]?.passed || completedCourses?.[courseId]?.completed) {
      return 100;
    }

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

  const getCourseThumbnail = (course) => {
    if (course.thumbnailUrl) return course.thumbnailUrl;
    if (course.courseThumbnail) return course.courseThumbnail;
    if (course.assignment?.courseThumbnail) return course.assignment.courseThumbnail;

    const videos = courseVideosMap[course.id] || [];
    const videoWithThumb = videos.find((video) => video.thumbnailUrl);

    return videoWithThumb?.thumbnailUrl || "";
  };

  const getCourseType = (course) => {
    const videos = courseVideosMap[course.id] || [];
    const firstType = videos.find((video) => video.metadata?.videoType)?.metadata?.videoType;

    return firstType || course.courseType || course.type || "Training";
  };

  const stats = useMemo(() => {
    return courses.reduce(
      (acc, course) => {
        const status = getCourseStatus(course.id);

        acc.total += 1;
        if (status === "completed") acc.completed += 1;
        if (status === "inProgress") acc.inProgress += 1;
        if (status === "notStarted") acc.notStarted += 1;

        return acc;
      },
      { total: 0, completed: 0, inProgress: 0, notStarted: 0 }
    );
  }, [courses, courseVideosMap, progressMap, completedCourses]);

  const typeOptions = useMemo(() => {
    return [...new Set(courses.map((course) => getCourseType(course)).filter(Boolean))];
  }, [courses, courseVideosMap]);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const status = getCourseStatus(course.id);
      const videos = courseVideosMap[course.id] || [];
      const type = getCourseType(course);

      const searchableText = [
        course.title,
        course.courseTitle,
        course.description,
        course.overview,
        course.department,
        course.courseDepartment,
        type,
        ...videos.map((video) => video.title),
        ...videos.map((video) => video.metadata?.organName),
        ...videos.map((video) => video.metadata?.genericName),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchSearch = searchableText.includes(search.toLowerCase());
      const matchStatus = activeFilter === "all" || activeFilter === status;
      const matchType = typeFilter ? type === typeFilter : true;

      return matchSearch && matchStatus && matchType;
    });
  }, [
    courses,
    search,
    activeFilter,
    typeFilter,
    courseVideosMap,
    progressMap,
    completedCourses,
  ]);

  if (loading) return <h2 className="assigned-loading">Loading Courses...</h2>;

  return (
    <div className="assigned-courses-page">
      <div className="assigned-topbar">
        <div>
          <span>Assigned Courses</span>
          <h1>My Courses</h1>
          <p>All your assigned trainings are listed here with progress and filters.</p>
        </div>

        <strong>{stats.total} Courses</strong>
      </div>

      <div className="assigned-stats-grid">
        <button
          className={`assigned-stat-card blue ${activeFilter === "all" ? "active" : ""}`}
          onClick={() => setActiveFilter("all")}
        >
          <h3>{stats.total}</h3>
          <p>All Courses</p>
        </button>

        <button
          className={`assigned-stat-card yellow ${activeFilter === "inProgress" ? "active" : ""
            }`}
          onClick={() => setActiveFilter("inProgress")}
        >
          <h3>{stats.inProgress}</h3>
          <p>In Progress</p>
        </button>

        <button
          className={`assigned-stat-card green ${activeFilter === "completed" ? "active" : ""
            }`}
          onClick={() => setActiveFilter("completed")}
        >
          <h3>{stats.completed}</h3>
          <p>Completed</p>
        </button>

        <button
          className={`assigned-stat-card red ${activeFilter === "notStarted" ? "active" : ""
            }`}
          onClick={() => setActiveFilter("notStarted")}
        >
          <h3>{stats.notStarted}</h3>
          <p>Not Started</p>
        </button>
      </div>

      <div className="assigned-filter-bar">
        <input
          placeholder="Search course, video, department, organ, product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="notStarted">Not Started</option>
          <option value="inProgress">In Progress</option>
          <option value="completed">Completed</option>
        </select>

        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="assigned-course-list">
        {filteredCourses.length === 0 ? (
          <div className="assigned-empty-card">
            <h3>No courses found</h3>
            <p>Try changing your search or filters.</p>
          </div>
        ) : (
          filteredCourses.map((course) => {
            const progress = getCourseProgress(course.id);
            const status = getCourseStatus(course.id);

            const thumbnail = getCourseThumbnail(course);
            const videos = courseVideosMap[course.id] || [];
            const type = getCourseType(course);

            const isPassed =
              results?.[course.id]?.passed || completedCourses?.[course.id]?.passed;

            const statusLabel =
              status === "completed"
                ? "Completed"
                : status === "inProgress"
                  ? "In Progress"
                  : "Not Started";

            return (
              <div className="assigned-course-row" key={course.id}>
                <div className="assigned-course-thumb">
                  {thumbnail ? (
                    <img src={thumbnail} alt={course.title || course.courseTitle} />
                  ) : (
                    <div>{(course.title || course.courseTitle || "C").charAt(0)}</div>
                  )}
                </div>

                <div className="assigned-course-content">
                  <div className="assigned-course-title-row">
                    <h2>{course.title || course.courseTitle}</h2>
                    <span className={`assigned-status-pill ${status}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <p>{course.description || course.overview || "Training course"}</p>

                  <div className="assigned-meta">
                    <span>{course.department || course.courseDepartment || "Training"}</span>
                    <span>{type}</span>
                    <span>{videos.length || course.totalVideos || 0} Videos</span>
                    <span>{course.totalQuestions || 0} Questions</span>
                    <span>Pass {course.passingScore || 70}%</span>
                  </div>

                  <div className="assigned-progress">
                    <div>
                      <span style={{ width: `${progress}%` }}></span>
                    </div>
                    <strong>{progress}%</strong>
                  </div>
                </div>
                <Link to={`/course/${course.id}`} className="assigned-action">
                  <button className={status === "completed" ? "view" : "continue"}>
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