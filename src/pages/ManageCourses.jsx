import { useEffect, useState } from "react";
import { ref, get, remove } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { database, auth } from "../firebase";
import { Link, useNavigate } from "react-router-dom";
import "../styles/managevideos.css";

function ManageCourses() {
  const navigate = useNavigate();

  const departments = ["Sales", "Marketing", "HR", "Production", "Accounts"];

  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState("");

  const [courses, setCourses] = useState([]);
  const [videos, setVideos] = useState([]);
  const [questionsCount, setQuestionsCount] = useState({});

  const [department, setDepartment] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");

  const isDepartmentAdmin = userRole === "departmentAdmin";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) return;

      const userSnap = await get(ref(database, `users/${loggedUser.uid}`));

      if (userSnap.exists()) {
        const userData = {
          id: loggedUser.uid,
          ...userSnap.val(),
        };

        setCurrentUser(userData);
        setUserRole(userData.role || "");

        if (userData.role === "departmentAdmin") {
          setDepartment(userData.department || "");
        }
      }

      fetchData();
    });

    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
    const coursesSnap = await get(ref(database, "courses"));
    const videosSnap = await get(ref(database, "videos"));
    const questionsSnap = await get(ref(database, "questions"));

    if (coursesSnap.exists()) {
      const data = coursesSnap.val();

      const courseArray = Object.keys(data).map((key) => ({
        id: key,
        ...data[key],
      }));

      setCourses(courseArray);
    } else {
      setCourses([]);
    }

    if (videosSnap.exists()) {
      const data = videosSnap.val();

      const videoArray = Object.keys(data).map((key) => ({
        id: key,
        ...data[key],
      }));

      setVideos(videoArray);
    } else {
      setVideos([]);
    }

    if (questionsSnap.exists()) {
      const data = questionsSnap.val();
      const countObj = {};

      Object.keys(data).forEach((videoId) => {
        countObj[videoId] = Object.keys(data[videoId]).length;
      });

      setQuestionsCount(countObj);
    } else {
      setQuestionsCount({});
    }
  };

  const filteredCourses = courses.filter((course) => {
    if (!department) return false;
    return course.department === department;
  });

  const selectedCourse = courses.find(
    (course) => course.id === selectedCourseId
  );

  const courseVideos = videos.filter(
    (video) => video.courseId === selectedCourseId
  );

  const totalQuestions = courseVideos.reduce((total, video) => {
    return total + (questionsCount[video.id] || 0);
  }, 0);

  const handleDeleteCourse = async () => {
    if (!selectedCourseId) return;

    const confirmDelete = window.confirm(
      "Delete this course? Videos and questions linked to this course will remain unless you delete them separately."
    );

    if (!confirmDelete) return;

    await remove(ref(database, `courses/${selectedCourseId}`));

    setSelectedCourseId("");
    fetchData();
  };

  const dashboardPath = isDepartmentAdmin ? "/department-admin" : "/admin";

  const createCoursePath = isDepartmentAdmin
    ? "/department-admin/courses/create"
    : "/admin/add-course";

  const videosPath = isDepartmentAdmin
    ? "/department-admin/videos"
    : "/admin/videos";

  const questionsPath = isDepartmentAdmin
    ? "/department-admin/questions"
    : "/admin/questions";

  return (
    <div className="manage-catalog-container">
      <div className="catalog-header-row">
        <div>
          <div className="back-link-wrapper">
            <Link to={dashboardPath} className="btn-catalog-back">
              ← {isDepartmentAdmin ? "Department Dashboard" : "Admin Dashboard"}
            </Link>
          </div>

          <h1 className="catalog-main-title">Manage Courses</h1>

          <p className="catalog-subtitle">
            Select a department and course to manage videos and questions from
            one place.
          </p>
        </div>

        <Link to={createCoursePath} className="btn-catalog-create-new">
          + Add New Course
        </Link>
      </div>

      <div className="course-manage-panel">
        <div className="course-filter-grid">
          <div className="admin-input-group">
            <label className="admin-field-label">Department</label>

            {isDepartmentAdmin ? (
              <input value={department} className="admin-form-input" disabled />
            ) : (
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setSelectedCourseId("");
                }}
                className="admin-form-input"
              >
                <option value="">Select Department</option>

                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="admin-input-group">
            <label className="admin-field-label">Course</label>

            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="admin-form-input"
              disabled={!department}
            >
              <option value="">
                {department ? "Select Course" : "Select Department First"}
              </option>

              {filteredCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!department ? (
          <div className="empty-catalog-fallback">
            <p>Please select a department to begin.</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="empty-catalog-fallback">
            <p>No courses found for {department}.</p>
          </div>
        ) : !selectedCourse ? (
          <div className="empty-catalog-fallback">
            <p>Select a course to view its videos and questions.</p>
          </div>
        ) : (
          <div className="selected-course-workspace">
            <div className="selected-course-header">
              <div>
                <span>{selectedCourse.department}</span>
                <h2>{selectedCourse.title}</h2>
                <p>{selectedCourse.description}</p>
              </div>

              <button
                type="button"
                className="btn-action-table-delete"
                onClick={handleDeleteCourse}
              >
                Delete Course
              </button>
            </div>

            <div className="course-summary-grid">
              <div>
                <span>Videos</span>
                <strong>{courseVideos.length}</strong>
              </div>

              <div>
                <span>Questions</span>
                <strong>{totalQuestions}</strong>
              </div>

              <div>
                <span>Department</span>
                <strong>{selectedCourse.department}</strong>
              </div>
            </div>

            <div className="course-management-actions">
              <button
                type="button"
                onClick={() => navigate(videosPath)}
                className="course-manage-action"
              >
                <h3>Edit Videos</h3>
                <p>Update video title, file, duration and passing score.</p>
              </button>

              <button
                type="button"
                onClick={() => navigate(questionsPath)}
                className="course-manage-action"
              >
                <h3>Edit Questions</h3>
                <p>View, edit, delete or add assessment questions.</p>
              </button>
            </div>

            <div className="table-card-wrapper compact-course-table">
              {courseVideos.length === 0 ? (
                <div className="empty-catalog-fallback">
                  <p>No videos added in this course.</p>
                </div>
              ) : (
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>Video</th>
                      <th>File</th>
                      <th style={{ textAlign: "center" }}>Pass %</th>
                      <th style={{ textAlign: "center" }}>Questions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {courseVideos.map((video) => (
                      <tr key={video.id}>
                        <td>
                          <div className="table-cell-title">{video.title}</div>
                          <div className="table-cell-desc-truncate">
                            {video.description}
                          </div>
                        </td>

                        <td>
                          <code className="table-cell-code-route">
                            {video.videoFileName || video.videoUrl}
                          </code>
                        </td>

                        <td style={{ textAlign: "center" }}>
                          <span className="badge-metric accent-blue">
                            {video.passingScore}%
                          </span>
                        </td>

                        <td style={{ textAlign: "center" }}>
                          <span className="badge-metric accent-grey">
                            {questionsCount[video.id] || 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ManageCourses;