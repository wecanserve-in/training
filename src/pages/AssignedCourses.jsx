import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import useBasePath from "../hooks/useBasePath";
import {
  getTime,
  getCourseTitle,
  getCourseThumbnail,
} from "../utils/trainingAnalytics";
import "../styles/assignedCourses.css";

import {
  FaBookOpen,
  FaClock,
  FaCheckCircle,
  FaCertificate,
} from "react-icons/fa";

function AssignedCourses() {
  const basePath = useBasePath();
  const [courses, setCourses] = useState([]);
  const [courseVideosMap, setCourseVideosMap] = useState({});
  const [progressMap, setProgressMap] = useState({});
  const [completedCourses, setCompletedCourses] = useState({});
  const [results, setResults] = useState({});

  const [courseProgressData, setCourseProgressData] = useState({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

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
          courseProgressSnap,
          videoProgressSnap,
          coursesSnap,
          videosSnap,
          courseVideosSnap,
          videoLibrarySnap,
        ] = await Promise.all([
          get(ref(database, `userAssignments/${user.uid}`)),
          get(ref(database, `completedCourses/${user.uid}`)),
          get(ref(database, `results/${user.uid}`)),
          get(ref(database, `courseProgress/${user.uid}`)),
          get(ref(database, `videoProgress/${user.uid}`)),
          get(ref(database, "courses")),
          get(ref(database, "videos")),
          get(ref(database, "courseVideos")),
          get(ref(database, "videoLibrary")),
        ]);

        const completedData = completedSnap.exists() ? completedSnap.val() : {};
        const resultsData = resultsSnap.exists() ? resultsSnap.val() : {};
        const newVideoProgress = videoProgressSnap.exists() ? videoProgressSnap.val() : {};
        const mergedProgressData = {};
        Object.values(newVideoProgress).forEach((courseVideos) => {
          if (courseVideos && typeof courseVideos === "object") {
            Object.entries(courseVideos).forEach(([videoId, videoProg]) => {
              mergedProgressData[videoId] = videoProg;
            });
          }
        });
        const legacyProgressSnap = await get(ref(database, `progress/${user.uid}`));
        if (legacyProgressSnap.exists()) {
          Object.entries(legacyProgressSnap.val()).forEach(([videoId, prog]) => {
            if (!mergedProgressData[videoId]) {
              mergedProgressData[videoId] = prog;
            }
          });
        }

        setCompletedCourses(completedData);
        setResults(resultsData);
        setProgressMap(mergedProgressData);

        const userCourseProgress = courseProgressSnap.exists() ? courseProgressSnap.val() : {};
        setCourseProgressData(userCourseProgress);

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
    const videos = courseVideosMap?.[courseId] || [];

    if (completedCourses?.[courseId]?.passed || completedCourses?.[courseId]?.completed) {
      return 100;
    }

    const cp = courseProgressData?.[courseId];
    if (
      cp?.completed === true ||
      cp?.passed === true ||
      cp?.courseTestPassed === true ||
      Number(cp?.progressPercentage ?? cp?.progress ?? 0) >= 100
    ) {
      return 100;
    }

    if (videos.length > 0) {
      const totalProgress = videos.reduce((sum, video) => {
        const progress = progressMap?.[video.id];
        if (progress?.completed) return sum + 100;
        return sum + Number(progress?.watchedPercent || 0);
      }, 0);
      const calculated = Math.max(0, Math.min(100, Math.round(totalProgress / videos.length)));

      return calculated;
    }

    const courseProgressItems = Object.values(progressMap || {}).filter(
      (item) => String(item?.courseId || "") === String(courseId)
    );

    if (courseProgressItems.length === 0) return 0;

    const total = courseProgressItems.reduce((sum, item) => {
      if (item?.completed) return sum + 100;
      return sum + Number(item?.watchedPercent || 0);
    }, 0);

    return Math.max(0, Math.min(100, Math.round(total / courseProgressItems.length)));
  };

  const getCourseStatus = (courseId) => {
    const progress = getCourseProgress(courseId);
    if (progress >= 100) return "completed";
    if (progress > 0) return "inProgress";
    return "notStarted";
  };

  const hasNewVideos = (courseId) => {
    const lastAccessed = courseProgressData[courseId]?.lastAccessedAt;
    if (!lastAccessed) return false;
    const videos = courseVideosMap[courseId] || [];
    return videos.some((v) => v.addedAt && new Date(v.addedAt) > new Date(lastAccessed));
  };

  const getCourseThumbnailLocal = (course) => {
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

  const totalCourses = courses.length;
  const completedCount = courses.filter((c) => getCourseProgress(c.id) >= 100).length;
  const inProgressCount = courses.filter((c) => {
    const p = getCourseProgress(c.id);
    return p > 0 && p < 100;
  }).length;
  const notStartedCount = courses.filter((c) => getCourseProgress(c.id) === 0).length;

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const status = getCourseStatus(course.id);

      const searchableText = [
        course.title,
        course.courseTitle,
        course.description,
        course.overview,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchSearch = searchableText.includes(search.toLowerCase().trim());
      const matchStatus = statusFilter === "all" || statusFilter === status;

      return matchSearch && matchStatus;
    });
  }, [courses, search, statusFilter, courseVideosMap, progressMap, completedCourses]);

  if (loading) {
    return <h2 className="assigned-loading">Loading courses...</h2>;
  }

  return (
    <div className="assigned-courses-page">
      <div className="assigned-header">
        <h1>My Courses</h1>
        <p>All your assigned training courses</p>
      </div>

      <div className="assigned-stats-row">
        <div className="assigned-stat-card">
          <div className="assigned-stat-icon blue">
            <FaBookOpen />
          </div>
          <div className="assigned-stat-info">
            <span>Total</span>
            <strong>{totalCourses}</strong>
          </div>
        </div>
        <div className="assigned-stat-card">
          <div className="assigned-stat-icon yellow">
            <FaClock />
          </div>
          <div className="assigned-stat-info">
            <span>In Progress</span>
            <strong>{inProgressCount}</strong>
          </div>
        </div>
        <div className="assigned-stat-card">
          <div className="assigned-stat-icon green">
            <FaCheckCircle />
          </div>
          <div className="assigned-stat-info">
            <span>Completed</span>
            <strong>{completedCount}</strong>
          </div>
        </div>
        <div className="assigned-stat-card">
          <div className="assigned-stat-icon purple">
            <FaCertificate />
          </div>
          <div className="assigned-stat-info">
            <span>Not Started</span>
            <strong>{notStartedCount}</strong>
          </div>
        </div>
      </div>

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

        <button
          type="button"
          onClick={() => {
            setSearch("");
            setStatusFilter("all");
          }}
        >
          Clear
        </button>
      </div>

      <div className="assigned-courses-grid">
        {filteredCourses.length === 0 ? (
          <div className="assigned-empty-card">
            <h3>No courses found</h3>
            <p>Try changing your search or filters.</p>
          </div>
        ) : (
          filteredCourses.map((course, i) => {
            const progress = getCourseProgress(course.id);
            const status = getCourseStatus(course.id);
            const thumbnail = getCourseThumbnailLocal(course);
            const colors = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"];
            const letter = getCourseTitle(course).charAt(0).toUpperCase();

            const isPassed =
              results?.[course.id]?.passed ||
              completedCourses?.[course.id]?.passed ||
              courseProgressData?.[course.id]?.courseTestPassed;

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
                to={`${basePath}/course/${course.id}`}
                className="assigned-course-card"
                key={course.id}
              >
                <div className="assigned-course-thumb">
                  {thumbnail ? (
                    <img src={thumbnail} alt={getCourseTitle(course)} />
                  ) : (
                    <div className="assigned-course-placeholder" style={{ background: colors[i % colors.length] }}>
                      {letter}
                    </div>
                  )}
                  <span className={`assigned-status-pill ${status}`}>
                    {status === "completed" ? "Completed" : status === "inProgress" ? "In Progress" : "Not Started"}
                  </span>
                  {hasNewVideos(course.id) && <span className="new-video-badge">NEW</span>}
                </div>

                <div className="assigned-course-content">
                  <h3>{getCourseTitle(course)}</h3>
                  <p className="assigned-course-desc">{getCourseDescription(course)}</p>

                  <div className="assigned-progress">
                    <div className="progress-bar">
                      <span style={{ width: `${progress}%` }}></span>
                    </div>
                    <strong>{progress}%</strong>
                  </div>

                  <span className="assigned-action-btn">{actionLabel}</span>
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