import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import { signOut } from "firebase/auth";
import { database, auth } from "../firebase";
import "../styles/admindashboard.css";

function AdminDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    users: 0,
    courses: 0,
    videos: 0,
    questions: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const usersSnap = await get(ref(database, "users"));
      const coursesSnap = await get(ref(database, "courses"));
      const videosSnap = await get(ref(database, "videos"));
      const questionsSnap = await get(ref(database, "questions"));

      const users = usersSnap.exists() ? Object.keys(usersSnap.val()).length : 0;
      const courses = coursesSnap.exists()
        ? Object.keys(coursesSnap.val()).length
        : 0;
      const videos = videosSnap.exists()
        ? Object.keys(videosSnap.val()).length
        : 0;

      let questions = 0;

      if (questionsSnap.exists()) {
        const qData = questionsSnap.val();
        Object.keys(qData).forEach((videoId) => {
          questions += Object.keys(qData[videoId]).length;
        });
      }

      setStats({ users, courses, videos, questions });
    };

    fetchStats();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <div className="admin-dashboard-container">
    <div className="admin-hero">
  <div className="hero-left">
    <img
      src="/Logo.webp"
      alt="Zuvius Lifesciences"
      className="admin-logo"
    />

    <div>
      <h1>Training Portal Admin</h1>
      <p>
        Manage courses, videos, quizzes and employee training records.
      </p>
    </div>
  </div>

  <div className="admin-hero-actions">
    <Link to="/dashboard" className="btn-light">
      User Dashboard
    </Link>

    <button onClick={handleLogout} className="btn-danger">
      Logout
    </button>
  </div>
</div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <span>Users</span>
          <h2>{stats.users}</h2>
        </div>

        <div className="admin-stat-card">
          <span>Courses</span>
          <h2>{stats.courses}</h2>
        </div>

        <div className="admin-stat-card">
          <span>Videos</span>
          <h2>{stats.videos}</h2>
        </div>

        <div className="admin-stat-card">
          <span>Questions</span>
          <h2>{stats.questions}</h2>
        </div>
      </div>

      <div className="admin-workspace-card">
  <div className="workspace-heading">
    <span>Course Management</span>
    <h2>What would you like to do?</h2>
  </div>

  <div className="admin-main-actions two-actions">
    <Link to="/admin/add-course" className="admin-action-card primary">
      <div>
        <h3>Add New Course</h3>
        <p>
          Create a course, add videos, attach quiz questions and save everything
          in one flow.
        </p>
      </div>
      <span>Start →</span>
    </Link>

    <Link to="/admin/courses" className="admin-action-card">
      <div>
        <h3>Manage Courses</h3>
        <p>
          Select department and course, then edit videos and questions from one
          place.
        </p>
      </div>
      <span>Open →</span>
    </Link>
  </div>
</div>

<div className="admin-guide-card">
  <div className="guide-content">
    <span>Recommended Workflow</span>
    <h2>Course setup in 3 simple steps</h2>
    <p>
      First create a course, then add videos inside it, and finally attach quiz
      questions to each video.
    </p>
  </div>

  <div className="guide-steps">
    <div>
      <strong>01</strong>
      <p>Create Course</p>
    </div>

    <div>
      <strong>02</strong>
      <p>Add Videos</p>
    </div>

    <div>
      <strong>03</strong>
      <p>Add Questions</p>
    </div>
  </div>
</div>
    </div>

    
  );
}

export default AdminDashboard;