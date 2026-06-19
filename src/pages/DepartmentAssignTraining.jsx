import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, push, set } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/departmentassigntraining.css";

function DepartmentAssignTraining() {
  const [currentUser, setCurrentUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [courses, setCourses] = useState([]);

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  const [filters, setFilters] = useState({
    designation: "",
    zone: "",
    state: "",
    cityArea: "",
  });

  const [assigning, setAssigning] = useState(false);

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
        const departmentMembers = Object.entries(usersSnap.val())
          .map(([id, user]) => ({ id, ...user }))
          .filter((user) => user.department === adminData.department);

        setMembers(departmentMembers);
      }

      if (coursesSnap.exists()) {
        const departmentCourses = Object.entries(coursesSnap.val())
          .map(([id, course]) => ({ id, ...course }))
          .filter((course) => course.department === adminData.department);

        setCourses(departmentCourses);
      }
    });

    return () => unsubscribe();
  }, []);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);

  const designations = [
    ...new Set(members.map((member) => member.designation).filter(Boolean)),
  ];

  const zones = [...new Set(members.map((member) => member.zone).filter(Boolean))];

  const states = [
    ...new Set(
      members
        .filter((member) => !filters.zone || member.zone === filters.zone)
        .map((member) => member.state)
        .filter(Boolean)
    ),
  ];

  const cities = [
    ...new Set(
      members
        .filter((member) => !filters.state || member.state === filters.state)
        .map((member) => member.cityArea)
        .filter(Boolean)
    ),
  ];

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      return (
        (!filters.designation || member.designation === filters.designation) &&
        (!filters.zone || member.zone === filters.zone) &&
        (!filters.state || member.state === filters.state) &&
        (!filters.cityArea || member.cityArea === filters.cityArea)
      );
    });
  }, [members, filters]);

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

  const assignTraining = async () => {
    if (!selectedCourseId) {
      alert("Please select course");
      return;
    }

    if (selectedUsers.length === 0) {
      alert("Please select users");
      return;
    }

    if (!window.confirm(`Assign this course to ${selectedUsers.length} users?`)) {
      return;
    }

    setAssigning(true);

    try {
      const assignmentRef = push(ref(database, "courseAssignments"));

      const usersObject = {};
      selectedUsers.forEach((uid) => {
        usersObject[uid] = true;
      });

      await set(assignmentRef, {
        courseId: selectedCourseId,
        courseTitle: selectedCourse?.title || selectedCourse?.courseTitle || "",
        department: currentUser.department,
        assignedBy: currentUser.id,
        assignedByName: currentUser.name,
        assignedAt: new Date().toISOString(),
        users: usersObject,
      });

      for (const uid of selectedUsers) {
        await set(ref(database, `userAssignments/${uid}/${selectedCourseId}`), {
          assigned: true,
          assignmentId: assignmentRef.key,
          courseId: selectedCourseId,
          courseTitle: selectedCourse?.title || selectedCourse?.courseTitle || "",
          department: currentUser.department,
          assignedBy: currentUser.id,
          assignedAt: new Date().toISOString(),
        });
      }

      alert(`${selectedUsers.length} users assigned successfully.`);
      setSelectedCourseId("");
      setSelectedUsers([]);
      setFilters({
        designation: "",
        zone: "",
        state: "",
        cityArea: "",
      });
    } catch (error) {
      alert(error.message);
    }

    setAssigning(false);
  };

  return (
    <div className="dept-assign-page">
      <div className="dept-assign-header">
        <div>
          <span>Department Assignment Center</span>
          <h1>Assign Training</h1>
          <p>
            Assign courses to members of{" "}
            <strong>{currentUser?.department || "your department"}</strong>.
          </p>
        </div>

        <div className="assign-header-count">
          <strong>{selectedUsers.length}</strong>
          <span>Selected Users</span>
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
            <div className="assign-card-head">
              <div>
                <h2>Filter Department Members</h2>
                <p>Filter by role, zone, state and city.</p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setFilters({
                    designation: "",
                    zone: "",
                    state: "",
                    cityArea: "",
                  })
                }
              >
                Clear
              </button>
            </div>

            <div className="assign-filter-grid">
              <select
                value={filters.designation}
                onChange={(e) =>
                  setFilters({ ...filters, designation: e.target.value })
                }
              >
                <option value="">All Roles</option>
                {designations.map((designation) => (
                  <option key={designation} value={designation}>
                    {designation}
                  </option>
                ))}
              </select>

              <select
                value={filters.zone}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    zone: e.target.value,
                    state: "",
                    cityArea: "",
                  })
                }
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
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    state: e.target.value,
                    cityArea: "",
                  })
                }
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
                onChange={(e) =>
                  setFilters({ ...filters, cityArea: e.target.value })
                }
              >
                <option value="">All Cities</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="assign-card">
            <div className="assign-card-head">
              <div>
                <h2>Matching Members</h2>
                <p>{filteredMembers.length} users found</p>
              </div>

              <div className="table-actions">
                <button type="button" onClick={selectAllUsers}>
                  Select All
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
                    <th>Name</th>
                    <th>Role</th>
                    <th>Zone</th>
                    <th>State</th>
                    <th>City</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredMembers.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(member.id)}
                          onChange={() => toggleUser(member.id)}
                        />
                      </td>
                      <td>
                        <strong>{member.name}</strong>
                        <small>{member.email}</small>
                      </td>
                      <td>{member.designation}</td>
                      <td>{member.zone}</td>
                      <td>{member.state}</td>
                      <td>{member.cityArea}</td>
                    </tr>
                  ))}

                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan="6">No members found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="assign-summary-card">
          <span>Assignment Summary</span>
          <h2>{selectedCourse ? selectedCourse.title || selectedCourse.courseTitle : "No Course Selected"}</h2>

          <div className="summary-row">
            <p>Department</p>
            <strong>{currentUser?.department || "-"}</strong>
          </div>

          <div className="summary-row">
            <p>Users Selected</p>
            <strong>{selectedUsers.length}</strong>
          </div>

          <div className="summary-row">
            <p>Course Videos</p>
            <strong>{selectedCourse?.videoCount || "-"}</strong>
          </div>

          <div className="summary-row">
            <p>Passing Score</p>
            <strong>{selectedCourse?.passingScore || "70"}%</strong>
          </div>

          <button
            className="assign-main-btn"
            onClick={assignTraining}
            disabled={assigning}
          >
            {assigning
              ? "Assigning..."
              : `Assign to ${selectedUsers.length} Users`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DepartmentAssignTraining;