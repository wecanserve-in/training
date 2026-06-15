import { useEffect, useState } from "react";
import { ref, get, remove } from "firebase/database";
import { database } from "../firebase";
import { Link } from "react-router-dom";
import "../styles/managevideos.css";

function ManageCourses() {
  const [courses, setCourses] = useState([]);

  const fetchCourses = async () => {
    const snapshot = await get(ref(database, "courses"));

    if (snapshot.exists()) {
      const data = snapshot.val();

      const courseArray = Object.keys(data).map((key) => ({
        id: key,
        ...data[key],
      }));

      setCourses(courseArray);
    } else {
      setCourses([]);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this course?"
    );

    if (!confirmDelete) return;

    await remove(ref(database, `courses/${id}`));
    fetchCourses();
  };

  return (
    <div className="manage-catalog-container">
      <div className="catalog-header-row">
        <div>
          <div className="back-link-wrapper">
            <Link to="/admin" className="btn-catalog-back">
              ← Admin Dashboard
            </Link>
          </div>

          <h1 className="catalog-main-title">Manage Courses</h1>

          <p className="catalog-subtitle">
            View and manage department-wise product/topic courses.
          </p>
        </div>

        <Link to="/admin/add-course" className="btn-catalog-create-new">
          + Add New Course
        </Link>
      </div>

      <div className="table-card-wrapper">
        {courses.length === 0 ? (
          <div className="empty-catalog-fallback">
            <p>No courses found. Add your first course.</p>
          </div>
        ) : (
          <table className="admin-data-table">
            <thead>
              <tr>
                <th style={{ width: "30%" }}>Course Name</th>
                <th style={{ width: "20%" }}>Department</th>
                <th style={{ width: "35%" }}>Description</th>
                <th style={{ width: "15%", textAlign: "right" }}>
                  Operations
                </th>
              </tr>
            </thead>

            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <td>
                    <div className="table-cell-title">{course.title}</div>
                    <code className="table-cell-code-route">{course.id}</code>
                  </td>

                  <td>
                    <span className="badge-metric accent-blue">
                      {course.department}
                    </span>
                  </td>

                  <td>
                    <div className="table-cell-desc-truncate">
                      {course.description}
                    </div>
                  </td>

                  <td>
                    <div className="table-actions-cell-group">
                      <button
                        onClick={() => handleDelete(course.id)}
                        className="btn-action-table-delete"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default ManageCourses;