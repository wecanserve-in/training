import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref, set } from "firebase/database";
import { useSearchParams } from "react-router-dom";
import { auth, database } from "../firebase";
import "../styles/departmentassigntraining.css";

function DepartmentAssignTraining() {
  const [searchParams] = useSearchParams();
  const preSelectedCourseId = searchParams.get("courseId");

  const [currentUser, setCurrentUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [completedCourses, setCompletedCourses] = useState({});

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const getField = (obj, keys) => {
    for (const key of keys) {
      const value = obj?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
    return "";
  };

  const fieldKeys = {
    zone: ["zone", "Zone", "zoneName", "zone_name"],
    state: ["state", "State", "stateName", "state_name"],
    city: ["city", "City", "area", "Area", "cityArea", "city_area", "location", "Location", "hq", "HQ"],
    experience: ["experience", "experienceLevel", "seniority", "level", "exp", "category"],
    designation: ["designation", "jobTitle", "roleTitle", "position", "title"],
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) {
        setLoading(false);
        return;
      }

      try {
        const userSnap = await get(ref(database, `users/${loggedUser.uid}`));

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

        const [coursesSnap, usersSnap, assignmentsSnap, completedSnap] = await Promise.all([
          get(ref(database, "courses")),
          get(ref(database, "users")),
          get(ref(database, "userAssignments")),
          get(ref(database, "completedCourses")),
        ]);

        const allCourses = coursesSnap.exists()
          ? Object.entries(coursesSnap.val()).map(([id, course]) => ({ id, ...course }))
          : [];

        const canAssignAllCourses =
          adminData.role === "superAdmin" || adminData.role === "admin";

        const myCourses = canAssignAllCourses
          ? allCourses
          : allCourses.filter((course) => {
              return (
                course.createdBy === adminData.id ||
                course.createdByEmail === adminData.email ||
                course.department === adminData.department
              );
            });

        myCourses.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        const allUsers = usersSnap.exists()
          ? Object.entries(usersSnap.val()).map(([id, user]) => ({ id, ...user }))
          : [];

        const visibleUsers = allUsers.filter((user) => {
          const role = getField(user, ["role"]).toLowerCase();

          const isSuperAdmin = role === "superadmin";
          const isAdmin = role === "admin";
          const isDepartmentAdmin = role === "departmentadmin";

          if (adminData.role === "superAdmin") return true;
          if (adminData.role === "admin") return !isSuperAdmin;

          if (adminData.role === "departmentAdmin") {
            return !isSuperAdmin && !isAdmin && !isDepartmentAdmin;
          }

          return false;
        });

        setCourses(myCourses);
        setUsers(visibleUsers);
        setAssignments(assignmentsSnap.exists() ? assignmentsSnap.val() : {});
        setCompletedCourses(completedSnap.exists() ? completedSnap.val() : {});

        if (preSelectedCourseId) {
          setSelectedCourseId(preSelectedCourseId);
        } else if (myCourses.length > 0) {
          setSelectedCourseId(myCourses[0].id);
        }
      } catch (error) {
        console.error("Failed to load assign training data:", error);
        alert("Failed to load data.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [preSelectedCourseId]);

  const selectedCourse = useMemo(() => {
    return courses.find((course) => course.id === selectedCourseId);
  }, [courses, selectedCourseId]);

  const courseDescription =
    selectedCourse?.description || selectedCourse?.overview || "No description available.";

  const shortDescription =
    courseDescription.length > 120 && !showFullDescription
      ? `${courseDescription.slice(0, 120)}...`
      : courseDescription;

  const zoneOptions = useMemo(() => {
    return [...new Set(users.map((u) => getField(u, fieldKeys.zone)).filter(Boolean))];
  }, [users]);

  const stateOptions = useMemo(() => {
    const base = zoneFilter
      ? users.filter((u) => getField(u, fieldKeys.zone) === zoneFilter)
      : users;

    return [...new Set(base.map((u) => getField(u, fieldKeys.state)).filter(Boolean))];
  }, [users, zoneFilter]);

  const cityOptions = useMemo(() => {
    const base = users.filter((u) => {
      const zone = getField(u, fieldKeys.zone);
      const state = getField(u, fieldKeys.state);

      return (!zoneFilter || zone === zoneFilter) && (!stateFilter || state === stateFilter);
    });

    return [...new Set(base.map((u) => getField(u, fieldKeys.city)).filter(Boolean))];
  }, [users, zoneFilter, stateFilter]);

  const handleZoneChange = (value) => {
    setZoneFilter(value);
    setStateFilter("");
    setCityFilter("");
    setSelectedUsers([]);
  };

  const handleStateChange = (value) => {
    setStateFilter(value);
    setCityFilter("");
    setSelectedUsers([]);
  };

  const handleCityChange = (value) => {
    setCityFilter(value);
    setSelectedUsers([]);

    if (!value) return;

    const matchedUser = users.find((user) => getField(user, fieldKeys.city) === value);

    if (matchedUser) {
      setZoneFilter(getField(matchedUser, fieldKeys.zone));
      setStateFilter(getField(matchedUser, fieldKeys.state));
    }
  };

  const getUserCourseStatus = (userId) => {
    if (!selectedCourseId || !selectedCourse) return "notAssigned";

    const currentVersion = Number(selectedCourse?.version || 1);
    const assignment = assignments?.[userId]?.[selectedCourseId];
    const completed = completedCourses?.[userId]?.[selectedCourseId];

    if (!assignment?.assigned) return "notAssigned";

    const assignedVersion = Number(
      assignment.assignedCourseVersion || assignment.courseVersion || 1
    );

    const completedVersion = Number(
      completed?.completedCourseVersion || completed?.courseVersion || assignedVersion || 1
    );

    if (completed?.passed || completed?.completed) {
      if (completedVersion < currentVersion) return "updatedAfterCompletion";
      return "completedLatest";
    }

    if (assignedVersion < currentVersion) return "latestNotAssigned";

    return "assignedLatest";
  };

  const getStatusLabel = (status) => {
    if (status === "notAssigned") return "Not Assigned";
    if (status === "latestNotAssigned") return "Latest Version Not Assigned";
    if (status === "updatedAfterCompletion") return "Course Updated";
    return "Already Assigned";
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const status = getUserCourseStatus(user.id);

      const shouldShow =
        status === "notAssigned" ||
        status === "latestNotAssigned" ||
        status === "updatedAfterCompletion";

      if (!shouldShow) return false;

      const zone = getField(user, fieldKeys.zone);
      const state = getField(user, fieldKeys.state);
      const city = getField(user, fieldKeys.city);
      const designation = getField(user, fieldKeys.designation);
      const experience = getField(user, fieldKeys.experience);

      const searchableText = [
        user.name,
        user.email,
        user.phone,
        user.role,
        designation,
        experience,
        zone,
        state,
        city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        searchableText.includes(search.trim().toLowerCase()) &&
        (zoneFilter ? zone === zoneFilter : true) &&
        (stateFilter ? state === stateFilter : true) &&
        (cityFilter ? city === cityFilter : true)
      );
    });
  }, [
    users,
    search,
    zoneFilter,
    stateFilter,
    cityFilter,
    selectedCourseId,
    selectedCourse,
    assignments,
    completedCourses,
  ]);

  const toggleUser = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const resetFilters = () => {
    setSearch("");
    setZoneFilter("");
    setStateFilter("");
    setCityFilter("");
    setSelectedUsers([]);
  };

  const assignCourse = async () => {
    if (!selectedCourseId) {
      alert("Please select a course.");
      return;
    }

    if (selectedUsers.length === 0) {
      alert("Please select at least one user.");
      return;
    }

    const confirmAssign = window.confirm(
      `Assign "${selectedCourse?.title}" to ${selectedUsers.length} user(s)?`
    );

    if (!confirmAssign) return;

    try {
      setAssigning(true);

      const courseVersion = Number(selectedCourse?.version || 1);

      await Promise.all(
        selectedUsers.map((userId) =>
          set(ref(database, `userAssignments/${userId}/${selectedCourseId}`), {
            assigned: true,
            courseId: selectedCourseId,
            courseTitle: selectedCourse?.title || "",
            courseThumbnail:
              selectedCourse?.thumbnailUrl || selectedCourse?.courseThumbnail || "",
            department: selectedCourse?.department || currentUser?.department || "",
            assignedBy: currentUser?.id || "",
            assignedByName: currentUser?.name || "",
            assignedAt: new Date().toISOString(),
            courseVersion,
            assignedCourseVersion: courseVersion,
            latestCourseVersion: courseVersion,
            needsReassignment: false,
            reassignReason: "",
            status: "active",
          })
        )
      );

      alert(`Course assigned to ${selectedUsers.length} user(s).`);
      setSelectedUsers([]);

      const newAssignmentsSnap = await get(ref(database, "userAssignments"));
      setAssignments(newAssignmentsSnap.exists() ? newAssignmentsSnap.val() : {});
    } catch (error) {
      console.error(error);
      alert("Failed to assign course.");
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return <div className="assign-training-page">Loading...</div>;
  }

  return (
    <div className="assign-training-page">
      <div className="assign-header-card">
        <div>
          <span>Assign Course</span>
          <h1>Assign Training</h1>
          <p>
            {currentUser?.role === "superAdmin"
              ? "Assign courses to Super Admins, Admins, Department Admins and users."
              : currentUser?.role === "admin"
              ? "Assign courses to yourself, Department Admins and users."
              : "Assign courses to users in your department."}
          </p>
        </div>
      </div>

      <div className="assign-main-card">
        <div className="assign-course-box">
          <div>
            <label>Course to assign</label>
            <select
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                setSelectedUsers([]);
                setShowFullDescription(false);
              }}
            >
              <option value="">Select Course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          {selectedCourse && (
            <div className="selected-course-preview">
              <div className="selected-course-thumb">
                {selectedCourse.thumbnailUrl || selectedCourse.courseThumbnail ? (
                  <img
                    src={selectedCourse.thumbnailUrl || selectedCourse.courseThumbnail}
                    alt={selectedCourse.title}
                  />
                ) : (
                  <span>▶</span>
                )}
              </div>

              <div>
                <h3>{selectedCourse.title}</h3>

                <p className="course-description-text">
                  {shortDescription}
                  {courseDescription.length > 120 && (
                    <button
                      type="button"
                      className="read-more-btn"
                      onClick={() => setShowFullDescription((prev) => !prev)}
                    >
                      {showFullDescription ? " Read less" : " Read more"}
                    </button>
                  )}
                </p>

                <div className="assign-meta-row">
                  <span>{selectedCourse.totalVideos || 0} videos</span>
                  <span>{selectedCourse.totalQuestions || 0} questions</span>
                  <span>Pass {selectedCourse.passingScore || 70}%</span>
                  <span>Version {selectedCourse.version || 1}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="assign-toolbar assign-toolbar-large">
          <input
            placeholder="Search name, email, designation, city..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedUsers([]);
            }}
          />

          <select value={zoneFilter} onChange={(e) => handleZoneChange(e.target.value)}>
            <option value="">All Zones</option>
            {zoneOptions.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>

          <select value={stateFilter} onChange={(e) => handleStateChange(e.target.value)}>
            <option value="">All States</option>
            {stateOptions.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>

          <select value={cityFilter} onChange={(e) => handleCityChange(e.target.value)}>
            <option value="">All Cities / Areas</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          <button type="button" className="assign-reset-btn" onClick={resetFilters}>
            Reset
          </button>
        </div>

        <div className="assign-table-head">
          <div>
            <h2>Available Users</h2>
            <p>
              {filteredUsers.length} Users • {selectedUsers.length} Selected
            </p>
          </div>

          <div className="assign-head-actions">
            <button type="button" onClick={assignCourse} disabled={assigning}>
              {assigning ? "Assigning..." : `Assign Selected (${selectedUsers.length})`}
            </button>
          </div>
        </div>

        <div className="assign-users-table-wrap">
          <table className="assign-users-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>User</th>
                <th>Designation</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="assign-empty">
                    No users need this course/latest version.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const selected = selectedUsers.includes(user.id);
                  const status = getUserCourseStatus(user.id);

                  const designation = getField(user, fieldKeys.designation) || "-";
                  const location =
                    [
                      getField(user, fieldKeys.city),
                      getField(user, fieldKeys.state),
                      getField(user, fieldKeys.zone),
                    ]
                      .filter(Boolean)
                      .join(", ") || "-";

                  return (
                    <tr
                      key={user.id}
                      className={selected ? "selected" : ""}
                      onClick={() => toggleUser(user.id)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleUser(user.id)}
                        />
                      </td>

                      <td className="user-select-cell">
                        <strong>{user.name || "Unnamed User"}</strong>
                        <small>{user.email}</small>
                      </td>

                      <td>{designation}</td>
                      <td>{location}</td>

                      <td>
                        <span className={`assign-status ${status}`}>
                          {getStatusLabel(status)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DepartmentAssignTraining;