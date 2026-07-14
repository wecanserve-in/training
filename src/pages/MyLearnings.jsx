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

const getProgressWatchedSeconds = (item) => {
  const watchedSecondsCount =
    item?.watchedSeconds && typeof item.watchedSeconds === "object"
      ? Object.keys(item.watchedSeconds).length
      : 0;

  const duration = Number(item?.duration || 0);
  const watchedPercent = Math.max(
    0,
    Math.min(100, Number(item?.watchedPercent || 0))
  );

  const estimatedSeconds =
    duration > 0 ? Math.round(duration * (watchedPercent / 100)) : 0;

  return Math.max(watchedSecondsCount, estimatedSeconds);
};

const collectActivitySeconds = (value) => {
  if (!value || typeof value !== "object") return 0;

  // Supports both:
  // date/videoId/{ seconds }
  // date/videoId/pushId/{ seconds }
  if (Object.prototype.hasOwnProperty.call(value, "seconds")) {
    const seconds = Number(value.seconds || 0);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  }

  return Object.values(value).reduce(
    (sum, child) => sum + collectActivitySeconds(child),
    0
  );
};

const formatDuration = (totalSeconds) => {
  const safeSeconds = Math.max(0, Math.round(Number(totalSeconds || 0)));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return safeSeconds > 0 ? "<1m" : "0m";
};

const formatAxisDuration = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds || 0));

  if (safeSeconds >= 3600) {
    const hours = safeSeconds / 3600;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
  }

  const minutes = Math.round(safeSeconds / 60);
  return `${minutes}m`;
};

function MyLearnings() {
  const [progress, setProgress] = useState({});
  const [attempts, setAttempts] = useState([]);
  const [completedCourses, setCompletedCourses] = useState({});
  const [courses, setCourses] = useState({});
  const [videos, setVideos] = useState({});
  const [learningActivity, setLearningActivity] = useState({});
  const [videoQuizAttempts, setVideoQuizAttempts] = useState([]);
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
          activitySnap,
          videoQuizAttemptsSnap,
        ] = await Promise.all([
          get(ref(database, `progress/${user.uid}`)),
          get(ref(database, `attempts/${user.uid}`)),
          get(ref(database, `completedCourses/${user.uid}`)),
          get(ref(database, "courses")),
          get(ref(database, "videos")),
          get(ref(database, "videoLibrary")),
          get(ref(database, `learningActivity/${user.uid}`)),
          get(ref(database, `videoQuizAttempts/${user.uid}`)),
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
        setLearningActivity(activitySnap.exists() ? activitySnap.val() : {});

        const revisionAttempts = videoQuizAttemptsSnap.exists()
          ? Object.entries(videoQuizAttemptsSnap.val()).map(([attemptId, item]) => ({
              id: attemptId,
              ...item,
            }))
          : [];
        setVideoQuizAttempts(revisionAttempts);

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

  const getAttemptPercent = (item) => {
    const rawScore = Number(item?.score ?? item?.correct ?? 0);
    const total = Number(item?.total ?? item?.totalQuestions ?? 0);

    if (total > 0 && rawScore <= total) {
      return Math.round((rawScore / total) * 100);
    }

    return Math.max(0, Math.min(100, Math.round(rawScore)));
  };

  const latestFinalAttemptByCourse = useMemo(() => {
    const latest = {};

    finalAttempts.forEach((attempt) => {
      const current = latest[attempt.courseId];
      const attemptTime = new Date(attempt.submittedAt || 0).getTime();
      const currentTime = new Date(current?.submittedAt || 0).getTime();

      if (!current || attemptTime > currentTime) latest[attempt.courseId] = attempt;
    });

    return latest;
  }, [finalAttempts]);

  const completedCourseValues = useMemo(() => {
    return Object.entries(completedCourses || {}).map(([courseId, item]) => ({
      courseId,
      ...item,
    }));
  }, [completedCourses]);

  const stats = useMemo(() => {
    const activityTotalSeconds = Object.values(
      learningActivity || {}
    ).reduce(
      (sum, dayData) => sum + collectActivitySeconds(dayData),
      0
    );

    const progressTotalSeconds = progressValues.reduce(
      (sum, item) => sum + getProgressWatchedSeconds(item),
      0
    );

    // New tracking uses learningActivity. Legacy users fall back to progress.
    // Never add both because that would double-count watched time.
    const totalSeconds =
      activityTotalSeconds > 0
        ? activityTotalSeconds
        : progressTotalSeconds;

    const completedVideos = progressValues.filter((item) => item.completed).length;

    const completedCourseIds = new Set(
      completedCourseValues
        .filter((item) => item.passed || item.completed)
        .map((item) => item.courseId)
    );

    Object.values(latestFinalAttemptByCourse).forEach((attempt) => {
      if (attempt.passed || getAttemptPercent(attempt) >= Number(attempt.passPercentage || 0)) {
        completedCourseIds.add(attempt.courseId);
      }
    });

    const coursesCompleted = completedCourseIds.size;

    const certificatesEarned = completedCourseValues.filter(
      (item) =>
        item.certificateUrl ||
        item.certificateId ||
        item.certificateIssuedAt ||
        item.issuedAt ||
        (item.passed && item.attemptId)
    ).length;

    const avgScore =
      finalAttempts.length > 0
        ? Math.round(
            finalAttempts.reduce((sum, item) => sum + getAttemptPercent(item), 0) /
              finalAttempts.length
          )
        : 0;

    const inProgressVideos = progressValues.filter(
      (item) => !item.completed && Number(item.watchedPercent || 0) > 0
    ).length;

    return {
      totalTime: formatDuration(totalSeconds),
      completedVideos,
      inProgressVideos,
      finalTestsTaken: finalAttempts.length,
      avgScore,
      coursesCompleted,
      certificatesEarned,
    };
  }, [
    progressValues,
    finalAttempts,
    completedCourseValues,
    latestFinalAttemptByCourse,
    learningActivity,
  ]);

  const recentActivities = useMemo(() => {
    const videoActivities = progressValues
      .map((item) => {
        const videoData = videos[item.videoId] || {};
        const courseData = courses[item.courseId] || {};
        const completed = Boolean(item.completed);

        return {
          id: `video-${item.videoId}`,
          type: completed ? "Video Completed" : "Video Progress",
          title:
            item.videoTitle ||
            videoData.title ||
            videoData.videoTitle ||
            "Training Video",
          subtitle:
            courseData.title ||
            courseData.courseTitle ||
            item.courseTitle ||
            "Training Course",
          date: completed ? item.completedAt || item.updatedAt : item.updatedAt,
          value: `${completed ? 100 : Math.round(Number(item.watchedPercent || 0))}%`,
        };
      })
      .filter((item) => item.date);

    const testActivities = finalAttempts
      .filter((item) => item.submittedAt)
      .map((item) => ({
        id: `final-${item.id}`,
        type: "Final Test",
        title:
          item.courseTitle ||
          courses[item.courseId]?.title ||
          courses[item.courseId]?.courseTitle ||
          "Course Test",
        subtitle: item.passed ? "Passed" : "Attempt completed",
        date: item.submittedAt,
        value: `${getAttemptPercent(item)}%`,
      }));

    const revisionActivities = videoQuizAttempts
      .filter((item) => item.submittedAt)
      .map((item) => ({
        id: `revision-${item.id}`,
        type: "Revision Quiz",
        title:
          item.videoTitle ||
          videos[item.videoId]?.title ||
          videos[item.videoId]?.videoTitle ||
          "Video Revision Quiz",
        subtitle:
          courses[item.courseId]?.title ||
          courses[item.courseId]?.courseTitle ||
          "Training Course",
        date: item.submittedAt,
        value: `${Number(item.correct || 0)}/${Number(item.total || 0)}`,
      }));

    return [...videoActivities, ...revisionActivities, ...testActivities]
      .sort(
        (a, b) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      )
      .slice(0, 5);
  }, [progressValues, finalAttempts, videoQuizAttempts, videos, courses]);

 const activityData = useMemo(() => {
    const today = new Date();
    const days = [];
    const dateFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    for (let i = range - 1; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const key = dateFormatter.format(date);

      days.push({
        key,
        label: date.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          timeZone: "Asia/Kolkata",
        }),
        seconds: 0,
      });
    }

    const dayMap = Object.fromEntries(days.map((day) => [day.key, day]));
    const activityDays = Object.keys(learningActivity || {});

    if (activityDays.length > 0) {
      activityDays.forEach((dayKey) => {
        if (!dayMap[dayKey]) return;

        dayMap[dayKey].seconds += collectActivitySeconds(
          learningActivity[dayKey]
        );
      });
    } else {
      // Legacy fallback: old progress records do not contain daily history.
      // Show each video's cumulative time only on its latest saved date.
      progressValues.forEach((item) => {
        const dateSource = item.completedAt || item.updatedAt;
        if (!dateSource) return;

        const dateKey = dateFormatter.format(new Date(dateSource));
        if (!dayMap[dateKey]) return;

        dayMap[dateKey].seconds += getProgressWatchedSeconds(item);
      });
    }

    return days.map((day) => ({
      ...day,
      seconds: Math.max(0, Math.round(day.seconds)),
    }));
  }, [learningActivity, progressValues, range]);

  const maxChartSeconds = useMemo(() => {
    const rawMax = Math.max(
      ...activityData.map((item) => item.seconds),
      0
    );

    if (rawMax <= 0) return 60;

    // Round the graph ceiling to a readable interval.
    const interval =
      rawMax <= 5 * 60
        ? 60
        : rawMax <= 30 * 60
          ? 5 * 60
          : rawMax <= 2 * 3600
            ? 15 * 60
            : 3600;

    return Math.ceil(rawMax / interval) * interval;
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
        (item.seconds / maxChartSeconds) * (height - paddingY * 2);

      return {
        ...item,
        x,
        y,
      };
    });
  }, [activityData, maxChartSeconds]);

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
              <span>{formatAxisDuration(maxChartSeconds)}</span>
              <span>{formatAxisDuration(maxChartSeconds * 0.66)}</span>
              <span>{formatAxisDuration(maxChartSeconds * 0.33)}</span>
              <span>0m</span>
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

          {activityData.every((item) => item.seconds === 0) && (
            <p className="learning-empty-note">
              No learning activity recorded in this period.
            </p>
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