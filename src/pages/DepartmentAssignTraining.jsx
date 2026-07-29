import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref, set } from "firebase/database";
import { useSearchParams } from "react-router-dom";
import { auth, database } from "../firebase";
import { createNotification } from "../services/doubtService";
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
  const [roleFilter, setRoleFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");

  const [quickDepartment, setQuickDepartment] = useState("");
  const [quickDesignation, setQuickDesignation] = useState("");

  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const getField = (obj, keys) => {
    for (const key of keys) {
      const value = obj?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
    }
    return "";
  };

  const fieldKeys = {
    zone: ["zone", "Zone", "zoneName"],
    state: ["state", "State", "stateName"],
    city: ["city", "City", "area", "Area", "cityArea"],
    designation: ["designation", "userRole", "jobTitle", "position", "title"],
    department: ["department", "departmentName", "deptName", "dept"],
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) { setLoading(false); return; }
      try {
        const userSnap = await get(ref(database, `users/${loggedUser.uid}`));
        if (!userSnap.exists()) { setLoading(false); return; }

        const adminData = { id: loggedUser.uid, email: loggedUser.email, ...userSnap.val() };
        const rawRole = String(adminData.role || "").toLowerCase().replace(/[\s_-]/g, "");
        const isSuperAdmin = rawRole === "superadmin";
        const isAdmin = rawRole === "admin";
        const isDeptAdmin = rawRole === "departmentadmin";

        if (isDeptAdmin) {
          const deptSnap = await get(ref(database, "departments"));
          if (deptSnap.exists()) {
            const depts = deptSnap.val();
            const match = Object.entries(depts).find(
              ([, d]) => d.departmentAdminId === loggedUser.uid
            );
            if (match) {
              adminData.departmentId = match[0];
              adminData.department = match[1].departmentName || adminData.department || "";
              adminData.departmentType = match[1].departmentType || adminData.departmentType || "";
            }
          }
        }

        setCurrentUser(adminData);

        const [coursesSnap, usersSnap, assignmentsSnap, completedSnap] = await Promise.allSettled([
          get(ref(database, "courses")),
          get(ref(database, "users")),
          get(ref(database, "userAssignments")),
          get(ref(database, "completedCourses")),
        ]);

        const allCourses = coursesSnap.status === "fulfilled" && coursesSnap.value.exists()
          ? Object.entries(coursesSnap.value.val()).map(([id, c]) => ({ id, ...c }))
          : [];

        const allUsers = usersSnap.status === "fulfilled" && usersSnap.value.exists()
          ? Object.entries(usersSnap.value.val()).map(([id, u]) => ({ id, ...u }))
          : [];

        const assignmentsData = assignmentsSnap.status === "fulfilled" && assignmentsSnap.value.exists()
          ? assignmentsSnap.value.val()
          : {};

        const completedData = completedSnap.status === "fulfilled" && completedSnap.value.exists()
          ? completedSnap.value.val()
          : {};

        const canAssignAll = isSuperAdmin || isAdmin;
        const myCourses = canAssignAll
          ? allCourses
          : allCourses.filter((c) => {
              const courseDeptId = String(c.departmentId || "").trim();
              const userDeptId = String(adminData.departmentId || "").trim();
              const courseDept = String(c.department || "").trim().toLowerCase();
              const userDept = String(adminData.department || "").trim().toLowerCase();

              if (courseDeptId && userDeptId && courseDeptId === userDeptId) return true;
              if (courseDept && userDept && courseDept === userDept) return true;
              return false;
            });
        myCourses.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        const getRoleRank = (u) => {
          const r = getField(u, ["role"]).toLowerCase().replace(/[\s_-]/g, "");
          if (r === "superadmin") return 0;
          if (r === "admin") return 1;
          if (r === "departmentadmin") return 2;
          return 3;
        };

        const myDeptId = adminData.departmentId || "";
        const myDept = (adminData.department || "").toLowerCase();

        const visibleUsers = allUsers.filter((u) => {
          const role = getField(u, ["role"]).toLowerCase().replace(/[\s_-]/g, "");
          if (isSuperAdmin) return true;
          if (isAdmin) return role !== "superadmin";
          if (isDeptAdmin) return true;
          return true;
        });

        visibleUsers.sort((a, b) => {
          const rankA = getRoleRank(a);
          const rankB = getRoleRank(b);
          if (rankA !== rankB) return rankA - rankB;

          if (isDeptAdmin) {
            const aSameDept = (a.departmentId && a.departmentId === myDeptId) || (a.department || "").toLowerCase() === myDept;
            const bSameDept = (b.departmentId && b.departmentId === myDeptId) || (b.department || "").toLowerCase() === myDept;
            if (aSameDept && !bSameDept) return -1;
            if (!aSameDept && bSameDept) return 1;
          }

          return (getField(a, ["name"]) || "").localeCompare(getField(b, ["name"]) || "");
        });

        setCourses(myCourses);
        setUsers(visibleUsers);
        setAssignments(assignmentsData);
        setCompletedCourses(completedData);

        if (preSelectedCourseId) setSelectedCourseId(preSelectedCourseId);
        else if (myCourses.length > 0) setSelectedCourseId(myCourses[0].id);
      } catch (error) {
        console.error(error);
        alert("Failed to load data.");
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [preSelectedCourseId]);

  const isDeptAdmin = useMemo(() => {
    const role = String(currentUser?.role || "").toLowerCase().replace(/[\s_-]/g, "");
    return role === "departmentadmin";
  }, [currentUser]);

  const selectedCourse = useMemo(() => courses.find((c) => c.id === selectedCourseId), [courses, selectedCourseId]);
  const courseDescription = selectedCourse?.description || selectedCourse?.overview || "No description available.";
  const shortDescription = courseDescription.length > 100 && !showFullDescription
    ? `${courseDescription.slice(0, 100)}...` : courseDescription;

  const roleOptions = useMemo(() => [...new Set(users.map((u) => getField(u, ["role"])).filter(Boolean))].sort(), [users]);
  const zoneOptions = useMemo(() => [...new Set(users.map((u) => getField(u, fieldKeys.zone)).filter(Boolean))].sort(), [users]);
  const stateOptions = useMemo(() => {
    const base = zoneFilter ? users.filter((u) => getField(u, fieldKeys.zone) === zoneFilter) : users;
    return [...new Set(base.map((u) => getField(u, fieldKeys.state)).filter(Boolean))].sort();
  }, [users, zoneFilter]);
  const departmentOptions = useMemo(
    () =>
      [
        ...new Set(
          users
            .map((user) =>
              getField(user, fieldKeys.department)
            )
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [users]
  );

  const designationOptions = useMemo(
    () =>
      [
        ...new Set(
          users
            .map((user) =>
              getField(user, fieldKeys.designation)
            )
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [users]
  );

  const getUserCourseStatus = (userId) => {
    if (!selectedCourseId || !selectedCourse) return "notAssigned";
    const currentVersion = Number(selectedCourse?.version || 1);
    const assignment = assignments?.[userId]?.[selectedCourseId];
    const completed = completedCourses?.[userId]?.[selectedCourseId];
    if (!assignment?.assigned) return "notAssigned";
    const assignedVersion = Number(assignment.assignedCourseVersion || assignment.courseVersion || 1);
    const completedVersion = Number(completed?.completedCourseVersion || completed?.courseVersion || assignedVersion || 1);
    if (completed?.passed || completed?.completed) {
      return completedVersion < currentVersion ? "updatedAfterCompletion" : "completedLatest";
    }
    if (assignedVersion < currentVersion) return "latestNotAssigned";
    return "assignedLatest";
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const role = getField(user, ["role"]);
      const zone = getField(user, fieldKeys.zone);
      const state = getField(user, fieldKeys.state);
      const department = getField(
        user,
        fieldKeys.department
      );
      const designation = getField(
        user,
        fieldKeys.designation
      );

      const text = [
        user.name,
        user.email,
        role,
        designation,
        zone,
        state,
        department,
        getField(user, fieldKeys.city),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        text.includes(search.trim().toLowerCase()) &&
        (roleFilter
          ? role.toLowerCase() === roleFilter.toLowerCase()
          : true) &&
        (zoneFilter ? zone === zoneFilter : true) &&
        (stateFilter ? state === stateFilter : true) &&
        (departmentFilter
          ? department === departmentFilter
          : true) &&
        (designationFilter
          ? designation === designationFilter
          : true)
      );
    });
  }, [
    users,
    search,
    roleFilter,
    zoneFilter,
    stateFilter,
    departmentFilter,
    designationFilter,
    selectedCourseId,
    selectedCourse,
    assignments,
    completedCourses,
  ]);

  const toggleUser = (userId) => {
    setSelectedUsers((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);
  };

  const selectByRole = (role) => {
    const matched = filteredUsers
      .filter(
        (user) =>
          getField(user, ["role"]).toLowerCase() ===
          role.toLowerCase()
      )
      .map((user) => user.id);

    setSelectedUsers(matched);
  };

  const selectByDepartment = (department) => {
    setQuickDepartment(department);
    setQuickDesignation("");

    if (!department) {
      setSelectedUsers([]);
      return;
    }

    const matched = filteredUsers
      .filter(
        (user) =>
          getField(user, fieldKeys.department) ===
          department
      )
      .map((user) => user.id);

    setSelectedUsers(matched);
  };

  const selectByDesignation = (designation) => {
    setQuickDesignation(designation);
    setQuickDepartment("");

    if (!designation) {
      setSelectedUsers([]);
      return;
    }

    const matched = filteredUsers
      .filter(
        (user) =>
          getField(user, fieldKeys.designation) ===
          designation
      )
      .map((user) => user.id);

    setSelectedUsers(matched);
  };

  const selectAll = () =>
    setSelectedUsers(filteredUsers.map((user) => user.id));
  const deselectAll = () => setSelectedUsers([]);

  const resetFilters = () => {
    setSearch("");
    setRoleFilter("");
    setZoneFilter("");
    setStateFilter("");
    setDepartmentFilter("");
    setDesignationFilter("");
    setQuickDepartment("");
    setQuickDesignation("");
    setSelectedUsers([]);
  };

  const assignCourse = async () => {
    if (!selectedCourseId) { alert("Please select a course."); return; }
    if (selectedUsers.length === 0) { alert("Please select at least one user."); return; }
    if (!window.confirm(`Assign "${selectedCourse?.title}" to ${selectedUsers.length} user(s)?`)) return;

    try {
      setAssigning(true);
      const courseVersion = Number(selectedCourse?.version || 1);
      await Promise.all(
        selectedUsers.map((userId) =>
          set(ref(database, `userAssignments/${userId}/${selectedCourseId}`), {
            courseId: selectedCourseId,
            assigned: true,
            courseTitle: selectedCourse?.title || "",
            courseThumbnail: selectedCourse?.thumbnailUrl || selectedCourse?.courseThumbnail || "",
            department: selectedCourse?.department || currentUser?.department || "",
            departmentId: selectedCourse?.departmentId || currentUser?.departmentId || "",
            assignedBy: currentUser?.id || "",
            assignedByName: currentUser?.name || "",
            assignedAt: new Date().toISOString(),
            assignmentType: "course",
            courseVersion,
            assignedCourseVersion: courseVersion,
            latestCourseVersion: courseVersion,
            needsReassignment: false,
            status: "active",
          })
        )
      );

      await Promise.all(
        selectedUsers.map((userId) =>
          createNotification(userId, {
            type: "course_assigned",
            courseId: selectedCourseId,
            courseTitle: selectedCourse?.title || "",
            title: "Course Assigned",
            message: `You have been assigned the course '${selectedCourse?.title || "a course"}'.`,
          })
        )
      );

      alert(`Course assigned to ${selectedUsers.length} user(s).`);
      setSelectedUsers([]);
      const newSnap = await get(ref(database, "userAssignments"));
      setAssignments(newSnap.exists() ? newSnap.val() : {});
    } catch (error) {
      console.error(error);
      alert("Failed to assign course.");
    } finally {
      setAssigning(false);
    }
  };

  const makeOptionKey = (prefix, value, index) =>
    `${prefix}-${String(value || "empty")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}-${index}`;

  if (loading) {
    return (
      <div className="ac-page">
        <div className="ac-loading">Loading...</div>
      </div>
    );
  }

  const getRoleBadge = (role) => {
    const r = (role || "").toLowerCase();
    if (r === "superadmin") return { label: "Super Admin", cls: "super" };
    if (r === "admin") return { label: "Admin", cls: "admin" };
    if (r === "departmentadmin") return { label: "Dept Admin", cls: "dept" };
    return { label: "User", cls: "user" };
  };

  return (
    <div className="ac-page">

      {/* Hero */}
      <section className="ac-hero">
        <div className="ac-hero-content">
          <h1>Assign Course</h1>
          <p>Select a course, pick users and assign in seconds.</p>
        </div>
        <div className="ac-hero-stats">
          <div className="ac-hero-stat">
            <div className="ac-hero-stat-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </div>
            <div>
              <strong>{courses.length}</strong>
              <span>Courses</span>
            </div>
          </div>
          <div className="ac-hero-stat">
            <div className="ac-hero-stat-icon users-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <strong>{users.length}</strong>
              <span>Users</span>
            </div>
          </div>
        </div>
      </section>

      {/* Course Select */}
      <div className="ac-card ac-course-card">
        <div className="ac-course-top">
          <div className="ac-course-select-wrap">
            <label>Select Course</label>
            <select
              className="ac-select"
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                setSelectedUsers([]);
                setQuickDepartment("");
                setQuickDesignation("");
                setShowFullDescription(false);
              }}
            >
              <option value="">Choose a course...</option>
              {courses.map((course, index) => (
                <option
                  key={
                    course.id ||
                    makeOptionKey(
                      "course",
                      course.title,
                      index
                    )
                  }
                  value={course.id}
                >
                  {course.title || "Untitled Course"}
                </option>
              ))}
            </select>
          </div>

          {selectedCourse && (
            <div className="ac-course-preview">
              <div className="ac-course-thumb">
                {selectedCourse.thumbnailUrl || selectedCourse.courseThumbnail ? (
                  <img src={selectedCourse.thumbnailUrl || selectedCourse.courseThumbnail} alt={selectedCourse.title} />
                ) : (
                  <div className="ac-thumb-fallback">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </div>
                )}
              </div>
              <div className="ac-course-details">
                <h3>{selectedCourse.title}</h3>
                <p>{shortDescription}{courseDescription.length > 100 && <button type="button" className="ac-read-more" onClick={() => setShowFullDescription(!showFullDescription)}>{showFullDescription ? " Less" : " More"}</button>}</p>
                <div className="ac-meta-row">
                  <span>{selectedCourse.totalVideos || 0} videos</span>
                  <span>{selectedCourse.totalQuestions || 0} questions</span>
                  <span>Pass {selectedCourse.passingScore || 70}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Assign Buttons */}
      <div className="ac-card ac-quick-row">
        <span className="ac-quick-label">Quick Select:</span>

        <button
          className="ac-quick-btn"
          onClick={() => {
            selectAll();
            setQuickDepartment("");
            setQuickDesignation("");
          }}
        >
          All ({filteredUsers.length})
        </button>

        <button
          className="ac-quick-btn"
          onClick={() => {
            deselectAll();
            setQuickDepartment("");
            setQuickDesignation("");
          }}
        >
          None
        </button>

        {roleOptions.map((role, roleIndex) => {
          const badge = getRoleBadge(role);
          const count = filteredUsers.filter(
            (user) =>
              getField(user, ["role"]).toLowerCase() ===
              role.toLowerCase()
          ).length;

          return (
            <button
              key={makeOptionKey(
                "quick-role",
                role,
                roleIndex
              )}
              className={`ac-quick-btn role-${badge.cls}`}
              onClick={() => {
                selectByRole(role);
                setQuickDepartment("");
                setQuickDesignation("");
              }}
            >
              {badge.label} ({count})
            </button>
          );
        })}

        <select
          className="ac-filter-select ac-quick-select"
          value={quickDepartment}
          onChange={(e) =>
            selectByDepartment(e.target.value)
          }
        >
          <option value="">Select by Department</option>
          {departmentOptions.map(
            (department, departmentIndex) => {
            const count = filteredUsers.filter(
              (user) =>
                getField(
                  user,
                  fieldKeys.department
                ) === department
            ).length;

            return (
              <option
                key={makeOptionKey(
                  "quick-department",
                  department,
                  departmentIndex
                )}
                value={department}
              >
                {department} ({count})
              </option>
            );
          })}
        </select>

        <select
          className="ac-filter-select ac-quick-select"
          value={quickDesignation}
          onChange={(e) =>
            selectByDesignation(e.target.value)
          }
        >
          <option value="">Select by Designation</option>
          {designationOptions.map(
            (designation, designationIndex) => {
            const count = filteredUsers.filter(
              (user) =>
                getField(
                  user,
                  fieldKeys.designation
                ) === designation
            ).length;

            return (
              <option
                key={makeOptionKey(
                  "quick-designation",
                  designation,
                  designationIndex
                )}
                value={designation}
              >
                {designation} ({count})
              </option>
            );
          })}
        </select>

        <button
          className="ac-quick-btn dept"
          onClick={() => {
            const myDeptId =
              currentUser?.departmentId || "";
            const myDept = String(
              currentUser?.department ||
                currentUser?.departmentName ||
                ""
            ).toLowerCase();

            const matched = filteredUsers
              .filter((user) => {
                const userDeptId =
                  user.departmentId || "";
                const userDept = getField(
                  user,
                  fieldKeys.department
                ).toLowerCase();

                return (
                  (userDeptId &&
                    userDeptId === myDeptId) ||
                  (userDept &&
                    userDept === myDept)
                );
              })
              .map((user) => user.id);

            setSelectedUsers(matched);
            setQuickDepartment("");
            setQuickDesignation("");
          }}
        >
          My Dept (
          {
            filteredUsers.filter((user) => {
              const myDeptId =
                currentUser?.departmentId || "";
              const myDept = String(
                currentUser?.department ||
                  currentUser?.departmentName ||
                  ""
              ).toLowerCase();

              const userDeptId =
                user.departmentId || "";
              const userDept = getField(
                user,
                fieldKeys.department
              ).toLowerCase();

              return (
                (userDeptId &&
                  userDeptId === myDeptId) ||
                (userDept &&
                  userDept === myDept)
              );
            }).length
          }
          )
        </button>
      </div>

      {/* Filters + Search + Assign */}
      <div className="ac-card ac-filter-row">
        <div className="ac-search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="text" placeholder="Search name, email, designation, city..." value={search} onChange={(e) => { setSearch(e.target.value); setSelectedUsers([]); }} />
        </div>
        <select className="ac-filter-select" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setSelectedUsers([]); }}>
          <option value="">All Roles</option>
          {roleOptions.map((role, index) => (
            <option
              key={makeOptionKey(
                "filter-role",
                role,
                index
              )}
              value={role}
            >
              {getRoleBadge(role).label}
            </option>
          ))}
        </select>
        <select className="ac-filter-select" value={zoneFilter} onChange={(e) => { setZoneFilter(e.target.value); setStateFilter(""); setSelectedUsers([]); }}>
          <option value="">All Zones</option>
          {zoneOptions.map((zone, index) => (
            <option
              key={makeOptionKey(
                "filter-zone",
                zone,
                index
              )}
              value={zone}
            >
              {zone}
            </option>
          ))}
        </select>
        <select className="ac-filter-select" value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setSelectedUsers([]); }}>
          <option value="">All States</option>
          {stateOptions.map((state, index) => (
            <option
              key={makeOptionKey(
                "filter-state",
                state,
                index
              )}
              value={state}
            >
              {state}
            </option>
          ))}
        </select>
        <select
          className="ac-filter-select"
          value={departmentFilter}
          onChange={(e) => {
            setDepartmentFilter(e.target.value);
            setSelectedUsers([]);
            setQuickDepartment("");
            setQuickDesignation("");
          }}
        >
          <option value="">All Departments</option>
          {departmentOptions.map(
            (department, index) => (
              <option
                key={makeOptionKey(
                  "filter-department",
                  department,
                  index
                )}
                value={department}
              >
                {department}
              </option>
            )
          )}
        </select>

        <select
          className="ac-filter-select"
          value={designationFilter}
          onChange={(e) => {
            setDesignationFilter(e.target.value);
            setSelectedUsers([]);
            setQuickDepartment("");
            setQuickDesignation("");
          }}
        >
          <option value="">All Designations</option>
          {designationOptions.map(
            (designation, index) => (
              <option
                key={makeOptionKey(
                  "filter-designation",
                  designation,
                  index
                )}
                value={designation}
              >
                {designation}
              </option>
            )
          )}
        </select>

        <button
          className="ac-btn ac-btn-clear"
          onClick={resetFilters}
        >
          Clear
        </button>
      </div>

      {/* User Table */}
      <div className="ac-card">
        <div className="ac-table-header">
          <div>
            <h2>Available Users</h2>
            <p>{filteredUsers.length} users found • {selectedUsers.length} selected</p>
          </div>
          <button className="ac-btn ac-btn-assign" onClick={assignCourse} disabled={assigning || selectedUsers.length === 0}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            {assigning ? "Assigning..." : `Assign (${selectedUsers.length})`}
          </button>
        </div>

        <div className="ac-table-wrap">
          <table>
            <thead>
              <tr>
                <th className="ac-th-check">
                  <input type="checkbox" checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0} onChange={() => selectedUsers.length === filteredUsers.length ? deselectAll() : selectAll()} />
                </th>
                <th>#</th>
                <th>User</th>
                <th>Role</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr><td colSpan="8" className="ac-empty">No users available for this course.</td></tr>
              ) : (
                filteredUsers.map((user, idx) => {
                  const selected = selectedUsers.includes(user.id);
                  const status = getUserCourseStatus(user.id);
                  const badge = getRoleBadge(getField(user, ["role"]));
                  const location = [getField(user, fieldKeys.city), getField(user, fieldKeys.state), getField(user, fieldKeys.zone)].filter(Boolean).join(", ") || "-";
                  const userDepartment = getField(
                    user,
                    fieldKeys.department
                  );

                  const currentDepartment = String(
                    currentUser?.department ||
                      currentUser?.departmentName ||
                      ""
                  ).trim();

                  const isSameDept =
                    isDeptAdmin &&
                    (
                      (
                        user.departmentId &&
                        user.departmentId ===
                          (currentUser?.departmentId || "")
                      ) ||
                      (
                        userDepartment &&
                        userDepartment.toLowerCase() ===
                          currentDepartment.toLowerCase()
                      )
                    );

                  return (
                    <tr
                      key={
                        user.id ||
                        user.uid ||
                        user.email ||
                        `user-${idx}`
                      }
                      className={`${selected ? "selected" : ""} ${
                        isSameDept ? "same-dept" : ""
                      }`}
                      onClick={() => toggleUser(user.id)}
                    >
                      <td className="ac-td-check"><input type="checkbox" checked={selected} onChange={() => toggleUser(user.id)} onClick={(e) => e.stopPropagation()} /></td>
                      <td className="ac-td-idx">{idx + 1}</td>
                      <td className="ac-td-name">
                        <strong>{user.name || "Unnamed"}</strong>
                        <span>{user.email}</span>
                      </td>
                      <td><span className={`ac-role-badge ${badge.cls}`}>{badge.label}</span></td>
                      <td>
                        {getField(
                          user,
                          fieldKeys.department
                        ) || "-"}
                      </td>
                      <td>{getField(user, fieldKeys.designation) || "-"}</td>
                      <td className="ac-td-location">{location}</td>
                      <td>
                        <span
                          className={`ac-status ${status}`}
                        >
                          {status === "notAssigned"
                            ? "Not Assigned"
                            : status === "latestNotAssigned"
                            ? "Update Needed"
                            : status ===
                              "updatedAfterCompletion"
                            ? "Course Updated"
                            : status ===
                              "completedLatest"
                            ? "Completed"
                            : "Assigned"}
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
