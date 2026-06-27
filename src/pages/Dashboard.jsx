import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/dashboard.css";

import {
  FaBookOpen,
  FaClock,
  FaCheckCircle,
  FaCertificate,
  FaPlay,
} from "react-icons/fa";

function Dashboard() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [courseVideosMap, setCourseVideosMap] = useState({});
  const [progressMap, setProgressMap] = useState({});
  const [results, setResults] = useState({});
  const [completedCourses, setCompletedCourses] = useState({});
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
          progressSnapshot,
          coursesSnapshot,
          videosSnapshot,
          courseVideosSnapshot,
          videoLibrarySnapshot,
        ] = await Promise.all([
          get(ref(database, `users/${user.uid}`)),
          get(ref(database, `userAssignments/${user.uid}`)),
          get(ref(database, `results/${user.uid}`)),
          get(ref(database, `completedCourses/${user.uid}`)),
          get(ref(database, `progress/${user.uid}`)),
          get(ref(database, "courses")),
          get(ref(database, "videos")),
          get(ref(database, "courseVideos")),
          get(ref(database, "videoLibrary")),
        ]);

        if (userSnapshot.exists()) {
          setUserData({ id: user.uid, email: user.email, ...userSnapshot.val() });
        }

        const userResults = resultsSnapshot.exists() ? resultsSnapshot.val() : {};
        const userCompletedCourses = completedSnapshot.exists()
          ? completedSnapshot.val()
          : {};
        const userProgress = progressSnapshot.exists() ? progressSnapshot.val() : {};

        setResults(userResults);
        setCompletedCourses(userCompletedCourses);
        setProgressMap(userProgress);

        if (!assignmentsSnapshot.exists() || !coursesSnapshot.exists()) {
          setCourses([]);
          setCourseVideosMap({});
          setLoading(false);
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

        const oldVideos = videosSnapshot.exists()
          ? Object.entries(videosSnapshot.val()).map(([videoId, video]) => ({
              id: videoId,
              ...video,
            }))
          : [];

        const libraryVideos = videoLibrarySnapshot.exists()
          ? Object.entries(videoLibrarySnapshot.val()).map(([videoId, video]) => ({
              id: videoId,
              ...video,
            }))
          : [];

        const courseVideosData = courseVideosSnapshot.exists()
          ? courseVideosSnapshot.val()
          : {};

        const map = {};

        courseArray.forEach((course) => {
          const mappedVideos = courseVideosData?.[course.id]
            ? Object.entries(courseVideosData[course.id]).map(([videoId, video]) => ({
                id: videoId,
                ...video,
              }))
            : [];

          if (mappedVideos.length > 0) {
            map[course.id] = mappedVideos.sort((a, b) => (a.order || 0) - (b.order || 0));
            return;
          }

          if (Array.isArray(course.videoIds) && course.videoIds.length > 0) {
            map[course.id] = course.videoIds
              .map((videoId) => libraryVideos.find((video) => video.id === videoId))
              .filter(Boolean);
            return;
          }

          map[course.id] = oldVideos
            .filter((video) => video.courseId === course.id)
            .sort(
              (a, b) =>
                new Date(a.createdAt || 0).getTime() -
                new Date(b.createdAt || 0).getTime()
            );
        });

        courseArray.sort(
          (a, b) =>
            new Date(b.assignment?.assignedAt || b.createdAt || 0) -
            new Date(a.assignment?.assignedAt || a.createdAt || 0)
        );

        setCourses(courseArray);
        setCourseVideosMap(map);
      } catch (error) {
        console.error(error);
        alert("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const getCourseProgress = (courseId) => {
    if (completedCourses?.[courseId]?.passed || completedCourses?.[courseId]?.completed) {
      return 100;
    }

    const courseVideos = courseVideosMap[courseId] || [];
    if (courseVideos.length === 0) return 0;

    const total = courseVideos.reduce((sum, video) => {
      const progress = progressMap?.[video.id];

      if (progress?.completed) return sum + 100;

      return sum + Number(progress?.watchedPercent || 0);
    }, 0);

    return Math.round(total / courseVideos.length);
  };

  const getCourseStatus = (courseId) => {
    const progress = getCourseProgress(courseId);

    if (progress >= 100) return "completed";
    if (progress > 0) return "inProgress";
    return "notStarted";
  };

  const getNextVideoId = (courseId) => {
    const courseVideos = courseVideosMap[courseId] || [];
    if (courseVideos.length === 0) return null;

    const nextVideo = courseVideos.find(
      (video) => !progressMap?.[video.id]?.completed
    );

    return nextVideo?.id || courseVideos[0]?.id || null;
  };

  const getCourseThumbnail = (course) => {
    if (course.thumbnailUrl) return course.thumbnailUrl;
    if (course.courseThumbnail) return course.courseThumbnail;
    if (course.assignment?.courseThumbnail) return course.assignment.courseThumbnail;

    const videos = courseVideosMap[course.id] || [];
    const videoWithThumb = videos.find((video) => video.thumbnailUrl);

    return videoWithThumb?.thumbnailUrl || "";
  };

  const totalCourses = courses.length;

  const completedCount = useMemo(() => {
    return courses.filter((course) => getCourseProgress(course.id) >= 100).length;
  }, [courses, courseVideosMap, progressMap, completedCourses]);

  const inProgressCount = useMemo(() => {
    return courses.filter((course) => {
      const progress = getCourseProgress(course.id);
      return progress > 0 && progress < 100;
    }).length;
  }, [courses, courseVideosMap, progressMap, completedCourses]);

  const notStartedCount = Math.max(totalCourses - completedCount - inProgressCount, 0);

  const passedCount = useMemo(() => {
    return courses.filter((course) => {
      const result = results?.[course.id];
      const completed = completedCourses?.[course.id];
      return result?.passed || completed?.passed;
    }).length;
  }, [courses, results, completedCourses]);

  const progressPercent =
    totalCourses > 0 ? Math.round((completedCount / totalCourses) * 100) : 0;

  const allVideosFlat = useMemo(() => {
    return courses.flatMap((course) => {
      const videos = courseVideosMap[course.id] || [];

      return videos.map((video) => ({
        ...video,
        courseId: course.id,
        courseTitle: course.title || course.courseTitle,
        courseThumbnail: getCourseThumbnail(course),
        courseAssignedAt: course.assignment?.assignedAt || course.createdAt,
      }));
    });
  }, [courses, courseVideosMap, completedCourses, progressMap]);

  const continueVideo = useMemo(() => {
    const watchedVideos = allVideosFlat
      .map((video) => ({
        ...video,
        progress: progressMap?.[video.id] || {},
        watchedPercent: Number(progressMap?.[video.id]?.watchedPercent || 0),
      }))
      .filter((video) => video.watchedPercent > 0 && !video.progress?.completed)
      .sort((a, b) => {
        const aTime = new Date(a.progress?.updatedAt || a.progress?.lastWatchedAt || 0).getTime();
        const bTime = new Date(b.progress?.updatedAt || b.progress?.lastWatchedAt || 0).getTime();
        return bTime - aTime;
      });

    if (watchedVideos.length > 0) return watchedVideos[0];

    const firstNotStartedCourse = courses.find((course) => getCourseProgress(course.id) < 100);
    const firstVideo = firstNotStartedCourse
      ? (courseVideosMap[firstNotStartedCourse.id] || [])[0]
      : null;

    if (!firstVideo) return null;

    return {
      ...firstVideo,
      courseId: firstNotStartedCourse.id,
      courseTitle: firstNotStartedCourse.title || firstNotStartedCourse.courseTitle,
      courseThumbnail: getCourseThumbnail(firstNotStartedCourse),
      watchedPercent: 0,
    };
  }, [allVideosFlat, progressMap, courses, courseVideosMap]);

  const quickVideos = useMemo(() => {
    return allVideosFlat
      .filter((video) => !progressMap?.[video.id]?.completed)
      .slice(0, 5);
  }, [allVideosFlat, progressMap]);

  const newlyAssignedCourses = useMemo(() => {
    return [...courses]
      .sort(
        (a, b) =>
          new Date(b.assignment?.assignedAt || b.createdAt || 0) -
          new Date(a.assignment?.assignedAt || a.createdAt || 0)
      )
      .slice(0, 4);
  }, [courses]);

  if (loading) {
    return <h2 className="dashboard-loading">Loading Dashboard...</h2>;
  }

  return (
    <div className="learner-dashboard-page">
      <div className="learner-topbar enhanced-dashboard-top">
        <div>
          <span>My Dashboard</span>
          <h1>Welcome back, {userData?.name || "Learner"}</h1>
          <p>Your learning progress and next training are ready.</p>
        </div>

        <div className="learner-avatar">
          {(userData?.name || "U").charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="performance-section">
        <div className="performance-head">
          <div>
            <h2>My Performance</h2>
            <p>Only important learning numbers.</p>
          </div>

          <div className="overall-pill">{progressPercent}% Overall</div>
        </div>

        <div className="learner-stat-grid performance-grid">
          <div className="learner-stat-card">
            <div className="stat-icon blue">
              <FaBookOpen />
            </div>
            <div>
              <span>Assigned</span>
              <h2>{totalCourses}</h2>
            </div>
          </div>

          <div className="learner-stat-card">
            <div className="stat-icon yellow">
              <FaClock />
            </div>
            <div>
              <span>In Progress</span>
              <h2>{inProgressCount}</h2>
            </div>
          </div>

          <div className="learner-stat-card">
            <div className="stat-icon green">
              <FaCheckCircle />
            </div>
            <div>
              <span>Completed</span>
              <h2>{completedCount}</h2>
            </div>
          </div>

          <div className="learner-stat-card">
            <div className="stat-icon red">
              <FaCertificate />
            </div>
            <div>
              <span>Certificates</span>
              <h2>{passedCount}</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="continue-learning-section">
        <div className="panel-head-row">
          <div>
            <h2>Continue Learning</h2>
            <p>Resume your latest video.</p>
          </div>

          <Link to="/assigned-courses">View All Courses</Link>
        </div>

        {continueVideo ? (
          <div className="featured-video-card">
            <div className="featured-video-thumb">
              {continueVideo.thumbnailUrl || continueVideo.courseThumbnail ? (
                <img
                  src={continueVideo.thumbnailUrl || continueVideo.courseThumbnail}
                  alt={continueVideo.title}
                />
              ) : (
                <div>
                  <FaPlay />
                </div>
              )}
            </div>

            <div className="featured-video-info">
              <span>{continueVideo.courseTitle}</span>
              <h3>{continueVideo.title}</h3>
              <p>{continueVideo.description || "Continue your training video."}</p>

              <div className="featured-progress">
                <div>
                  <span style={{ width: `${continueVideo.watchedPercent || 0}%` }}></span>
                </div>
                <strong>{continueVideo.watchedPercent || 0}%</strong>
              </div>
            </div>

<Link to={`/course/${continueVideo.courseId}`}>
              <button>Continue</button>
            </Link>
          </div>
        ) : (
          <div className="empty-dashboard-card">
            <h3>No video to continue</h3>
            <p>Newly assigned courses will appear below.</p>
          </div>
        )}

        {quickVideos.length > 0 && (
          <div className="quick-video-row">
            {quickVideos.map((video) => (
              <Link to={`/video/${video.id}`} className="quick-video-card" key={video.id}>
                <div>
                  {video.thumbnailUrl || video.courseThumbnail ? (
                    <img
                      src={video.thumbnailUrl || video.courseThumbnail}
                      alt={video.title}
                    />
                  ) : (
                    <span>
                      <FaPlay />
                    </span>
                  )}
                </div>

                <h4>{video.title}</h4>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="new-courses-section">
        <div className="panel-head-row">
          <div>
            <h2>Newly Assigned Courses</h2>
            <p>Latest courses assigned to you.</p>
          </div>

          <Link to="/assigned-courses">View All</Link>
        </div>

        {newlyAssignedCourses.length === 0 ? (
          <div className="empty-dashboard-card">
            <h3>No courses assigned yet</h3>
            <p>Your assigned courses will appear here.</p>
          </div>
        ) : (
          <div className="new-course-grid">
            {newlyAssignedCourses.map((course) => {
              const progress = getCourseProgress(course.id);
              const status = getCourseStatus(course.id);

              const thumbnail = getCourseThumbnail(course);

              return (
                <div className="new-course-card" key={course.id}>
                  <div className="new-course-thumb">
                    {thumbnail ? (
                      <img src={thumbnail} alt={course.title || course.courseTitle} />
                    ) : (
                      <div>{(course.title || course.courseTitle || "C").charAt(0)}</div>
                    )}
                  </div>

                  <div className="new-course-body">
                    <span>{course.department || "Training"}</span>
                    <h3>{course.title || course.courseTitle}</h3>
                    <p>{course.description || course.overview || "Assigned training course."}</p>

                    <div className="new-course-progress">
                      <div>
                        <span style={{ width: `${progress}%` }}></span>
                      </div>
                      <strong>{progress}%</strong>
                    </div>

                   <Link to={`/course/${course.id}`}>
  <button>
    {status === "completed" ? "Review Course" : "Start Course"}
  </button>
</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;