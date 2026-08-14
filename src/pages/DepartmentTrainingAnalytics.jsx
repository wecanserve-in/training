import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/departmenttraininganalytics.css";
import * as XLSX from "xlsx";
import {
  isAnalyticsTrainingUser,
  getUserKeys,
  mergeUserRecords,
  isAssignmentActive,
  isCourseCompletedForUser,
} from "../utils/trainingAnalytics";

function DepartmentAnalytics() {
  const [, setCurrentUser] = useState(null);

  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);

  const [assignments, setAssignments] = useState({});
  const [completedCourses, setCompletedCourses] = useState({});
  const [progress, setProgress] = useState({});
  const [courseProgress, setCourseProgress] = useState({});
  const [videoProgress, setVideoProgress] = useState({});

  const [loading, setLoading] = useState(true);

  const [selectedCourseId, setSelectedCourseId] = useState("");

  // search
  const [search, setSearch] = useState("");

  // Filters
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedState, setSelectedState] = useState("");

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
          courseProgressSnap,
          videoProgressSnap,
        ] = await Promise.all([
          get(ref(database, "courses")),
          get(ref(database, "users")),
          get(ref(database, "userAssignments")),
          get(ref(database, "completedCourses")),
          get(ref(database, "progress")),
          get(ref(database, "courseProgress")),
          get(ref(database, "videoProgress")),
        ]);

        const allCourses = coursesSnap.exists()
          ? Object.entries(coursesSnap.val()).map(([id, value]) => ({
              id,
              ...value,
            }))
          : [];

        const normalizedAdminRole = String(adminData.role || "")
          .trim()
          .toLowerCase()
          .replace(/[\s_-]+/g, "");

        const canSeeAllCourses =
          normalizedAdminRole === "admin" ||
          normalizedAdminRole === "superadmin";

        const normalizeValue = (value) =>
          String(value || "").trim().toLowerCase();

        const adminIdentityKeys = new Set(
          [
            loggedUser.uid,
            adminData.id,
            adminData.uid,
            adminData.email,
          ]
            .filter(Boolean)
            .map(normalizeValue)
        );

        const isOwnCourse = (course) => {
          const creatorValues = [
            course.createdBy,
            course.createdById,
            course.createdByUid,
            course.createdByEmail,
            course.creatorId,
            course.creatorUid,
            course.creatorEmail,
            course.ownerId,
            course.ownerUid,
            course.ownerEmail,
          ]
            .filter(Boolean)
            .map(normalizeValue);

          return creatorValues.some((value) =>
            adminIdentityKeys.has(value)
          );
        };

        const isSameDepartment = (userOrCourse) => {
          const itemDepartmentId = String(
            userOrCourse?.departmentId || ""
          ).trim();

          const adminDepartmentId = String(
            adminData.departmentId || ""
          ).trim();

          const itemDepartment = normalizeValue(
            userOrCourse?.department ||
              userOrCourse?.departmentName
          );

          const adminDepartment = normalizeValue(
            adminData.department ||
              adminData.departmentName
          );

          const sameDepartmentId =
            itemDepartmentId &&
            adminDepartmentId &&
            itemDepartmentId === adminDepartmentId;

          const sameDepartmentName =
            itemDepartment &&
            adminDepartment &&
            itemDepartment === adminDepartment;

          return Boolean(
            sameDepartmentId || sameDepartmentName
          );
        };

        /*
         * Admin/Super Admin: all courses.
         * Department Admin: own courses plus courses from
         * their department.
         */
        const visibleCourses = canSeeAllCourses
          ? allCourses
          : allCourses.filter(
              (course) =>
                isOwnCourse(course) ||
                isSameDepartment(course)
            );

        const allUsers = usersSnap.exists()
          ? Object.entries(usersSnap.val()).map(([id, value]) => ({
              id,
              uid: value?.uid || id,
              ...value,
            }))
          : [];

        const assignmentData = assignmentSnap.exists()
          ? assignmentSnap.val()
          : {};

        const visibleCourseIds = new Set(
          visibleCourses.map((course) => String(course.id))
        );

        const canSeeAllUsers =
          normalizedAdminRole === "admin" ||
          normalizedAdminRole === "superadmin";

        /*
         * Department Admin can see:
         * 1. learners from their own department
         * 2. learners assigned to any course visible to them,
         *    even when those learners belong to another department.
         */
        const visibleUsers = allUsers.filter((user) => {
          if (!isAnalyticsTrainingUser(user)) return false;

          if (canSeeAllUsers) return true;

          const userAssignments =
            mergeUserRecords(assignmentData, user) || {};

          const assignedToVisibleCourse = Object.entries(
            userAssignments
          ).some(
            ([courseId, assignment]) =>
              visibleCourseIds.has(String(courseId)) &&
              isAssignmentActive(assignment)
          );

          return (
            isSameDepartment(user) ||
            assignedToVisibleCourse
          );
        });

        /*
         * Deduplicate by UID first, then Firebase key, then email.
         * This avoids showing the same learner twice when old data
         * exists under both id and uid.
         */
        const uniqueUsers = new Map();

        visibleUsers.forEach((user) => {
          const key = normalizeValue(
            user.uid || user.id || user.email
          );

          if (!key) return;

          uniqueUsers.set(key, {
            ...(uniqueUsers.get(key) || {}),
            ...user,
          });
        });

        const dedupedUsers = Array.from(uniqueUsers.values());

        setCourses(visibleCourses);
        setUsers(dedupedUsers);

        setSelectedCourseId((currentCourseId) => {
          if (
            currentCourseId &&
            visibleCourses.some(
              (course) =>
                String(course.id) ===
                String(currentCourseId)
            )
          ) {
            return currentCourseId;
          }

          return visibleCourses[0]?.id || "";
        });

        setAssignments(
          assignmentSnap.exists() ? assignmentSnap.val() : {}
        );

        setCompletedCourses(
          completedSnap.exists() ? completedSnap.val() : {}
        );

        setProgress(
          progressSnap.exists() ? progressSnap.val() : {}
        );

        setCourseProgress(
          courseProgressSnap.exists() ? courseProgressSnap.val() : {}
        );

        setVideoProgress(
          videoProgressSnap.exists() ? videoProgressSnap.val() : {}
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

  const getCourseStatusForUser = (user, courseId) => {
    const userAssignments =
      mergeUserRecords(assignments, user) || {};

    const assignment = userAssignments[courseId];

    if (!isAssignmentActive(assignment)) {
      return "notAssigned";
    }

    if (
      isCourseCompletedForUser(
        user,
        courseId,
        completedCourses,
        courseProgress,
        videoProgress
      )
    ) {
      return "completed";
    }

    const mergedCourseProgress =
      mergeUserRecords(courseProgress, user) || {};

    const courseProgressRecord =
      mergedCourseProgress[courseId];

    if (
      courseProgressRecord?.courseTestPassed === true ||
      courseProgressRecord?.passed === true ||
      courseProgressRecord?.completed === true
    ) {
      return "completed";
    }

    const mergedVideoProgress =
      mergeUserRecords(videoProgress, user) || {};

    const videoEntries = mergedVideoProgress[courseId];

    if (
      videoEntries &&
      typeof videoEntries === "object"
    ) {
      const values = Object.values(videoEntries);

      const hasVideoStarted = values.some(
        (video) =>
          video?.completed === true ||
          Number(
            video?.watchedPercent ??
              video?.progressPercent ??
              video?.progress ??
              0
          ) > 0
      );

      if (hasVideoStarted) {
        return "inProgress";
      }
    }

    const mergedLegacyProgress = getUserKeys(user).reduce(
      (merged, key) => ({
        ...merged,
        ...(progress?.[key] || {}),
      }),
      {}
    );

    const hasLegacyProgress = Object.values(
      mergedLegacyProgress
    ).some(
      (video) =>
        String(video?.courseId || "") ===
          String(courseId) &&
        (
          video?.completed === true ||
          Number(video?.watchedPercent || 0) > 0
        )
    );

    return hasLegacyProgress
      ? "inProgress"
      : "notStarted";
  };

  const courseStats = useMemo(() => {
  return courses.map((course) => {
    let assigned = 0;
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;

    users.forEach((user) => {
      const userAssignments =
        mergeUserRecords(assignments, user) || {};

      const assignment =
        userAssignments[course.id];

      // Count ONLY an actually active assignment
      if (!isAssignmentActive(assignment)) {
        return;
      }

      assigned++;

      const status = getCourseStatusForUser(
        user,
        course.id
      );

      if (status === "completed") {
        completed++;
      } else if (status === "inProgress") {
        inProgress++;
      } else {
        notStarted++;
      }
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
  courseProgress,
  videoProgress,
]);

  const selectedCourse = courseStats.find(
    (course) => course.id === selectedCourseId
  );

  const getUserZoneValue = (user) =>
    String(
      user?.zone ||
        user?.Zone ||
        user?.zoneName ||
        ""
    ).trim();

  const getUserStateValue = (user) =>
    String(
      user?.state ||
        user?.State ||
        user?.stateName ||
        ""
    ).trim();

  const assignedUsersForSelectedCourse = useMemo(() => {
    if (!selectedCourseId) return [];

    return users
      .map((user) => ({
        ...user,
        status: getCourseStatusForUser(
          user,
          selectedCourseId
        ),
      }))
      .filter(
        (user) => user.status !== "notAssigned"
      );
  }, [
    users,
    selectedCourseId,
    assignments,
    completedCourses,
    progress,
    courseProgress,
    videoProgress,
  ]);

  const zoneOptions = useMemo(() => {
    return [
      ...new Set(
        assignedUsersForSelectedCourse
          .map(getUserZoneValue)
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [assignedUsersForSelectedCourse]);

  const stateOptions = useMemo(() => {
    const usersForState = selectedZone
      ? assignedUsersForSelectedCourse.filter(
          (user) =>
            getUserZoneValue(user) === selectedZone
        )
      : assignedUsersForSelectedCourse;

    return [
      ...new Set(
        usersForState
          .map(getUserStateValue)
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [
    assignedUsersForSelectedCourse,
    selectedZone,
  ]);

  const selectedUsers = useMemo(() => {
    if (!selectedCourseId) return [];

    return assignedUsersForSelectedCourse
      .filter((user) => {
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

        const zoneMatch = selectedZone
          ? getUserZoneValue(user) === selectedZone
          : true;

        const stateMatch = selectedState
          ? getUserStateValue(user) === selectedState
          : true;

        return (
          searchMatch &&
          statusMatch &&
          zoneMatch &&
          stateMatch
        );
      });
  }, [
    assignedUsersForSelectedCourse,
    selectedCourseId,
    search,
    selectedStatus,
    selectedZone,
    selectedState,
  ]);

  const makeStableKey = (prefix, value, index) => {
    const normalizedValue = String(value || "empty")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

    return `${prefix}-${normalizedValue}-${index}`;
  };

  const downloadDepartmentReport = () => {
  if (!selectedCourse) {
    alert("Please select a course first.");
    return;
  }

  const reportData = selectedUsers.map((user) => ({
    Name: user.name || "",
    Email: user.email || "",
    Designation: user.designation || user.userRole || "",
    Department:
      user.department ||
      user.departmentName ||
      "",
    City: user.city || user.cityArea || user.area || "",
    State: getUserStateValue(user),
    Zone: getUserZoneValue(user),
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

    const safeCourseTitle = String(
      selectedCourse.title || "Department"
    )
      .replace(/[\\/:*?"<>|]+/g, "-")
      .trim();

    XLSX.writeFile(
      workbook,
      `${safeCourseTitle}_Report.xlsx`
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

          {courseStats.map((course, courseIndex) => (

            <div
              key={
                course.id ||
                makeStableKey(
                  "course",
                  course.title || course.courseTitle,
                  courseIndex
                )
              }
              onClick={() => {
                setSelectedCourseId(course.id);
                setSelectedStatus("");
                setSelectedZone("");
                setSelectedState("");
                setSearch("");
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

      <select
        className="analytics-filter-select"
        value={selectedZone}
        onChange={(e) => {
          setSelectedZone(e.target.value);
          setSelectedState("");
        }}
      >
        <option key="zone-all" value="">All Zones</option>
        {zoneOptions.map((zone, zoneIndex) => (
          <option
            key={`zone-option-${zoneIndex}`}
            value={zone}
          >
            {zone}
          </option>
        ))}
      </select>

      <select
        className="analytics-filter-select"
        value={selectedState}
        onChange={(e) =>
          setSelectedState(e.target.value)
        }
      >
        <option key="state-all" value="">All States</option>
        {stateOptions.map((state, stateIndex) => (
          <option
            key={`state-option-${stateIndex}`}
            value={state}
          >
            {state}
          </option>
        ))}
      </select>

      {(selectedStatus ||
        selectedZone ||
        selectedState ||
        search) && (
        <button
          className="clear-filter-btn"
          onClick={() => {
            setSelectedStatus("");
            setSelectedZone("");
            setSelectedState("");
            setSearch("");
          }}
        >
          Clear Filters
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

        selectedUsers.map((user, userIndex) => (

          <tr
            key={
              user.id ||
              user.uid ||
              user.email ||
              makeStableKey(
                "user",
                user.name,
                userIndex
              )
            }
          >

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
              {user.department ||
                user.departmentName ||
                "-"}
            </td>

            <td>

              {[
                user.city ||
                  user.cityArea ||
                  user.area,
                getUserStateValue(user),
                getUserZoneValue(user),
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

export default DepartmentAnalytics;