import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, update } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/departmentassigntraining.css";

function DepartmentMembers() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState({});

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [quickUserId, setQuickUserId] = useState("");
  const [quickCourseId, setQuickCourseId] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) return;

      const userSnap = await get(ref(database, `users/${loggedUser.uid}`));
      if (!userSnap.exists()) return;

      const adminData = {
        id: loggedUser.uid,
        ...userSnap.val(),
      };

      setCurrentUser(adminData);
      await fetchData(adminData.department);
    });

    return () => unsubscribe();
  }, []);

  const fetchData = async (departmentName) => {
    const usersSnap = await get(ref(database, "users"));
    const coursesSnap = await get(ref(database, "courses"));
    const assignmentsSnap = await get(ref(database, "userAssignments"));

    if (usersSnap.exists()) {
      const allUsers = Object.entries(usersSnap.val())
        .map(([id, user]) => ({ id, ...user }))
        .filter(
          (user) =>
            user.role !== "departmentAdmin" &&
            user.role !== "admin" &&
            user.role !== "superAdmin"
        );

      setUsers(allUsers);
    } else {
      setUsers([]);
    }

    if (coursesSnap.exists()) {
      const ownCourses = Object.entries(coursesSnap.val())
        .map(([id, course]) => ({ id, ...course }))
        .filter((course) => course.department === departmentName);

      setCourses(ownCourses);
    } else {
      setCourses([]);
    }

    setAssignments(assignmentsSnap.exists() ? assignmentsSnap.val() : {});
  };

  const getUserById = (userId) => {
    return users.find((user) => user.id === userId);
  };

  const getAssignedUsersForCourse = (courseId) => {
    return users.filter((user) => assignments[user.id]?.[courseId]?.assigned);
  };

  const getAvailableCoursesForUser = (userId) => {
    return courses.filter((course) => !assignments[userId]?.[course.id]?.assigned);
  };

  const courseWiseData = useMemo(() => {
    return courses.map((course) => {
      const assignedUsers = getAssignedUsersForCourse(course.id);

      const filteredAssignedUsers = assignedUsers.filter((user) => {
        const text = `${user.name || ""} ${user.email || ""} ${
          user.designation || ""
        } ${user.zone || ""} ${user.state || ""} ${
          user.cityArea || user.city || user.area || ""
        }`.toLowerCase();

        return text.includes(search.toLowerCase());
      });

      return {
        ...course,
        assignedUsers: filteredAssignedUsers,
        totalAssigned: assignedUsers.length,
      };
    });
  }, [courses, users, assignments, search]);

  const assignCourseToUser = async (userId, courseId) => {
    if (!userId || !courseId) {
      alert("Select course first");
      return;
    }

    const course = courses.find((item) => item.id === courseId);

    setLoading(true);

    await update(ref(database), {
      [`userAssignments/${userId}/${courseId}`]: {
        assigned: true,
        courseId,
        courseTitle: course?.title || course?.courseTitle || "",
        courseDepartment: course?.department || currentUser?.department || "",
        assignedByDepartment: currentUser?.department || "",
        assignedBy: currentUser?.id || "",
        assignedByName: currentUser?.name || "",
        assignedAt: new Date().toISOString(),
      },
    });

    await fetchData(currentUser.department);

    setQuickUserId("");
    setQuickCourseId("");
    setLoading(false);
  };

  const removeCourseFromUser = async (userId, courseId) => {
    if (!window.confirm("Remove this course from user?")) return;

    const course = courses.find((item) => item.id === courseId);

    setLoading(true);

    await update(ref(database), {
      [`userAssignments/${userId}/${courseId}`]: null,
      [`unassignedLogs/${courseId}/${userId}`]: {
        courseId,
        courseTitle: course?.title || course?.courseTitle || "",
        userId,
        courseDepartment: course?.department || currentUser?.department || "",
        unassignedByDepartment: currentUser?.department || "",
        unassignedBy: currentUser?.id || "",
        unassignedByName: currentUser?.name || "",
        unassignedAt: new Date().toISOString(),
      },
    });

    await fetchData(currentUser.department);
    setLoading(false);
  };

  return (
    <div className="dept-assign-page">
      <div className="dept-assign-header">
        <div>
          <span>Course Members</span>
          <h1>Course-wise Assigned Users</h1>
          <p>
            View users assigned to courses created by{" "}
            <strong>{currentUser?.department || "your department"}</strong>.
          </p>
        </div>

        <div className="assign-header-count">
          <strong>{courses.length}</strong>
          <span>Courses</span>
        </div>
      </div>

      <div className="assign-card">
        <div className="assign-card-head">
          <div>
            <h2>Search Assigned Users</h2>
            <p>Search name, email, designation, zone, state or city.</p>
          </div>

          <input
            placeholder="Search assigned users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {courseWiseData.map((course) => (
        <div className="assign-card" key={course.id}>
          <div className="assign-card-head">
            <div>
              <h2>{course.title || course.courseTitle}</h2>
              <p>{course.description || "No description"}</p>
            </div>

            <div className="assign-header-count">
              <strong>{course.totalAssigned}</strong>
              <span>Assigned</span>
            </div>
          </div>

          <div className="assign-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Designation</th>
                  <th>Zone</th>
                  <th>State</th>
                  <th>City</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {course.assignedUsers.map((user) => {
                  const availableCourses = getAvailableCoursesForUser(user.id);

                  return (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.name || "-"}</strong>
                        <small>{user.email || "-"}</small>
                      </td>

                      <td>{user.designation || "-"}</td>
                      <td>{user.zone || "-"}</td>
                      <td>{user.state || "-"}</td>
                      <td>{user.cityArea || user.city || user.area || "-"}</td>

                      <td>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: "8px",
                            alignItems: "center",
                          }}
                        >
                          {quickUserId === user.id ? (
                            <>
                              <select
                                value={quickCourseId}
                                onChange={(e) => setQuickCourseId(e.target.value)}
                                style={{
                                  width: "180px",
                                  height: "34px",
                                  borderRadius: "8px",
                                  border: "1px solid #d8e0ea",
                                  padding: "0 8px",
                                }}
                              >
                                <option value="">Select Course</option>

                                {availableCourses.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.title || item.courseTitle}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                disabled={loading}
                                onClick={() =>
                                  assignCourseToUser(user.id, quickCourseId)
                                }
                              >
                                Assign
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setQuickUserId("");
                                  setQuickCourseId("");
                                }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() =>
                                  removeCourseFromUser(user.id, course.id)
                                }
                              >
                                Remove
                              </button>

                              <button
                                type="button"
                                disabled={loading}
                                onClick={() => {
                                  setQuickUserId(user.id);
                                  setQuickCourseId("");
                                }}
                              >
                                Assign Other
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {course.assignedUsers.length === 0 && (
                  <tr>
                    <td colSpan="6">No users assigned to this course.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {courseWiseData.length === 0 && (
        <div className="assign-card">
          <p>No courses found.</p>
        </div>
      )}
    </div>
  );
}

export default DepartmentMembers;