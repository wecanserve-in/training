import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import {
  FaBookOpen,
  FaCheckCircle,
  FaClock,
  FaChartLine,
  FaCertificate,
  FaPlayCircle,
} from "react-icons/fa";
import "../styles/mylearnings.css";

function MyLearnings() {
  const [progress, setProgress] = useState({});
  const [attempts, setAttempts] = useState([]);
  const [completedCourses, setCompletedCourses] = useState({});
  const [courses, setCourses] = useState({});
  const [videos, setVideos] = useState({});
  const [range, setRange] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const [
          progressSnap,
          attemptsSnap,
          completedSnap,
          coursesSnap,
          videosSnap,
          videoLibrarySnap,
        ] = await Promise.all([
          get(ref(database, `progress/${user.uid}`)),
          get(ref(database, `attempts/${user.uid}`)),
          get(ref(database, `completedCourses/${user.uid}`)),
          get(ref(database, "courses")),
          get(ref(database, "videos")),
          get(ref(database, "videoLibrary")),
        ]);

        const progressData = progressSnap.exists() ? progressSnap.val() : {};
        const completedData = completedSnap.exists() ? completedSnap.val() : {};
        const coursesData = coursesSnap.exists() ? coursesSnap.val() : {};

        const oldVideos = videosSnap.exists() ? videosSnap.val() : {};
        const libraryVideos = videoLibrarySnap.exists() ? videoLibrarySnap.val() : {};

        const mergedVideos = {
          ...oldVideos,
          ...libraryVideos,
        };

        setProgress(progressData);
        setCompletedCourses(completedData);
        setCourses(coursesData);
        setVideos(mergedVideos);

        if (attemptsSnap.exists()) {
          const allAttempts = attemptsSnap.val();

          const userAttempts = Object.entries(allAttempts)
            .map(([attemptId, item]) => ({
              id: attemptId,
              ...item,
            }))
            .filter((item) => item.courseId)
            .sort(
              (a, b) =>
                new Date(b.submittedAt || 0).getTime() -
                new Date(a.submittedAt || 0).getTime()
            );

          setAttempts(userAttempts);
        } else {
          setAttempts([]);
        }
      } catch (error) {
        console.error(error);
        alert("Failed to load learning data");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const progressValues = useMemo(() => {
    return Object.entries(progress || {}).map(([videoId, item]) => ({
      videoId,
      ...item,
    }));
  }, [progress]);

  const finalAttempts = useMemo(() => {
    return attempts.filter((item) => item.courseId && !item.videoId);
  }, [attempts]);

  const completedCourseValues = useMemo(() => {
    return Object.entries(completedCourses || {}).map(([courseId, item]) => ({
      courseId,
      ...item,
    }));
  }, [completedCourses]);

  const stats = useMemo(() => {
const totalSeconds = progressValues.reduce((sum, item) => {
  const watchedSecondsCount = item.watchedSeconds
    ? Object.keys(item.watchedSeconds).length
    : 0;

  const duration = Number(item.duration || 0);
  const watchedPercent = Number(item.watchedPercent || 0);

  const estimatedSeconds =
    duration > 0
      ? duration * (watchedPercent / 100)
      : 0;

  return sum + Math.max(watchedSecondsCount, estimatedSeconds);
}, 0);

    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMinutes = Math.floor((totalSeconds % 3600) / 60);

    const completedVideos = progressValues.filter((item) => item.completed).length;

    const coursesCompleted = completedCourseValues.filter(
      (item) => item.passed || item.completed
    ).length;

    const certificatesEarned = completedCourseValues.filter(
      (item) => item.passed && item.attemptId
    ).length;

    const avgScore =
      finalAttempts.length > 0
        ? Math.round(
            finalAttempts.reduce((sum, item) => sum + Number(item.score || 0), 0) /
              finalAttempts.length
          )
        : 0;

    const inProgressVideos = progressValues.filter(
      (item) => !item.completed && Number(item.watchedPercent || 0) > 0
    ).length;

    return {
      totalTime: `${totalHours}h ${totalMinutes}m`,
      completedVideos,
      inProgressVideos,
      finalTestsTaken: finalAttempts.length,
      avgScore,
      coursesCompleted,
      certificatesEarned,
    };
  }, [progressValues, finalAttempts, completedCourseValues]);

  const recentActivities = useMemo(() => {
    const videoActivities = progressValues
      .map((item) => {
        const videoData = videos[item.videoId] || {};
        const courseData = courses[item.courseId] || {};

        return {
          id: item.videoId,
          type: item.completed ? "Video Completed" : "Video Watched",
          title: item.videoTitle || videoData.title || videoData.videoTitle || "Training Video",
          subtitle:
            courseData.title ||
            courseData.courseTitle ||
            item.courseTitle ||
            "Training Course",
          date: item.completedAt || item.updatedAt,
          value: `${Math.round(Number(item.watchedPercent || 0))}%`,
        };
      })
      .filter((item) => item.date);

    const testActivities = finalAttempts.map((item) => ({
      id: item.id,
      type: "Final Test",
      title: item.courseTitle || courses[item.courseId]?.title || "Course Test",
      subtitle: item.passed ? "Passed" : "Failed",
      date: item.submittedAt,
      value: `${item.score || 0}%`,
    }));

    return [...videoActivities, ...testActivities]
      .sort(
        (a, b) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      )
      .slice(0, 3);
  }, [progressValues, finalAttempts, videos, courses]);

 const activityData = useMemo(() => {
  const today = new Date();
  const days = [];

  for (let i = range - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    const key = date.toISOString().slice(0, 10);

    days.push({
      key,
      label: date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      }),
      seconds: 0,
    });
  }

  const dayMap = {};

  days.forEach((day) => {
    dayMap[day.key] = day;
  });

  progressValues.forEach((item) => {
    const dateSource = item.updatedAt || item.completedAt;
    if (!dateSource) return;

    const dateKey = new Date(dateSource).toISOString().slice(0, 10);
    if (!dayMap[dateKey]) return;

    const watchedSecondsCount = item.watchedSeconds
      ? Object.keys(item.watchedSeconds).length
      : 0;

    const duration = Number(item.duration || 0);
    const watchedPercent = Number(item.watchedPercent || 0);

    const watchedSeconds =
      duration > 0
        ? Math.max(watchedSecondsCount, duration * (watchedPercent / 100))
        : watchedSecondsCount;

    dayMap[dateKey].seconds += watchedSeconds;
  });

  return days.map((day) => ({
    ...day,
    hours: Number((day.seconds / 3600).toFixed(2)),
  }));
}, [progressValues, range]);

  const maxHours = useMemo(() => {
    const max = Math.max(...activityData.map((item) => item.hours), 1);
    return Math.ceil(max);
  }, [activityData]);

  const chartPoints = useMemo(() => {
    const width = 700;
    const height = 240;
    const paddingX = 22;
    const paddingY = 26;

    return activityData.map((item, index) => {
      const x =
        activityData.length === 1
          ? width / 2
          : paddingX +
            (index * (width - paddingX * 2)) / (activityData.length - 1);

      const y =
        height -
        paddingY -
        (item.hours / maxHours) * (height - paddingY * 2);

      return {
        ...item,
        x,
        y,
      };
    });
  }, [activityData, maxHours]);

  const pathD = useMemo(() => {
    return chartPoints
      .map((point, index) =>
        index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`
      )
      .join(" ");
  }, [chartPoints]);

  const areaD = useMemo(() => {
    if (chartPoints.length === 0) return "";

    const first = chartPoints[0];
    const last = chartPoints[chartPoints.length - 1];

    return `${pathD} L ${last.x} 240 L ${first.x} 240 Z`;
  }, [chartPoints, pathD]);

  const xAxisLabels = useMemo(() => {
    if (activityData.length === 0) return [];

    const indexes = [
      0,
      Math.floor(activityData.length * 0.25),
      Math.floor(activityData.length * 0.5),
      Math.floor(activityData.length * 0.75),
      activityData.length - 1,
    ];

    return [...new Set(indexes)].map((index) => activityData[index]);
  }, [activityData]);

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) return <h2 className="learning-loading">Loading Learnings...</h2>;

  return (
    <div className="my-learning-page">
      <div className="learning-header">
        <div>
          <span>Learning Analytics</span>
          <h1>My Learnings</h1>
          <p>Your real training activity, progress, test scores and certificates.</p>
        </div>

        <strong>{stats.totalTime}</strong>
      </div>

      <div className="learning-kpi-grid">
        <div className="learning-kpi-card">
          <div className="learning-icon blue">
            <FaClock />
          </div>
          <span>Total Time</span>
          <h2>{stats.totalTime}</h2>
        </div>

        <div className="learning-kpi-card">
          <div className="learning-icon green">
            <FaPlayCircle />
          </div>
          <span>Videos Completed</span>
          <h2>{stats.completedVideos}</h2>
        </div>

        <div className="learning-kpi-card">
          <div className="learning-icon yellow">
            <FaBookOpen />
          </div>
          <span>Final Tests Taken</span>
          <h2>{stats.finalTestsTaken}</h2>
        </div>

        <div className="learning-kpi-card">
          <div className="learning-icon purple">
            <FaChartLine />
          </div>
          <span>Avg Final Score</span>
          <h2>{stats.avgScore}%</h2>
        </div>

        <div className="learning-kpi-card">
          <div className="learning-icon green">
            <FaCheckCircle />
          </div>
          <span>Courses Completed</span>
          <h2>{stats.coursesCompleted}</h2>
        </div>

        <div className="learning-kpi-card">
          <div className="learning-icon blue">
            <FaCertificate />
          </div>
          <span>Certificates Earned</span>
          <h2>{stats.certificatesEarned}</h2>
        </div>
      </div>

      <div className="learning-content-grid">
        <div className="learning-chart-card">
          <div className="learning-chart-head">
            <div>
              <h2>Learning Activity</h2>
              <p>Time spent watching training videos.</p>
            </div>

            <select value={range} onChange={(e) => setRange(Number(e.target.value))}>
              <option value="30">Last 30 Days</option>
              <option value="7">Last 7 Days</option>
            </select>
          </div>

          <div className="activity-chart">
            <div className="chart-y-axis">
              <span>{maxHours}h</span>
              <span>{Math.round(maxHours * 0.66)}h</span>
              <span>{Math.round(maxHours * 0.33)}h</span>
              <span>0h</span>
            </div>

            <div className="chart-area">
              <svg viewBox="0 0 700 240" preserveAspectRatio="none">
                {areaD && <path d={areaD} className="chart-area-fill" />}

                {pathD && <path d={pathD} className="chart-line-path" />}

                {chartPoints.map((point) => (
                  <circle
                    key={point.key}
                    cx={point.x}
                    cy={point.y}
                    r="5"
                    className="chart-point"
                  />
                ))}
              </svg>

              <div className="chart-x-axis">
                {xAxisLabels.map((item) => (
                  <span key={item.key}>{item.label}</span>
                ))}
              </div>
            </div>
          </div>

          {progressValues.length === 0 && (
            <p className="learning-empty-note">No learning activity recorded yet.</p>
          )}
        </div>

        <div className="recent-learning-card">
          <h2>Recent Activity</h2>

          {recentActivities.length === 0 ? (
            <p className="learning-empty-note">No recent activity yet.</p>
          ) : (
            <div className="recent-learning-list">
              {recentActivities.map((item) => (
                <div className="recent-learning-item" key={`${item.type}-${item.id}`}>
                  <div className="recent-learning-dot"></div>

                  <div>
                    <span>{item.type}</span>
                    <h3>{item.title}</h3>
                    <p>{item.subtitle}</p>
                    <small>{formatDate(item.date)}</small>
                  </div>

                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MyLearnings;