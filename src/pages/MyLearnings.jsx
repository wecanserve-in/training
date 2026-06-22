import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/mylearnings.css";

function MyLearnings() {
  const [progress, setProgress] = useState({});
  const [attempts, setAttempts] = useState([]);
  const [range, setRange] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        const [progressSnap, attemptsSnap] = await Promise.all([
          get(ref(database, `progress/${user.uid}`)),
          get(ref(database, "attempts")),
        ]);

        setProgress(progressSnap.exists() ? progressSnap.val() : {});

        if (attemptsSnap.exists()) {
          const data = attemptsSnap.val();

          const userAttempts = Object.values(data).filter(
            (item) => item.userId === user.uid
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
    return Object.values(progress || {});
  }, [progress]);

  const stats = useMemo(() => {
    const totalSeconds = progressValues.reduce((sum, item) => {
      const duration = Number(item.duration || 0);
      const watchedPercent = Number(item.watchedPercent || 0);

      return sum + duration * (watchedPercent / 100);
    }, 0);

    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMinutes = Math.floor((totalSeconds % 3600) / 60);

    const videosWatched = progressValues.filter((item) => item.completed).length;
    const quizzesTaken = attempts.length;

    const avgScore =
      attempts.length > 0
        ? Math.round(
            attempts.reduce((sum, item) => sum + Number(item.score || 0), 0) /
              attempts.length
          )
        : 0;

    return {
      totalTime: `${totalHours}h ${totalMinutes}m`,
      videosWatched,
      quizzesTaken,
      avgScore,
    };
  }, [progressValues, attempts]);

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

      const watchedSeconds =
        Number(item.duration || 0) * (Number(item.watchedPercent || 0) / 100);

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
    const paddingX = 20;
    const paddingY = 24;

    if (activityData.length === 0) return [];

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
    if (chartPoints.length === 0) return "";

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

  if (loading) return <h2 className="learning-loading">Loading Learnings...</h2>;

  return (
    <div className="my-learning-page">
      <div className="learning-header">
        <h1>My Learnings</h1>
        <p>Your learning journey overview.</p>
      </div>

      <div className="learning-kpi-grid">
        <div className="learning-kpi-card">
          <div className="learning-icon green"></div>
          <span>Total Hours</span>
          <h2>{stats.totalTime}</h2>
        </div>

        <div className="learning-kpi-card">
          <div className="learning-icon blue"></div>
          <span>Videos Watched</span>
          <h2>{stats.videosWatched}</h2>
        </div>

        <div className="learning-kpi-card">
          <div className="learning-icon green"></div>
          <span>Quizzes Taken</span>
          <h2>{stats.quizzesTaken}</h2>
        </div>

        <div className="learning-kpi-card">
          <div className="learning-icon purple"></div>
          <span>Avg Score</span>
          <h2>{stats.avgScore}%</h2>
        </div>
      </div>

      <div className="learning-chart-card">
        <div className="learning-chart-head">
          <h2>Learning Activity</h2>

          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
          >
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
              {areaD && <path d={areaD} fill="rgba(6,150,79,0.08)" />}

              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#06964f"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {chartPoints.map((point) => (
                <circle
                  key={point.key}
                  cx={point.x}
                  cy={point.y}
                  r="6"
                  fill="#06964f"
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
          <p className="learning-empty-note">
            No learning activity recorded yet.
          </p>
        )}
      </div>
    </div>
  );
}

export default MyLearnings;