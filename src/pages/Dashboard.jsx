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

  const newlyAssignedCourses = useMemo(() => {
    return [...courses]
      .sort(
        (a, b) =>
          new Date(b.assignment?.assignedAt || b.createdAt || 0) -
          new Date(a.assignment?.assignedAt || a.createdAt || 0)
      )
      .slice(0, 3);
  }, [courses]);

  if (loading) {
    return <h2 className="dashboard-loading">Loading Dashboard...</h2>;
  }

return (
  <div className="super-dashboard">
    <section className="dash-hero">
      <div className="hero-content">
        <h1>Hi, {userData?.name || "Learner"}</h1>
        <p>Continue your assigned learning and keep your progress moving.</p>
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-icon">
              <FaBookOpen />
            </div>
            <div>
              <strong>{totalCourses}</strong>
              <span>Assigned</span>
            </div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-icon admins-icon">
              <FaClock />
            </div>
            <div>
              <strong>{inProgressCount}</strong>
              <span>In Progress</span>
            </div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-icon dept-icon">
              <FaCheckCircle />
            </div>
            <div>
              <strong>{completedCount}</strong>
              <span>Completed</span>
            </div>
          </div>
        </div>
      </div>
      <div className="hero-decoration">
        <div className="hero-circle-1"></div>
        <div className="hero-circle-2"></div>
      </div>
    </section>

    <section className="dash-stat-cards">
      <div className="stat-card stat-courses">
        <div className="stat-card-icon">
          <FaBookOpen />
        </div>
        <div className="stat-card-info">
          <span>Assigned</span>
          <strong>{totalCourses}</strong>
        </div>
      </div>
      <div className="stat-card stat-progress">
        <div className="stat-card-icon">
          <FaClock />
        </div>
        <div className="stat-card-info">
          <span>In Progress</span>
          <strong>{inProgressCount}</strong>
        </div>
      </div>
      <div className="stat-card stat-completed">
        <div className="stat-card-icon">
          <FaCheckCircle />
        </div>
        <div className="stat-card-info">
          <span>Completed</span>
          <strong>{completedCount}</strong>
        </div>
      </div>
      <div className="stat-card stat-cert">
        <div className="stat-card-icon">
          <FaCertificate />
        </div>
        <div className="stat-card-info">
          <span>Certificates</span>
          <strong>{passedCount}</strong>
        </div>
      </div>
      <div className="stat-card stat-rate">
        <div className="stat-card-icon">
          <FaCheckCircle />
        </div>
        <div className="stat-card-info">
          <span>Completion Rate</span>
          <strong>{progressPercent}%</strong>
        </div>
      </div>
    </section>

    {continueVideo && (
      <section className="continue-section">
        <div className="card-head">
          <div>
            <h2>Continue Learning</h2>
            <p>Resume where you left off</p>
          </div>
        </div>
        <Link to={`/course/${continueVideo.courseId}`} className="continue-card">
          <div className="continue-image">
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
          <div className="continue-content">
            <span>{continueVideo.courseTitle}</span>
            <h3>{continueVideo.title}</h3>
            <div className="continue-progress">
              <div>
                <span style={{ width: `${continueVideo.watchedPercent || 0}%` }} />
              </div>
              <strong>{continueVideo.watchedPercent || 0}%</strong>
            </div>
          </div>
          <button>Continue</button>
        </Link>
      </section>
    )}

    <section className="newly-courses-section">
      <div className="card-head">
        <div>
          <h2>Newly Assigned</h2>
          <p>Courses assigned to you recently</p>
        </div>
        <Link to="/assigned-courses">View All</Link>
      </div>
      <div className="newly-courses-grid">
        {newlyAssignedCourses.length === 0 ? (
          <p className="empty-text">No courses assigned yet.</p>
        ) : (
          newlyAssignedCourses.map((course, i) => {
            const colors = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"];
            const letter = (course.title || course.courseTitle || "C").charAt(0).toUpperCase();
            const thumbnail = getCourseThumbnail(course);
            const progress = getCourseProgress(course.id);
            const status = getCourseStatus(course.id);
            return (
              <Link to={`/course/${course.id}`} className="newly-course-card" key={course.id}>
                <div className="newly-course-thumb">
                  {thumbnail ? (
                    <img src={thumbnail} alt={course.title || course.courseTitle} />
                  ) : (
                    <div className="newly-course-placeholder" style={{ background: colors[i % colors.length] }}>
                      {letter}
                    </div>
                  )}
                </div>
                <div className="newly-course-info">
                  <h3>{course.title || course.courseTitle}</h3>
                  <span>{course.department || "Training"}</span>
                  <div className="newly-course-progress">
                    <div className="progress-bar">
                      <span style={{ width: `${progress}%` }}></span>
                    </div>
                    <strong>{progress}%</strong>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </section>
  </div>
);
}

export default Dashboard;
