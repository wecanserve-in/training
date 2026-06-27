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
  const [progress, setProgress] = useState({});

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [experienceFilter, setExperienceFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

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
    designation: ["designation", "userRole", "jobTitle", "roleTitle", "position", "title"],
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) return;

      const userSnap = await get(ref(database, `users/${loggedUser.uid}`));
      if (!userSnap.exists()) return;

      const adminData = {
        id: loggedUser.uid,
        email: loggedUser.email,
        ...userSnap.val(),
      };

      setCurrentUser(adminData);

      const [coursesSnap, usersSnap, assignmentsSnap, completedSnap, progressSnap] =
        await Promise.all([
          get(ref(database, "courses")),
          get(ref(database, "users")),
          get(ref(database, "userAssignments")),
          get(ref(database, "completedCourses")),
          get(ref(database, "progress")),
        ]);

      const allCourses = coursesSnap.exists()
        ? Object.entries(coursesSnap.val()).map(([id, course]) => ({ id, ...course }))
        : [];

      const myCourses = allCourses.filter((course) => {
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

      const normalUsers = allUsers.filter((user) => {
        const role = getField(user, ["role"]);
        return role !== "departmentAdmin" && role !== "admin" && role !== "superAdmin";
      });

      setCourses(myCourses);
      setUsers(normalUsers);
      setAssignments(assignmentsSnap.exists() ? assignmentsSnap.val() : {});
      setCompletedCourses(completedSnap.exists() ? completedSnap.val() : {});
      setProgress(progressSnap.exists() ? progressSnap.val() : {});

      if (preSelectedCourseId) setSelectedCourseId(preSelectedCourseId);
      else if (myCourses.length > 0) setSelectedCourseId(myCourses[0].id);

      setLoading(false);
    });

    return () => unsubscribe();
  }, [preSelectedCourseId]);

  const selectedCourse = useMemo(() => {
    return courses.find((course) => course.id === selectedCourseId);
  }, [courses, selectedCourseId]);

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

  const experienceOptions = useMemo(() => {
    return [...new Set(users.map((u) => getField(u, fieldKeys.experience)).filter(Boolean))];
  }, [users]);

  const designationOptions = useMemo(() => {
    return [...new Set(users.map((u) => getField(u, fieldKeys.designation)).filter(Boolean))];
  }, [users]);

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
      const experience = getField(user, fieldKeys.experience);
      const designation = getField(user, fieldKeys.designation);

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

      const matchesSearch = searchableText.includes(search.toLowerCase());
      const matchesZone = zoneFilter ? zone === zoneFilter : true;
      const matchesState = stateFilter ? state === stateFilter : true;
      const matchesCity = cityFilter ? city === cityFilter : true;
      const matchesExperience = experienceFilter ? experience === experienceFilter : true;
      const matchesDesignation = designationFilter ? designation === designationFilter : true;

      return (
        matchesSearch &&
        matchesZone &&
        matchesState &&
        matchesCity &&
        matchesExperience &&
        matchesDesignation
      );
    });
  }, [
    users,
    search,
    zoneFilter,
    stateFilter,
    cityFilter,
    experienceFilter,
    designationFilter,
    selectedCourseId,
    selectedCourse,
    assignments,
    completedCourses,
  ]);

  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((user) => selectedUsers.includes(user.id));

  const toggleUser = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleFilteredUsers = () => {
    const filteredIds = filteredUsers.map((user) => user.id);

    if (allFilteredSelected) {
      const filteredSet = new Set(filteredIds);
      setSelectedUsers((prev) => prev.filter((id) => !filteredSet.has(id)));
      return;
    }

    setSelectedUsers((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const resetFilters = () => {
    setSearch("");
    setZoneFilter("");
    setStateFilter("");
    setCityFilter("");
    setExperienceFilter("");
    setDesignationFilter("");
    setSelectedUsers([]);
  };

  const assignCourse = async (assignAllFiltered = false) => {
    if (!selectedCourseId) {
      alert("Please select a course.");
      return;
    }

    const usersToAssign = assignAllFiltered ? filteredUsers.map((user) => user.id) : selectedUsers;

    if (usersToAssign.length === 0) {
      alert("Please select at least one user.");
      return;
    }

    const confirmAssign = window.confirm(
      `Assign "${selectedCourse?.title}" to ${usersToAssign.length} user(s)?`
    );

    if (!confirmAssign) return;

    try {
      setAssigning(true);

      const courseVersion = Number(selectedCourse?.version || 1);

      await Promise.all(
        usersToAssign.map((userId) =>
          set(ref(database, `userAssignments/${userId}/${selectedCourseId}`), {
            assigned: true,
            courseId: selectedCourseId,
            courseTitle: selectedCourse?.title || "",
            courseThumbnail: selectedCourse?.thumbnailUrl || selectedCourse?.courseThumbnail || "",
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

      alert(`Course assigned to ${usersToAssign.length} user(s).`);

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
          <p>Only users who need this course/latest version are shown here.</p>
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
                <p>{selectedCourse.description || selectedCourse.overview}</p>

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

          <select
            value={experienceFilter}
            onChange={(e) => {
              setExperienceFilter(e.target.value);
              setSelectedUsers([]);
            }}
          >
            <option value="">All Experience</option>
            {experienceOptions.map((exp) => (
              <option key={exp} value={exp}>
                {exp}
              </option>
            ))}
          </select>

          <select
            value={designationFilter}
            onChange={(e) => {
              setDesignationFilter(e.target.value);
              setSelectedUsers([]);
            }}
          >
            <option value="">All Designations</option>
            {designationOptions.map((desig) => (
              <option key={desig} value={desig}>
                {desig}
              </option>
            ))}
          </select>

          <button type="button" className="assign-reset-btn" onClick={resetFilters}>
            Reset
          </button>
        </div>

        <div className="assign-table-head">
          <div>
            <h2>Users to Assign</h2>
            <p>
              {filteredUsers.length} users showing • {selectedUsers.length} selected
            </p>
          </div>

          <div className="assign-head-actions">
            <button type="button" onClick={toggleFilteredUsers}>
              {allFilteredSelected ? "Unselect Filtered" : "Select Filtered"}
            </button>

             <button type="button" onClick={() => assignCourse(false)} disabled={assigning}>
            {assigning ? "Assigning..." : `Assign Selected (${selectedUsers.length})`}
          </button> 

            {/* <button
            //   type="button"
            //   className="assign-all-btn"
            //   onClick={() => assignCourse(true)}
            //   disabled={assigning || filteredUsers.length === 0}
            // >
            //   Assign All Filtered
            </button> */}
          </div>
        </div>

        <div className="assign-users-table-wrap">
          <table className="assign-users-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>User</th>
                <th>Designation</th>
                <th>Experience</th>
                <th>Location</th>
                <th>Reason</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="assign-empty">
                    No users need this course/latest version.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const selected = selectedUsers.includes(user.id);
                  const status = getUserCourseStatus(user.id);

                  const designation = getField(user, fieldKeys.designation) || "-";
                  const experience = getField(user, fieldKeys.experience) || "-";

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
                      <td>
                        <input type="checkbox" checked={selected} readOnly />
                      </td>

                      <td>
                        <strong>{user.name || "Unnamed User"}</strong>
                        <small>{user.email}</small>
                      </td>

                      <td>{designation}</td>
                      <td>{experience}</td>
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

        <div className="assign-footer">
          <p>Already assigned latest-version users are hidden from this list.</p>

                 <button
              type="button"
              className="assign-all-btn"
              onClick={() => assignCourse(true)}
              disabled={assigning || filteredUsers.length === 0}
            >
              Assign All Filtered
            </button>

          
        </div>
      </div>
    </div>
  );
}

export default DepartmentAssignTraining;