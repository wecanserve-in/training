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
} from "react-icons/fa";


const ADMIN_EMAIL = "wemedialabs@gmail.com";

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
        const isAdmin = user.email === ADMIN_EMAIL;

        const userSnapshot = await get(ref(database, `users/${user.uid}`));
        if (userSnapshot.exists()) {
          setUserData({ id: user.uid, ...userSnapshot.val() });
        }

        const [
          resultsSnapshot,
          completedSnapshot,
          progressSnapshot,
          coursesSnapshot,
          videosSnapshot,
        ] = await Promise.all([
          get(ref(database, `results/${user.uid}`)),
          get(ref(database, `completedCourses/${user.uid}`)),
          get(ref(database, `progress/${user.uid}`)),
          get(ref(database, "courses")),
          get(ref(database, "videos")),
        ]);

        const userResults = resultsSnapshot.exists()
          ? resultsSnapshot.val()
          : {};
        const userCompletedCourses = completedSnapshot.exists()
          ? completedSnapshot.val()
          : {};
        const userProgress = progressSnapshot.exists()
          ? progressSnapshot.val()
          : {};

        setResults(userResults);
        setCompletedCourses(userCompletedCourses);
        setProgressMap(userProgress);

        if (!coursesSnapshot.exists()) {
          setCourses([]);
          setCourseVideosMap({});
          setLoading(false);
          return;
        }

        const allCoursesData = coursesSnapshot.val();

        let courseArray = [];

        if (isAdmin) {
          courseArray = Object.keys(allCoursesData).map((key) => ({
            id: key,
            ...allCoursesData[key],
          }));
        } else {
          const assignmentsSnapshot = await get(
            ref(database, `userAssignments/${user.uid}`)
          );

          if (!assignmentsSnapshot.exists()) {
            setCourses([]);
            setCourseVideosMap({});
            setLoading(false);
            return;
          }

          const assignmentData = assignmentsSnapshot.val();

          const assignedCourseIds = Object.keys(assignmentData).filter(
            (courseId) => assignmentData[courseId]?.assigned
          );

          courseArray = assignedCourseIds
            .map((courseId) => ({
              id: courseId,
              ...allCoursesData[courseId],
              assignment: assignmentData[courseId],
            }))
            .filter((course) => course.title || course.courseTitle);
        }

        const map = {};

        if (videosSnapshot.exists()) {
          const allVideos = Object.entries(videosSnapshot.val()).map(
            ([videoId, video]) => ({
              id: videoId,
              ...video,
            })
          );

          courseArray.forEach((course) => {
            map[course.id] = allVideos
              .filter((video) => video.courseId === course.id)
              .sort(
                (a, b) =>
                  new Date(a.createdAt || 0).getTime() -
                  new Date(b.createdAt || 0).getTime()
              );
          });
        }

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
    if (completedCourses?.[courseId]) return 100;

    const courseVideos = courseVideosMap[courseId] || [];

    if (courseVideos.length === 0) return 0;

    const completedVideoCount = courseVideos.filter(
      (video) => progressMap?.[video.id]?.completed
    ).length;

    return Math.round((completedVideoCount / courseVideos.length) * 100);
  };

  const getCourseStatus = (courseId) => {
    const progress = getCourseProgress(courseId);

    if (progress >= 100) return "Completed";
    if (progress > 0) return "In Progress";
    return "Not Started";
  };

  const getNextVideoId = (courseId) => {
    const courseVideos = courseVideosMap[courseId] || [];

    if (courseVideos.length === 0) return null;

    const nextVideo = courseVideos.find(
      (video) => !progressMap?.[video.id]?.completed
    );

    return nextVideo?.id || courseVideos[0]?.id || null;
  };

  const totalCourses = courses.length;

  const completedCount = useMemo(() => {
    return courses.filter((course) => getCourseProgress(course.id) >= 100)
      .length;
  }, [courses, courseVideosMap, progressMap, completedCourses]);

  const inProgressCount = useMemo(() => {
    return courses.filter((course) => {
      const progress = getCourseProgress(course.id);
      return progress > 0 && progress < 100;
    }).length;
  }, [courses, courseVideosMap, progressMap, completedCourses]);

  const notStartedCount = Math.max(
    totalCourses - completedCount - inProgressCount,
    0
  );

  const passedCount = useMemo(() => {
    return courses.filter((course) => {
      const result = results?.[course.id];
      const completed = completedCourses?.[course.id];
      return result?.passed || completed?.passed;
    }).length;
  }, [courses, results, completedCourses]);

  const progressPercent =
    totalCourses > 0 ? Math.round((completedCount / totalCourses) * 100) : 0;

  const continueLearning = useMemo(() => {
    const incompleteCourses = courses
      .filter((course) => getCourseProgress(course.id) < 100)
      .sort((a, b) => {
        const progressA = getCourseProgress(a.id);
        const progressB = getCourseProgress(b.id);

        if (progressB !== progressA) return progressB - progressA;

        const dateA = new Date(
          a.assignment?.assignedAt || a.createdAt || 0
        ).getTime();

        const dateB = new Date(
          b.assignment?.assignedAt || b.createdAt || 0
        ).getTime();

        return dateB - dateA;
      });

    return incompleteCourses[0] || null;
  }, [courses, courseVideosMap, progressMap, completedCourses]);

  const latestCourses = useMemo(() => {
    return [...courses]
      .sort((a, b) => {
        const dateA = new Date(
          a.assignment?.assignedAt || a.createdAt || 0
        ).getTime();

        const dateB = new Date(
          b.assignment?.assignedAt || b.createdAt || 0
        ).getTime();

        return dateB - dateA;
      })
      .slice(0, 3);
  }, [courses]);

  if (loading) {
    return <h2 className="dashboard-loading">Loading Dashboard...</h2>;
  }

  return (
    <div className="learner-dashboard-page">
      <div className="learner-topbar">
        <div>
          <h1>Welcome back, {userData?.name || "Learner"}</h1>
          <p>Keep learning and grow every day.</p>
        </div>

        <div className="learner-avatar">
          {(userData?.name || "U").charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="learner-stat-grid">
        <div className="learner-stat-card">
          <div className="stat-icon green">
  <FaBookOpen />
</div>
          <div>
            <span>Assigned Courses</span>
            <h2>{totalCourses}</h2>
          </div>
        </div>

        <div className="learner-stat-card">
          <div className="stat-icon blue">
  <FaClock />
</div>
          <div>
            <span>In Progress</span>
            <h2>{inProgressCount}</h2>
          </div>
        </div>

        <div className="learner-stat-card">
          <div className="stat-icon green"><FaCheckCircle /></div>
          <div>
            <span>Completed</span>
            <h2>{completedCount}</h2>
          </div>
        </div>

        <div className="learner-stat-card">
          <div className="stat-icon yellow">  <FaCertificate /></div>
          <div>
            <span>Certificates Earned</span>
            <h2>{passedCount}</h2>
          </div>
        </div>
      </div>

      <div className="learner-mid-grid">
        <div className="learner-panel continue-panel">
          <h2>Continue Learning</h2>

          {continueLearning ? (
            <div className="continue-box">
              <div className="course-icon-box">
                {(continueLearning.title || continueLearning.courseTitle || "C")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="continue-info">
                <h3>
                  {continueLearning.title || continueLearning.courseTitle}
                </h3>

                <span>Progress</span>

                <div className="mini-progress">
                  <span
                    style={{
                      width: `${getCourseProgress(continueLearning.id)}%`,
                    }}
                  ></span>
                </div>
              </div>

              <strong>{getCourseProgress(continueLearning.id)}%</strong>

              <Link
                to={
                  getNextVideoId(continueLearning.id)
                    ? `/video/${getNextVideoId(continueLearning.id)}`
                    : `/course/${continueLearning.id}`
                }
              >
                <button>Continue</button>
              </Link>
            </div>
          ) : (
            <p className="no-data-msg">All courses completed.</p>
          )}
        </div>

        <div className="learner-panel progress-panel">
          <h2>Overall Progress</h2>

          <div className="progress-content">
            <div
              className="dashboard-progress-ring"
              style={{
                background: `conic-gradient(#0f9d58 ${progressPercent}%, #edf1f5 0)`,
              }}
            >
              <div>
                <strong>{progressPercent}%</strong>
                <span>Overall Completion</span>
              </div>
            </div>

            <div className="progress-legend">
              <p>
                <span className="dot green"></span>Completed{" "}
                <strong>{completedCount}</strong>
              </p>

              <p>
                <span className="dot blue"></span>In Progress{" "}
                <strong>{inProgressCount}</strong>
              </p>

              <p>
                <span className="dot grey"></span>Not Started{" "}
                <strong>{notStartedCount}</strong>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="learner-panel">
        <div className="panel-head-row">
          <h2>Recently Assigned Courses</h2>
          <Link to="/assigned-courses">View All</Link>
        </div>

        {latestCourses.length === 0 ? (
          <p className="no-data-msg">No courses assigned yet.</p>
        ) : (
          <div className="course-list-table">
            {latestCourses.map((course) => {
              const progress = getCourseProgress(course.id);
              const status = getCourseStatus(course.id);
              const nextVideoId = getNextVideoId(course.id);

              return (
                <div className="course-list-row" key={course.id}>
                  <div className="list-course-name">
                    <div className="small-course-icon">
                      {(course.title || course.courseTitle || "C")
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <strong>{course.title || course.courseTitle}</strong>
                  </div>

                  <div className="list-progress">
                    <span>Progress</span>

                    <div className="mini-progress">
                      <span style={{ width: `${progress}%` }}></span>
                    </div>

                    <strong>{progress}%</strong>
                  </div>

                  <div className="list-status">{status}</div>

                  <Link
                    to={
                      nextVideoId && progress < 100
                        ? `/video/${nextVideoId}`
                        : `/course/${course.id}`
                    }
                  >
                    <button className="outline-small-btn">
                      {progress >= 100 ? "Review" : "Continue"}
                    </button>
                  </Link>
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