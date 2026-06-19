import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ref, get } from "firebase/database";
import { database } from "../firebase";
import "../styles/admindashboard.css";

function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    departments: 0,
    courses: 0,
    videos: 0,
    questions: 0,
    completed: 0,
    certificates: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const usersSnap = await get(ref(database, "users"));
      const departmentsSnap = await get(ref(database, "departments"));
      const coursesSnap = await get(ref(database, "courses"));
      const videosSnap = await get(ref(database, "videos"));
      const questionsSnap = await get(ref(database, "questions"));
      const completedSnap = await get(ref(database, "completedCourses"));
      const resultsSnap = await get(ref(database, "results"));

      const users = usersSnap.exists()
        ? Object.values(usersSnap.val()).filter((u) => u.role !== "superAdmin")
            .length
        : 0;

      const departments = departmentsSnap.exists()
        ? Object.keys(departmentsSnap.val()).length
        : 0;

      const courses = coursesSnap.exists()
        ? Object.keys(coursesSnap.val()).length
        : 0;

      const videos = videosSnap.exists()
        ? Object.keys(videosSnap.val()).length
        : 0;

      let questions = 0;
      if (questionsSnap.exists()) {
        Object.values(questionsSnap.val()).forEach((videoQuestions) => {
          questions += Object.keys(videoQuestions).length;
        });
      }

      let completed = 0;
      if (completedSnap.exists()) {
        Object.values(completedSnap.val()).forEach((userCourses) => {
          completed += Object.keys(userCourses).length;
        });
      }

      let certificates = 0;
      if (resultsSnap.exists()) {
        Object.values(resultsSnap.val()).forEach((userResults) => {
          Object.values(userResults).forEach((result) => {
            if (result.passed) certificates += 1;
          });
        });
      }

      setStats({
        users,
        departments,
        courses,
        videos,
        questions,
        completed,
        certificates,
      });
    };

    fetchStats();
  }, []);

  const totalPossible = stats.users * stats.courses;

  const completionRate =
    totalPossible > 0
      ? Math.min(Math.round((stats.completed / totalPossible) * 100), 100)
      : 0;

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Manage users, courses, training assignments and reports.</p>
        </div>

        <img src="/Logo.webp" alt="Logo" />
      </div>

      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <span>Total Users</span>
          <h2>{stats.users}</h2>
        </div>

        <div className="admin-kpi-card">
          <span>Departments</span>
          <h2>{stats.departments}</h2>
        </div>

        <div className="admin-kpi-card">
          <span>Courses</span>
          <h2>{stats.courses}</h2>
        </div>

        <div className="admin-kpi-card">
          <span>Videos</span>
          <h2>{stats.videos}</h2>
        </div>

        <div className="admin-kpi-card">
          <span>Questions</span>
          <h2>{stats.questions}</h2>
        </div>

        <div className="admin-kpi-card primary">
          <span>Completion</span>
          <h2>{completionRate}%</h2>
        </div>
      </div>

      <div className="admin-main-grid">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <span>Quick Actions</span>
            <h2>Training Operations</h2>
          </div>

          <div className="admin-action-grid">
            <Link to="/admin/users">
              <h3>Manage Users</h3>
              <p>Add, edit, remove and reset employee accounts.</p>
              <strong>Open →</strong>
            </Link>

            <Link to="/admin/add-course">
              <h3>Create Course</h3>
              <p>Create training course with videos and quiz.</p>
              <strong>Create →</strong>
            </Link>

            <Link to="/admin/courses">
              <h3>Manage Courses</h3>
              <p>Edit courses, videos and questions from one place.</p>
              <strong>Manage →</strong>
            </Link>

            <Link to="/admin/assignments">
              <h3>Assign Training</h3>
              <p>Assign courses by zone, state, city and designation.</p>
              <strong>Assign →</strong>
            </Link>
          </div>
        </div>

        <div className="admin-panel progress-panel">
          <div className="admin-panel-head">
            <span>Overview</span>
            <h2>Training Progress</h2>
          </div>

          <div className="progress-circle">
            <div>{completionRate}%</div>
          </div>

          <p>Overall company training completion rate.</p>

          <div className="mini-stats">
            <div>
              <span>Completed</span>
              <strong>{stats.completed}</strong>
            </div>

            <div>
              <span>Certificates</span>
              <strong>{stats.certificates}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-bottom-grid">
        <div className="admin-panel">
          <h2>Recommended Workflow</h2>

          <div className="workflow-steps">
            <div>
              <strong>01</strong>
              <p>Create Users</p>
            </div>

            <div>
              <strong>02</strong>
              <p>Create Course</p>
            </div>

            <div>
              <strong>03</strong>
              <p>Assign Training</p>
            </div>

            <div>
              <strong>04</strong>
              <p>Track Reports</p>
            </div>
          </div>
        </div>

        <div className="admin-panel">
          <h2>Reports</h2>

          <div className="report-links">
            <Link to="/admin/results">View Training Results</Link>
            <Link to="/dashboard">My Learnings</Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default AdminDashboard;