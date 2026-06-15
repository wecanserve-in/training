import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/dashboard.css";

const ADMIN_EMAIL = "wemedialabs@gmail.com";

function Dashboard() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [userDepartment, setUserDepartment] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/");
        return;
      }

      try {
        const isAdmin = user.email === ADMIN_EMAIL;
        let department = "";

        if (isAdmin) {
          department = "Admin";
          setUserDepartment("Admin");
        } else {
          const userSnapshot = await get(ref(database, `users/${user.uid}`));

          if (!userSnapshot.exists()) {
            alert("User data not found");
            navigate("/");
            return;
          }

          const userData = userSnapshot.val();
          department = userData.department || "";

          if (!department) {
            alert("Department not assigned. Please contact admin.");
            navigate("/");
            return;
          }

          setUserDepartment(department);
        }

        const coursesSnapshot = await get(ref(database, "courses"));

        if (coursesSnapshot.exists()) {
          const data = coursesSnapshot.val();

          let courseArray = Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));

          if (!isAdmin) {
            courseArray = courseArray.filter(
              (course) => course.department === department
            );
          }

          setCourses(courseArray);
        } else {
          setCourses([]);
        }

        setLoading(false);
      } catch (error) {
        console.error(error);
        alert("Failed to load dashboard");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const emptyMessage =
    userDepartment === "Admin"
      ? "No courses found."
      : `No courses found for ${userDepartment}.`;

  const renderCourseCard = (course) => {
    return (
      <div key={course.id} className="course-card">
        <div className="course-content">
          <div className="course-top">
            <span className="course-tag">
              {course.department || "Department Not Set"}
            </span>

            <span className="course-status pending">Course</span>
          </div>

          <h2>{course.title}</h2>

          <p className="course-desc">
            {course.description || "Open this course to view training videos."}
          </p>

          <div className="course-actions">
            <Link to={`/course/${course.id}`}>
              <button className="btn-action">View Course</button>
            </Link>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <h2 className="dashboard-loading">Loading Dashboard...</h2>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="dashboard-welcome">
          <h1>Training Dashboard</h1>
          <h3>Welcome, {auth.currentUser?.displayName || "User"}</h3>

          <p className="user-department">
            {userDepartment === "Admin"
              ? "Admin View: All Departments"
              : `Department: ${userDepartment}`}
          </p>
        </div>

        <div className="dashboard-actions">
          <button
            onClick={() => navigate("/my-results")}
            className="btn-secondary"
          >
            My Results
          </button>

          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      </div>

      {courses.length === 0 ? (
        <p className="no-data-msg">{emptyMessage}</p>
      ) : (
        <div className="course-section">
          <h2 className="section-title">Available Courses</h2>

          <div className="horizontal-course-row">
            {courses.map((course) => renderCourseCard(course))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;