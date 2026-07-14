import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/departmenttraininganalytics.css";
import * as XLSX from "xlsx";

function DepartmentTrainingAnalytics() {
  const [currentUser, setCurrentUser] = useState(null);

  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);

  const [assignments, setAssignments] = useState({});
  const [completedCourses, setCompletedCourses] = useState({});
  const [progress, setProgress] = useState({});

  const [loading, setLoading] = useState(true);

  const [selectedCourseId, setSelectedCourseId] = useState("");

  // search
  const [search, setSearch] = useState("");

  // NEW
  const [selectedStatus, setSelectedStatus] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) {
        setLoading(false);
        return;
      }

      try {
        const userSnap = await get(
          ref(database, `users/${loggedUser.uid}`)
        );

        if (!userSnap.exists()) {
          setLoading(false);
          return;
        }

        const adminData = {
          id: loggedUser.uid,
          email: loggedUser.email,
          ...userSnap.val(),
        };

        setCurrentUser(adminData);

        const [
          coursesSnap,
          usersSnap,
          assignmentSnap,
          completedSnap,
          progressSnap,
        ] = await Promise.all([
          get(ref(database, "courses")),
          get(ref(database, "users")),
          get(ref(database, "userAssignments")),
          get(ref(database, "completedCourses")),
          get(ref(database, "progress")),
        ]);

        const allCourses = coursesSnap.exists()
          ? Object.entries(coursesSnap.val()).map(([id, value]) => ({
              id,
              ...value,
            }))
          : [];

        const canSeeAllCourses =
          adminData.role === "admin" ||
          adminData.role === "superAdmin";

        const visibleCourses = canSeeAllCourses
          ? allCourses
          : allCourses.filter(
              (course) =>
                course.createdBy === adminData.id ||
                course.createdByEmail === adminData.email ||
                course.department === adminData.department
            );

        const allUsers = usersSnap.exists()
          ? Object.entries(usersSnap.val()).map(([id, value]) => ({
              id,
              ...value,
            }))
          : [];

        const canSeeAllUsers =
          adminData.role === "admin" ||
          adminData.role === "superAdmin" ||
          adminData.role === "superadmin" ||
          adminData.role === "departmentAdmin";

        const visibleUsers = canSeeAllUsers
          ? allUsers.filter(
              (u) =>
                u.role !== "admin" &&
                u.role !== "superAdmin" &&
                u.role !== "superadmin"
            )
          : allUsers.filter(
              (u) =>
                u.role !== "admin" &&
                u.role !== "superAdmin" &&
                u.role !== "superadmin" &&
                u.role !== "departmentAdmin"
            );

        setCourses(visibleCourses);
        setUsers(visibleUsers);

        setAssignments(
          assignmentSnap.exists() ? assignmentSnap.val() : {}
        );

        setCompletedCourses(
          completedSnap.exists() ? completedSnap.val() : {}
        );

        setProgress(
          progressSnap.exists() ? progressSnap.val() : {}
        );
      } catch (err) {
        console.error(err);
        alert("Unable to load analytics.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const getCourseStatusForUser = (userId, courseId) => {
    const assigned =
      assignments?.[userId]?.[courseId]?.assigned;

    if (!assigned) return "notAssigned";

    const completed =
      completedCourses?.[userId]?.[courseId];

    if (completed?.passed || completed?.completed)
      return "completed";

    const userProgress = progress?.[userId] || {};

    const hasStarted = Object.values(userProgress).some(
      (video) =>
        video.courseId === courseId &&
        (Number(video.watchedPercent || 0) > 0 ||
          video.completed)
    );

    return hasStarted ? "inProgress" : "notStarted";
  };

  const courseStats = useMemo(() => {
    return courses.map((course) => {
      let assigned = 0;
      let completed = 0;
      let inProgress = 0;
      let notStarted = 0;

      users.forEach((user) => {
        const status = getCourseStatusForUser(
          user.id,
          course.id
        );

        if (status === "notAssigned") return;

        assigned++;

        if (status === "completed") completed++;

        if (status === "inProgress") inProgress++;

        if (status === "notStarted") notStarted++;
      });

      return {
        ...course,
        assigned,
        completed,
        inProgress,
        notStarted,
      };
    });
  }, [
    courses,
    users,
    assignments,
    completedCourses,
    progress,
  ]);

  const selectedCourse = courseStats.find(
    (course) => course.id === selectedCourseId
  );

  const selectedUsers = useMemo(() => {
    if (!selectedCourseId) return [];

    return users
      .map((user) => ({
        ...user,
        status: getCourseStatusForUser(
          user.id,
          selectedCourseId
        ),
      }))
      .filter((user) => {
        if (user.status === "notAssigned") return false;

        const searchText = [
          user.name,
          user.email,
          user.designation,
          user.userRole,
          user.city,
          user.cityArea,
          user.area,
          user.state,
          user.zone,
          user.department,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const searchMatch = searchText.includes(
          search.toLowerCase()
        );

        const statusMatch = selectedStatus
          ? user.status === selectedStatus
          : true;

        return searchMatch && statusMatch;
      });
  }, [
    users,
    selectedCourseId,
    search,
    selectedStatus,
    assignments,
    completedCourses,
    progress,
  ]);

const downloadDepartmentReport = () => {
  if (!selectedCourse) {
    alert("Please select a course first.");
    return;
  }

  const reportData = selectedUsers.map((user) => ({
    Name: user.name || "",
    Email: user.email || "",
    Designation: user.designation || user.userRole || "",
    Department: user.department || "",
    City: user.city || user.cityArea || user.area || "",
    State: user.state || "",
    Zone: user.zone || "",
    Status:
      user.status === "completed"
        ? "Completed"
        : user.status === "inProgress"
        ? "In Progress"
        : "Not Started",
  }));

  const worksheet = XLSX.utils.json_to_sheet(reportData);

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Department Report"
  );

  XLSX.writeFile(
    workbook,
    `${selectedCourse.title || "Department"}_Report.xlsx`
  );
};

  if (loading) {
  return (
    <div className="training-analytics-page loading-page">
      Loading Training Analytics...
    </div>
  );
}

return (
  <div className="training-analytics-page">

    {/* Top Right Button Only */}

    <div className="analytics-topbar">
  <button
    className="download-report-btn"
    onClick={downloadDepartmentReport}
  >
    Download Department Report
  </button>
</div>

    {/* Course List */}

    <section className="course-section">

      <div className="section-heading">
        <h2>Training Courses</h2>
        <p>
          Click any course to view learner progress.
        </p>
      </div>

      {courseStats.length === 0 ? (
        <div className="empty-course-box">
          No Courses Found
        </div>
      ) : (

        <div className="course-grid">

          {courseStats.map((course) => (

            <div
              key={course.id}
              onClick={() => {
                setSelectedCourseId(course.id);
                setSelectedStatus("");
              }}
              className={`course-card ${
                selectedCourseId === course.id
                  ? "active"
                  : ""
              }`}
            >

              <div className="course-card-top">

                <div>

                  <h3>
                    {course.title ||
                      course.courseTitle ||
                      "Untitled Course"}
                  </h3>

                  <span>
                    {course.department || "General"}
                  </span>

                </div>

                <div className="course-arrow">
                  →
                </div>

              </div>

              <div className="course-info">

                <div>

                  <strong>
                    {course.assigned}
                  </strong>

                  <small>
                    Assigned
                  </small>

                </div>

                <div>

                  <strong>
                    {course.completed}
                  </strong>

                  <small>
                    Completed
                  </small>

                </div>

              </div>

            </div>

          ))}

        </div>

      )}

    </section>

    {selectedCourse && (
  <section className="analytics-card">

    {/* Course Header */}

    <div className="selected-course-header">

      <div>

        <h2>
          {selectedCourse.title ||
            selectedCourse.courseTitle}
        </h2>

        <p>
          {selectedCourse.department || "General Department"}
        </p>

      </div>

      <div className="selected-course-count">

        <span>Assigned Users</span>

        <h2>{selectedCourse.assigned}</h2>

      </div>

    </div>

    {/* Status Cards */}

    <div className="status-grid">

      <div
        className={`status-card notstarted ${
          selectedStatus === "notStarted"
            ? "active"
            : ""
        }`}
        onClick={() =>
          setSelectedStatus(
            selectedStatus === "notStarted"
              ? ""
              : "notStarted"
          )
        }
      >

        <small>
          Not Started
        </small>

        <h2>
          {selectedCourse.notStarted}
        </h2>

      </div>

      <div
        className={`status-card progress ${
          selectedStatus === "inProgress"
            ? "active"
            : ""
        }`}
        onClick={() =>
          setSelectedStatus(
            selectedStatus === "inProgress"
              ? ""
              : "inProgress"
          )
        }
      >

        <small>
          In Progress
        </small>

        <h2>
          {selectedCourse.inProgress}
        </h2>

      </div>

      <div
        className={`status-card completed ${
          selectedStatus === "completed"
            ? "active"
            : ""
        }`}
        onClick={() =>
          setSelectedStatus(
            selectedStatus === "completed"
              ? ""
              : "completed"
          )
        }
      >

        <small>
          Completed
        </small>

        <h2>
          {selectedCourse.completed}
        </h2>

      </div>

    </div>

    {/* Search */}

    <div className="analytics-search">

      <input
        type="text"
        placeholder="Search user, designation, city..."
        value={search}
        onChange={(e) =>
          setSearch(e.target.value)
        }
      />

      {selectedStatus && (
        <button
          className="clear-filter-btn"
          onClick={() =>
            setSelectedStatus("")
          }
        >
          Clear Filter
        </button>
      )}

    </div>

    <div className="user-progress-table-wrap">

  <table className="user-progress-table">

    <thead>

      <tr>

        <th>User</th>

        <th>Designation</th>

        <th>Department</th>

        <th>Location</th>

        <th>Status</th>

      </tr>

    </thead>

    <tbody>

      {selectedUsers.length > 0 ? (

        selectedUsers.map((user) => (

          <tr key={user.id}>

            <td>

              <div className="user-cell">

                <strong>
                  {user.name || "Unnamed User"}
                </strong>

                <small>
                  {user.email}
                </small>

              </div>

            </td>

            <td>
              {user.designation ||
                user.userRole ||
                "-"}
            </td>

            <td>
              {user.department || "-"}
            </td>

            <td>

              {[
                user.city ||
                  user.cityArea ||
                  user.area,
                user.state,
                user.zone,
              ]
                .filter(Boolean)
                .join(", ") || "-"}

            </td>

            <td>

              <span
                className={`status-pill ${user.status}`}
              >

                {user.status === "completed"
                  ? "Completed"
                  : user.status ===
                    "inProgress"
                  ? "In Progress"
                  : "Not Started"}

              </span>

            </td>

          </tr>

        ))

      ) : (

        <tr>

          <td
            colSpan="5"
            className="empty-cell"
          >

            No users found.

          </td>

        </tr>

      )}

    </tbody>

  </table>
</div>

  </section>
)}

</div>
);
}

export default DepartmentTrainingAnalytics;