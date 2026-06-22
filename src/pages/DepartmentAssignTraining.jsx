import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, push, update } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/departmentassigntraining.css";

function DepartmentAssignTraining() {
  const [currentUser, setCurrentUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [assignedMap, setAssignedMap] = useState({});

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  const [mode, setMode] = useState("assign");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [filters, setFilters] = useState({
    designation: "",
    zone: "",
    state: "",
    cityArea: "",
  });

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

      const usersSnap = await get(ref(database, "users"));
      const coursesSnap = await get(ref(database, "courses"));

      if (usersSnap.exists()) {
        const allNormalUsers = Object.entries(usersSnap.val())
          .map(([id, user]) => ({ id, ...user }))
          .filter(
            (user) =>
              user.role !== "departmentAdmin" &&
              user.role !== "admin" &&
              user.role !== "superAdmin"
          );

        setMembers(allNormalUsers);
      }

      if (coursesSnap.exists()) {
        const ownDepartmentCourses = Object.entries(coursesSnap.val())
          .map(([id, course]) => ({ id, ...course }))
          .filter((course) => course.department === adminData.department);

        setCourses(ownDepartmentCourses);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchAssignedUsers();
    setSelectedUsers([]);
  }, [selectedCourseId]);

  const fetchAssignedUsers = async () => {
    if (!selectedCourseId) {
      setAssignedMap({});
      return;
    }

    const userAssignmentsSnap = await get(ref(database, "userAssignments"));
    const map = {};

    if (userAssignmentsSnap.exists()) {
      const data = userAssignmentsSnap.val();

      Object.keys(data).forEach((uid) => {
        if (data[uid]?.[selectedCourseId]?.assigned) {
          map[uid] = true;
        }
      });
    }

    setAssignedMap(map);
  };

  const selectedCourse = courses.find(
    (course) => course.id === selectedCourseId
  );

  const getUserDesignation = (user) => {
    return user.designation || user.roleName || user.userRole || "";
  };

  const getUserCity = (user) => {
    return user.cityArea || user.city || user.area || "";
  };

  const designations = useMemo(() => {
    return [
      ...new Set(
        members.map((member) => getUserDesignation(member)).filter(Boolean)
      ),
    ];
  }, [members]);

  const zones = useMemo(() => {
    return [
      ...new Set(
        members
          .filter(
            (member) =>
              !filters.designation ||
              getUserDesignation(member) === filters.designation
          )
          .map((member) => member.zone)
          .filter(Boolean)
      ),
    ];
  }, [members, filters.designation]);

  const states = useMemo(() => {
    return [
      ...new Set(
        members
          .filter(
            (member) =>
              !filters.designation ||
              getUserDesignation(member) === filters.designation
          )
          .filter((member) => !filters.zone || member.zone === filters.zone)
          .map((member) => member.state)
          .filter(Boolean)
      ),
    ];
  }, [members, filters.designation, filters.zone]);

  const cities = useMemo(() => {
    return [
      ...new Set(
        members
          .filter(
            (member) =>
              !filters.designation ||
              getUserDesignation(member) === filters.designation
          )
          .filter((member) => !filters.zone || member.zone === filters.zone)
          .filter((member) => !filters.state || member.state === filters.state)
          .map((member) => getUserCity(member))
          .filter(Boolean)
      ),
    ];
  }, [members, filters.designation, filters.zone, filters.state]);

  const handleDesignationChange = (designation) => {
    setFilters({
      designation,
      zone: "",
      state: "",
      cityArea: "",
    });
    setSelectedUsers([]);
  };

  const handleZoneChange = (zone) => {
    setFilters({
      ...filters,
      zone,
      state: "",
      cityArea: "",
    });
    setSelectedUsers([]);
  };

  const handleStateChange = (state) => {
    setFilters({
      ...filters,
      state,
      cityArea: "",
    });
    setSelectedUsers([]);
  };

  const handleCityChange = (cityArea) => {
    if (!cityArea) {
      setFilters({
        ...filters,
        cityArea: "",
      });
      setSelectedUsers([]);
      return;
    }

    const matchedUser = members.find((member) => {
      return (
        getUserCity(member) === cityArea &&
        (!filters.designation ||
          getUserDesignation(member) === filters.designation)
      );
    });

    setFilters({
      ...filters,
      cityArea,
      zone: matchedUser?.zone || filters.zone,
      state: matchedUser?.state || filters.state,
    });

    setSelectedUsers([]);
  };

  const clearFilters = () => {
    setFilters({
      designation: "",
      zone: "",
      state: "",
      cityArea: "",
    });
    setSearch("");
    setSelectedUsers([]);
  };

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const designation = getUserDesignation(member);
      const city = getUserCity(member);
      const isAssigned = !!assignedMap[member.id];

      const searchableText = `${member.name || ""} ${member.email || ""} ${
        designation || ""
      } ${member.zone || ""} ${member.state || ""} ${city || ""}`.toLowerCase();

      return (
        (!filters.designation || designation === filters.designation) &&
        (!filters.zone || member.zone === filters.zone) &&
        (!filters.state || member.state === filters.state) &&
        (!filters.cityArea || city === filters.cityArea) &&
        (!search || searchableText.includes(search.toLowerCase())) &&
        (mode === "assign" ? !isAssigned : isAssigned)
      );
    });
  }, [members, filters, search, assignedMap, mode]);

  const toggleUser = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    setSelectedUsers(filteredMembers.map((member) => member.id));
  };

  const clearSelection = () => {
    setSelectedUsers([]);
  };

  const handleBulkAction = async () => {
    if (!selectedCourseId) {
      alert("Please select course");
      return;
    }

    if (selectedUsers.length === 0) {
      alert("Please select users");
      return;
    }

    const actionText = mode === "assign" ? "assign" : "unassign";

    if (
      !window.confirm(
        `${actionText} "${selectedCourse?.title}" for ${selectedUsers.length} users?`
      )
    ) {
      return;
    }

    setLoading(true);

    try {
      const updates = {};
      const now = new Date().toISOString();

      if (mode === "assign") {
        const assignmentRef = push(ref(database, "courseAssignments"));
        const usersObject = {};

        selectedUsers.forEach((uid) => {
          usersObject[uid] = true;

          updates[`userAssignments/${uid}/${selectedCourseId}`] = {
            assigned: true,
            assignmentId: assignmentRef.key,
            courseId: selectedCourseId,
            courseTitle:
              selectedCourse?.title || selectedCourse?.courseTitle || "",
            courseDepartment:
              selectedCourse?.department || currentUser?.department || "",
            assignedByDepartment: currentUser?.department || "",
            assignedBy: currentUser?.id || "",
            assignedByName: currentUser?.name || "",
            assignedAt: now,
          };
        });

        updates[`courseAssignments/${assignmentRef.key}`] = {
          courseId: selectedCourseId,
          courseTitle:
            selectedCourse?.title || selectedCourse?.courseTitle || "",
          courseDepartment:
            selectedCourse?.department || currentUser?.department || "",
          assignedByDepartment: currentUser?.department || "",
          assignedBy: currentUser?.id || "",
          assignedByName: currentUser?.name || "",
          assignedAt: now,
          filtersUsed: filters,
          users: usersObject,
        };
      } else {
        selectedUsers.forEach((uid) => {
          updates[`userAssignments/${uid}/${selectedCourseId}`] = null;

          updates[`unassignedLogs/${selectedCourseId}/${uid}`] = {
            courseId: selectedCourseId,
            courseTitle:
              selectedCourse?.title || selectedCourse?.courseTitle || "",
            courseDepartment:
              selectedCourse?.department || currentUser?.department || "",
            userId: uid,
            unassignedByDepartment: currentUser?.department || "",
            unassignedBy: currentUser?.id || "",
            unassignedByName: currentUser?.name || "",
            unassignedAt: now,
          };
        });
      }

      await update(ref(database), updates);

      alert(
        `${selectedUsers.length} users ${
          mode === "assign" ? "assigned" : "unassigned"
        } successfully.`
      );

      setSelectedUsers([]);
      await fetchAssignedUsers();
    } catch (error) {
      console.error(error);
      alert(error.message);
    }

    setLoading(false);
  };

  return (
    <div className="dept-assign-page">
      <div className="dept-assign-header">
        <div>
          <span>Department Assignment Center</span>
          <h1>Assign / Unassign Training</h1>
          <p>
            Assign courses created by{" "}
            <strong>{currentUser?.department || "your department"}</strong> to
            any user in the portal.
          </p>
        </div>

        <div className="assign-header-count">
          <strong>{selectedUsers.length}</strong>
          <span>Selected</span>
        </div>
      </div>

      <div className="assign-layout">
        <div className="assign-left">
          <div className="assign-card">
            <h2>Select Course</h2>

            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
            >
              <option value="">Select Course</option>

              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title || course.courseTitle}
                </option>
              ))}
            </select>
          </div>

          <div className="assign-card">
            <h2>Action</h2>

            <div className="assign-filter-grid">
              <button
                type="button"
                className={mode === "assign" ? "active-filter-btn" : ""}
                onClick={() => {
                  setMode("assign");
                  setSelectedUsers([]);
                }}
              >
                Assign New Users
              </button>

              <button
                type="button"
                className={mode === "unassign" ? "active-filter-btn" : ""}
                onClick={() => {
                  setMode("unassign");
                  setSelectedUsers([]);
                }}
              >
                Unassign Existing Users
              </button>
            </div>
          </div>

          <div className="assign-card">
            <div className="assign-card-head">
              <div>
                <h2>Filters</h2>
                <p>
                  Leave filters empty to show all users. City auto-fills state
                  and zone, but you can still change them manually.
                </p>
              </div>

              <button type="button" onClick={clearFilters}>
                Clear All
              </button>
            </div>

            <div className="assign-filter-grid">
              <select
                value={filters.designation}
                onChange={(e) => handleDesignationChange(e.target.value)}
              >
                <option value="">All Designations</option>

                {designations.map((designation) => (
                  <option key={designation} value={designation}>
                    {designation}
                  </option>
                ))}
              </select>

              <select
                value={filters.zone}
                onChange={(e) => handleZoneChange(e.target.value)}
              >
                <option value="">All Zones</option>

                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>

              <select
                value={filters.state}
                onChange={(e) => handleStateChange(e.target.value)}
              >
                <option value="">All States</option>

                {states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>

              <select
                value={filters.cityArea}
                onChange={(e) => handleCityChange(e.target.value)}
              >
                <option value="">All Cities / Areas</option>

                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>

              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedUsers([]);
                }}
                placeholder="Search name, email, designation, city..."
              />
            </div>
          </div>

          <div className="assign-card">
            <div className="assign-card-head">
              <div>
                <h2>
                  {mode === "assign"
                    ? "Users Available for Assignment"
                    : "Already Assigned Users"}
                </h2>

                <p>
                  {filteredMembers.length} users found from total{" "}
                  {members.length} users.
                </p>
              </div>

              <div className="table-actions">
                <button type="button" onClick={selectAllUsers}>
                  Select All Filtered
                </button>

                <button type="button" onClick={clearSelection}>
                  Clear
                </button>
              </div>
            </div>

            <div className="assign-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>User</th>
                    <th>Designation</th>
                    <th>Zone</th>
                    <th>State</th>
                    <th>City</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredMembers.map((member) => {
                    const designation = getUserDesignation(member) || "-";
                    const city = getUserCity(member) || "-";

                    return (
                      <tr key={member.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(member.id)}
                            onChange={() => toggleUser(member.id)}
                          />
                        </td>

                        <td>
                          <strong>{member.name || "-"}</strong>
                          <small>{member.email || "-"}</small>
                        </td>

                        <td>{designation}</td>
                        <td>{member.zone || "-"}</td>
                        <td>{member.state || "-"}</td>
                        <td>{city}</td>

                        <td>
                          {assignedMap[member.id] ? (
                            <span className="badge-metric accent-blue">
                              Assigned
                            </span>
                          ) : (
                            <span className="badge-metric accent-grey">
                              Not Assigned
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan="7">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="assign-summary-card">
          <span>Assignment Summary</span>

          <h2>
            {selectedCourse
              ? selectedCourse.title || selectedCourse.courseTitle
              : "No Course Selected"}
          </h2>

          <div className="summary-row">
            <p>Course Department</p>
            <strong>{selectedCourse?.department || "-"}</strong>
          </div>

          <div className="summary-row">
            <p>Mode</p>
            <strong>{mode === "assign" ? "Assign" : "Unassign"}</strong>
          </div>

          <div className="summary-row">
            <p>Total Users</p>
            <strong>{members.length}</strong>
          </div>

          <div className="summary-row">
            <p>Filtered Users</p>
            <strong>{filteredMembers.length}</strong>
          </div>

          <div className="summary-row">
            <p>Selected Users</p>
            <strong>{selectedUsers.length}</strong>
          </div>

          <button
            className="assign-main-btn"
            onClick={handleBulkAction}
            disabled={loading}
          >
            {loading
              ? "Processing..."
              : mode === "assign"
              ? `Assign to ${selectedUsers.length} Users`
              : `Unassign ${selectedUsers.length} Users`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DepartmentAssignTraining;