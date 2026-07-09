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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const getTime = (value) => {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  };

  const getCourseTitle = (course) => {
    return course?.title || course?.courseTitle || "Untitled Course";
  };

  const getCourseDescription = (course) => {
    return course?.description || course?.overview || "Training course";
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setCourses([]);
          setCourseVideosMap({});
          setLoading(false);
          return;
        }

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
          setLoading(false);
          return;
        }

        const assignments = assignmentsSnap.val();
        const allCourses = coursesSnap.val();

        const assignedIds = Object.keys(assignments).filter(
          (courseId) => assignments?.[courseId]?.assigned
        );

        const assignedCourses = assignedIds
          .map((courseId) => {
            const courseData = allCourses?.[courseId];

            if (!courseData) return null;

            return {
              id: courseId,
              ...courseData,
              assignment: assignments[courseId],
            };
          })
          .filter(Boolean)
          .filter((course) => getCourseTitle(course));

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
              (a, b) => Number(a.order || 0) - Number(b.order || 0)
            );
            return;
          }

          if (Array.isArray(course.videoIds) && course.videoIds.length > 0) {
            videoMap[course.id] = course.videoIds
              .map((videoId) =>
                libraryVideos.find(
                  (video) => String(video.id) === String(videoId)
                )
              )
              .filter(Boolean);
            return;
          }

          videoMap[course.id] = oldVideos
            .filter((video) => String(video.courseId || "") === String(course.id))
            .sort((a, b) => getTime(a.createdAt) - getTime(b.createdAt));
        });

        assignedCourses.sort(
          (a, b) =>
            getTime(b.assignment?.assignedAt || b.createdAt) -
            getTime(a.assignment?.assignedAt || a.createdAt)
        );

        setCourses(assignedCourses);
        setCourseVideosMap(videoMap);
      } catch (error) {
        console.error(error);
        alert("Failed to load assigned courses.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const getCourseProgress = (courseId) => {
    if (
      completedCourses?.[courseId]?.passed ||
      completedCourses?.[courseId]?.completed
    ) {
      return 100;
    }

    const videos = courseVideosMap?.[courseId] || [];

    if (videos.length > 0) {
      const totalProgress = videos.reduce((sum, video) => {
        const progress = progressMap?.[video.id];

        if (progress?.completed) return sum + 100;

        return sum + Number(progress?.watchedPercent || 0);
      }, 0);

      return Math.max(0, Math.min(100, Math.round(totalProgress / videos.length)));
    }

    const courseProgressItems = Object.values(progressMap || {}).filter(
      (item) => String(item?.courseId || "") === String(courseId)
    );

    if (courseProgressItems.length === 0) return 0;

    const total = courseProgressItems.reduce((sum, item) => {
      if (item?.completed) return sum + 100;
      return sum + Number(item?.watchedPercent || 0);
    }, 0);

    return Math.max(
      0,
      Math.min(100, Math.round(total / courseProgressItems.length))
    );
  };

  const getCourseStatus = (courseId) => {
    const progress = getCourseProgress(courseId);

    if (progress >= 100) return "completed";
    if (progress > 0) return "inProgress";

    return "notStarted";
  };

  const getStatusLabel = (status) => {
    if (status === "completed") return "Completed";
    if (status === "inProgress") return "In Progress";
    return "Not Started";
  };

  const getCourseThumbnail = (course) => {
    if (course.thumbnailUrl) return course.thumbnailUrl;
    if (course.courseThumbnail) return course.courseThumbnail;
    if (course.assignment?.courseThumbnail) return course.assignment.courseThumbnail;

    const videos = courseVideosMap[course.id] || [];
    const videoWithThumb = videos.find(
      (video) => video.thumbnailUrl || video.thumbnailURL || video.thumbnail
    );

    return (
      videoWithThumb?.thumbnailUrl ||
      videoWithThumb?.thumbnailURL ||
      videoWithThumb?.thumbnail ||
      ""
    );
  };

  const getCourseType = (course) => {
    const videos = courseVideosMap[course.id] || [];

    const firstType = videos.find((video) => video.metadata?.videoType)?.metadata
      ?.videoType;

    return firstType || course.courseType || course.type || "Training";
  };

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

      const matchSearch = searchableText.includes(search.toLowerCase().trim());
      const matchStatus = statusFilter === "all" || statusFilter === status;
      const matchType = typeFilter ? type === typeFilter : true;

      return matchSearch && matchStatus && matchType;
    });
  }, [
    courses,
    search,
    statusFilter,
    typeFilter,
    courseVideosMap,
    progressMap,
    completedCourses,
  ]);

  if (loading) {
    return <h2 className="assigned-loading">Loading courses...</h2>;
  }

  return (
    <div className="assigned-courses-page">
      <div className="assigned-filter-bar">
        <input
          placeholder="Search your courses..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All Status</option>
          <option value="notStarted">Not Started</option>
          <option value="inProgress">In Progress</option>
          <option value="completed">Completed</option>
        </select>

        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        >
          <option value="">All Types</option>
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            setSearch("");
            setStatusFilter("all");
            setTypeFilter("");
          }}
        >
          Clear
        </button>
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

            const actionLabel =
              status === "completed"
                ? isPassed
                  ? "View Course"
                  : "Review Course"
                : status === "notStarted"
                ? "Start Course"
                : "Continue Course";

            return (
              <Link
                to={`/course/${course.id}`}
                className="assigned-course-row"
                key={course.id}
              >
                <div className="assigned-course-thumb">
                  {thumbnail ? (
                    <img src={thumbnail} alt={getCourseTitle(course)} />
                  ) : (
                    <div>{getCourseTitle(course).charAt(0)}</div>
                  )}
                </div>

                <div className="assigned-course-content">
                  <div className="assigned-course-title-row">
                    <h2>{getCourseTitle(course)}</h2>

                    <span className={`assigned-status-pill ${status}`}>
                      {getStatusLabel(status)}
                    </span>
                  </div>

                  <p>{getCourseDescription(course)}</p>

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

                <div className="assigned-action-text">
                  <span>{actionLabel}</span>
                  <b>→</b>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

export default AssignedCourses;