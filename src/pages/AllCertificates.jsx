import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import useBasePath from "../hooks/useBasePath";
import "../styles/allcertificates.css";

import {
  FaCertificate,
  FaCalendarCheck,
  FaUsers,
  FaBuilding,
  FaSearch,
  FaEye,
  FaFilter,
  FaTimes,
} from "react-icons/fa";

function AllCertificates() {
  const basePath = useBasePath();

  const [currentUser, setCurrentUser] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [filterUser, setFilterUser] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [showFilters, setShowFilters] = useState(false);

  const normalize = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]/g, "");

  const normalizeText = (value) =>
    String(value || "").trim().toLowerCase();

  const getRole = (user) => normalize(user?.role);

  const isDeptAdmin = (role) => {
    const normalizedRole = normalize(role);

    return (
      normalizedRole === "departmentadmin" ||
      normalizedRole === "deptadmin"
    );
  };

  const isSuperAdminOrAdmin = (role) => {
    const normalizedRole = normalize(role);

    return (
      normalizedRole === "superadmin" ||
      normalizedRole === "admin"
    );
  };

  const getDepartmentId = (user) =>
    user?.departmentId ||
    user?.deptId ||
    user?.department?.id ||
    "";

  const getDepartmentName = (user) =>
    user?.departmentName ||
    user?.department ||
    user?.departmentType ||
    user?.deptName ||
    "";

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        if (mounted) {
          setCurrentUser(null);
          setCertificates([]);
          setLoading(false);
        }

        return;
      }

      try {
        setLoading(true);

        const [currentUserSnap, allUsersSnap, departmentsSnap] =
          await Promise.all([
            get(ref(database, `users/${firebaseUser.uid}`)),
            get(ref(database, "users")),
            get(ref(database, "departments")),
          ]);

        const loggedInUser = currentUserSnap.exists()
          ? {
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              ...currentUserSnap.val(),
            }
          : null;

        if (!loggedInUser) {
          throw new Error("Logged-in user profile not found.");
        }

        const allUsers = allUsersSnap.exists()
          ? Object.entries(allUsersSnap.val()).map(([id, user]) => ({
              id,
              uid: id,
              ...user,
            }))
          : [];

        const departments = departmentsSnap.exists()
          ? departmentsSnap.val()
          : {};

        const role = getRole(loggedInUser);

        if (
          !isSuperAdminOrAdmin(role) &&
          !isDeptAdmin(role)
        ) {
          throw new Error(
            "You do not have permission to access certificates."
          );
        }

        let visibleUsers = [];

        if (isDeptAdmin(role)) {
          const loggedInDepartmentId =
            getDepartmentId(loggedInUser);

          const loggedInDepartmentName = normalizeText(
            getDepartmentName(loggedInUser)
          );

          visibleUsers = allUsers.filter((user) => {
            if (user.id === firebaseUser.uid) {
              return true;
            }

            const userRole = getRole(user);

            /*
              Keep Admin and Super Admin visible for Department Admin,
              as requested.
            */
            if (
              userRole === "superadmin" ||
              userRole === "admin"
            ) {
              return true;
            }

            const userDepartmentId = getDepartmentId(user);

            const userDepartmentName = normalizeText(
              getDepartmentName(user)
            );

            if (
              loggedInDepartmentId &&
              userDepartmentId === loggedInDepartmentId
            ) {
              return true;
            }

            if (
              loggedInDepartmentName &&
              userDepartmentName === loggedInDepartmentName
            ) {
              return true;
            }

            /*
              This supports users explicitly assigned by the
              Department Admin.
            */
            const assignedBy =
              user.assignedBy ||
              user.assignedByUid ||
              user.createdBy ||
              user.createdByUid ||
              "";

            if (assignedBy === firebaseUser.uid) {
              return true;
            }

            return false;
          });
        } else {
          visibleUsers = allUsers;
        }

        const userIdsToCheck = [
          ...new Set(
            [firebaseUser.uid, ...visibleUsers.map((user) => user.id)]
              .filter(Boolean)
          ),
        ];

        const certificateRecords = [];

        /*
          Process users in chunks to avoid firing too many Firebase
          requests simultaneously.
        */
        for (let index = 0; index < userIdsToCheck.length; index += 10) {
          const chunk = userIdsToCheck.slice(index, index + 10);

          const chunkResults = await Promise.all(
            chunk.map(async (uid) => {
              const user =
                allUsers.find((item) => item.id === uid) ||
                (uid === firebaseUser.uid ? loggedInUser : {});

              const completedCoursesSnap = await get(
                ref(database, `completedCourses/${uid}`)
              );

              if (!completedCoursesSnap.exists()) {
                return [];
              }

              const completedCourses =
                completedCoursesSnap.val();

              const passedCourses = Object.entries(
                completedCourses
              ).filter(([, completion]) => {
                /*
                  Only passed users with an attempt ID receive
                  certificates.
                */
                return (
                  completion?.passed === true &&
                  Boolean(completion?.attemptId)
                );
              });

              const userCertificates = await Promise.all(
                passedCourses.map(
                  async ([courseId, completion]) => {
                    const [
                      attemptSnap,
                      courseSnap,
                    ] = await Promise.all([
                      get(
                        ref(
                          database,
                          `attempts/${uid}/${completion.attemptId}`
                        )
                      ),
                      get(
                        ref(database, `courses/${courseId}`)
                      ),
                    ]);

                    const attempt = attemptSnap.exists()
                      ? attemptSnap.val()
                      : {};

                    const course = courseSnap.exists()
                      ? {
                          id: courseId,
                          ...courseSnap.val(),
                        }
                      : {
                          id: courseId,
                        };

                    const departmentId =
                      getDepartmentId(user) ||
                      course.departmentId ||
                      completion.departmentId ||
                      "";

                    const departmentFromDatabase =
                      departmentId &&
                      typeof departments[departmentId] ===
                        "object"
                        ? departments[departmentId]
                        : {};

                    const departmentName =
                      getDepartmentName(user) ||
                      course.departmentName ||
                      course.department ||
                      completion.departmentName ||
                      departmentFromDatabase?.name ||
                      departmentFromDatabase?.departmentName ||
                      "Not Assigned";

                    return {
                      courseId,
                      userId: uid,
                      departmentId,
                      departmentName,
                      ...completion,
                      attempt,
                      course,
                      userData: {
                        id: uid,
                        ...user,
                      },
                    };
                  }
                )
              );

              return userCertificates;
            })
          );

          chunkResults.forEach((records) => {
            certificateRecords.push(...records);
          });
        }

        certificateRecords.sort((first, second) => {
          const firstDate = new Date(
            first.completedAt ||
              first.attempt?.submittedAt ||
              first.createdAt ||
              0
          ).getTime();

          const secondDate = new Date(
            second.completedAt ||
              second.attempt?.submittedAt ||
              second.createdAt ||
              0
          ).getTime();

          return secondDate - firstDate;
        });

        if (mounted) {
          setCurrentUser(loggedInUser);
          setCertificates(certificateRecords);
        }
      } catch (error) {
        console.error("[All Certificates Error]", error);

        if (mounted) {
          setCertificates([]);
          alert(
            error?.message || "Failed to load certificates."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const getUserName = (certificate) =>
    certificate.userData?.name ||
    certificate.userData?.fullName ||
    certificate.userData?.displayName ||
    certificate.attempt?.userName ||
    "Unknown User";

  const getCourseTitle = (certificate) =>
    certificate.course?.title ||
    certificate.course?.courseTitle ||
    certificate.course?.name ||
    certificate.courseTitle ||
    certificate.attempt?.courseTitle ||
    "Untitled Course";

  const getCompletedDate = (certificate) =>
    certificate.completedAt ||
    certificate.attempt?.submittedAt ||
    certificate.issuedAt ||
    certificate.createdAt ||
    "";

  const uniqueUsers = useMemo(() => {
    const usersMap = new Map();

    certificates.forEach((certificate) => {
      const userId = certificate.userId;
      const userName = getUserName(certificate);

      if (userId && !usersMap.has(userId)) {
        usersMap.set(userId, userName);
      }
    });

    return [...usersMap.entries()].sort((first, second) =>
      first[1].localeCompare(second[1])
    );
  }, [certificates]);

  const uniqueDepartments = useMemo(() => {
    const departmentsMap = new Map();

    certificates.forEach((certificate) => {
      const departmentId =
        certificate.departmentId ||
        certificate.departmentName;

      const departmentName =
        certificate.departmentName || "Not Assigned";

      if (
        departmentId &&
        !departmentsMap.has(departmentId)
      ) {
        departmentsMap.set(
          departmentId,
          departmentName
        );
      }
    });

    return [...departmentsMap.entries()].sort(
      (first, second) =>
        first[1].localeCompare(second[1])
    );
  }, [certificates]);

  const uniqueCourses = useMemo(() => {
    const coursesMap = new Map();

    certificates.forEach((certificate) => {
      const courseId = certificate.courseId;
      const courseTitle =
        getCourseTitle(certificate);

      if (courseId && !coursesMap.has(courseId)) {
        coursesMap.set(courseId, courseTitle);
      }
    });

    return [...coursesMap.entries()].sort(
      (first, second) =>
        first[1].localeCompare(second[1])
    );
  }, [certificates]);

  const filteredCertificates = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    return certificates.filter((certificate) => {
      const userName = normalizeText(
        getUserName(certificate)
      );

      const userEmail = normalizeText(
        certificate.userData?.email
      );

      const courseTitle = normalizeText(
        getCourseTitle(certificate)
      );

      const departmentName = normalizeText(
        certificate.departmentName
      );

      const certificateId = normalizeText(
        certificate.attemptId
      );

      if (normalizedSearch) {
        const matchesSearch =
          userName.includes(normalizedSearch) ||
          userEmail.includes(normalizedSearch) ||
          courseTitle.includes(normalizedSearch) ||
          departmentName.includes(normalizedSearch) ||
          certificateId.includes(normalizedSearch);

        if (!matchesSearch) {
          return false;
        }
      }

      if (
        filterUser &&
        certificate.userId !== filterUser
      ) {
        return false;
      }

      if (filterDepartment) {
        const certificateDepartmentKey =
          certificate.departmentId ||
          certificate.departmentName;

        if (
          certificateDepartmentKey !== filterDepartment
        ) {
          return false;
        }
      }

      if (
        filterCourse &&
        certificate.courseId !== filterCourse
      ) {
        return false;
      }

      const completedDate =
        getCompletedDate(certificate);

      if (filterDateFrom) {
        if (!completedDate) {
          return false;
        }

        const certificateDate = new Date(completedDate);
        const fromDate = new Date(filterDateFrom);

        fromDate.setHours(0, 0, 0, 0);

        if (certificateDate < fromDate) {
          return false;
        }
      }

      if (filterDateTo) {
        if (!completedDate) {
          return false;
        }

        const certificateDate = new Date(completedDate);
        const toDate = new Date(filterDateTo);

        toDate.setHours(23, 59, 59, 999);

        if (certificateDate > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [
    certificates,
    search,
    filterUser,
    filterDepartment,
    filterCourse,
    filterDateFrom,
    filterDateTo,
  ]);

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "-";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateValue) => {
    if (!dateValue) {
      return "-";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const totalCertificates = certificates.length;

  const uniqueCertifiedUsers = useMemo(() => {
    return new Set(
      certificates
        .map((certificate) => certificate.userId)
        .filter(Boolean)
    ).size;
  }, [certificates]);

  const uniqueCertifiedDepartments = useMemo(() => {
    return new Set(
      certificates
        .map(
          (certificate) =>
            certificate.departmentId ||
            certificate.departmentName
        )
        .filter(Boolean)
    ).size;
  }, [certificates]);

  const thisMonthCount = useMemo(() => {
    const now = new Date();

    return certificates.filter((certificate) => {
      const completedDate =
        getCompletedDate(certificate);

      if (!completedDate) {
        return false;
      }

      const date = new Date(completedDate);

      if (Number.isNaN(date.getTime())) {
        return false;
      }

      return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    }).length;
  }, [certificates]);

  const hasActiveFilters = Boolean(
    filterUser ||
      filterDepartment ||
      filterCourse ||
      filterDateFrom ||
      filterDateTo
  );

  const clearFilters = () => {
    setSearch("");
    setFilterUser("");
    setFilterDepartment("");
    setFilterCourse("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  if (loading) {
    return (
      <div className="all-cert-loading">
        <div className="all-cert-loader" />

        <h2>Loading Certificates...</h2>

        <p>
          Please wait while certificate records are
          being loaded.
        </p>
      </div>
    );
  }

  return (
    <div className="all-certificates-page">
      <div className="all-cert-header">
        <div>
          <span className="all-cert-page-label">
            Learning Records
          </span>

          <h1>All Certificates</h1>

          <p>
            View certificates earned by users after
            successfully completing their assigned
            courses.
          </p>
        </div>

        <strong>
          {totalCertificates}{" "}
          {totalCertificates === 1
            ? "Certificate"
            : "Certificates"}
        </strong>
      </div>

      <div className="all-cert-stats-row">
        <div className="all-cert-stat-card">
          <div className="all-cert-stat-icon green">
            <FaCertificate />
          </div>

          <div className="all-cert-stat-info">
            <span>Total Earned</span>
            <strong>{totalCertificates}</strong>
          </div>
        </div>

        <div className="all-cert-stat-card">
          <div className="all-cert-stat-icon blue">
            <FaCalendarCheck />
          </div>

          <div className="all-cert-stat-info">
            <span>This Month</span>
            <strong>{thisMonthCount}</strong>
          </div>
        </div>

        <div className="all-cert-stat-card">
          <div className="all-cert-stat-icon purple">
            <FaUsers />
          </div>

          <div className="all-cert-stat-info">
            <span>Certified Users</span>
            <strong>{uniqueCertifiedUsers}</strong>
          </div>
        </div>

        <div className="all-cert-stat-card">
          <div className="all-cert-stat-icon orange">
            <FaBuilding />
          </div>

          <div className="all-cert-stat-info">
            <span>Departments</span>
            <strong>
              {uniqueCertifiedDepartments}
            </strong>
          </div>
        </div>
      </div>

      <div className="all-cert-toolbar">
        <div className="all-cert-search-bar">
          <FaSearch />

          <input
            type="search"
            placeholder="Search user, department, course or certificate ID..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <button
          type="button"
          className={`all-cert-filter-toggle ${
            showFilters ? "active" : ""
          }`}
          onClick={() =>
            setShowFilters((current) => !current)
          }
        >
          <FaFilter />

          <span>Filters</span>

          {hasActiveFilters && (
            <span className="all-cert-filter-badge">
              Active
            </span>
          )}
        </button>

        {(hasActiveFilters || search) && (
          <button
            type="button"
            className="all-cert-clear-btn"
            onClick={clearFilters}
          >
            <FaTimes />
            Clear
          </button>
        )}
      </div>

      {showFilters && (
        <div className="all-cert-filters-panel">
          <div className="all-cert-filter-row">
            <div className="all-cert-filter-group">
              <label htmlFor="certificate-user-filter">
                User
              </label>

              <select
                id="certificate-user-filter"
                value={filterUser}
                onChange={(event) =>
                  setFilterUser(event.target.value)
                }
              >
                <option value="">All Users</option>

                {uniqueUsers.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="all-cert-filter-group">
              <label htmlFor="certificate-department-filter">
                Department
              </label>

              <select
                id="certificate-department-filter"
                value={filterDepartment}
                onChange={(event) =>
                  setFilterDepartment(event.target.value)
                }
              >
                <option value="">
                  All Departments
                </option>

                {uniqueDepartments.map(
                  ([id, departmentName]) => (
                    <option key={id} value={id}>
                      {departmentName}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="all-cert-filter-group">
              <label htmlFor="certificate-course-filter">
                Course
              </label>

              <select
                id="certificate-course-filter"
                value={filterCourse}
                onChange={(event) =>
                  setFilterCourse(event.target.value)
                }
              >
                <option value="">All Courses</option>

                {uniqueCourses.map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
              </select>
            </div>

            <div className="all-cert-filter-group">
              <label htmlFor="certificate-date-from">
                Date From
              </label>

              <input
                id="certificate-date-from"
                type="date"
                value={filterDateFrom}
                onChange={(event) =>
                  setFilterDateFrom(event.target.value)
                }
              />
            </div>

            <div className="all-cert-filter-group">
              <label htmlFor="certificate-date-to">
                Date To
              </label>

              <input
                id="certificate-date-to"
                type="date"
                value={filterDateTo}
                min={filterDateFrom || undefined}
                onChange={(event) =>
                  setFilterDateTo(event.target.value)
                }
              />
            </div>
          </div>
        </div>
      )}

      <div className="all-cert-results-header">
        <div>
          <strong>
            {filteredCertificates.length}
          </strong>

          <span>
            {filteredCertificates.length === 1
              ? " certificate found"
              : " certificates found"}
          </span>
        </div>

        {currentUser && (
          <small>
            Showing records available to{" "}
            {currentUser.name ||
              currentUser.fullName ||
              currentUser.email}
          </small>
        )}
      </div>

      {filteredCertificates.length === 0 ? (
        <div className="all-cert-empty">
          <div className="all-cert-empty-icon">
            <FaCertificate />
          </div>

          <h2>No certificates found</h2>

          <p>
            {hasActiveFilters || search
              ? "No certificate records match the selected filters or search."
              : "No certificates have been earned yet."}
          </p>

          {(hasActiveFilters || search) && (
            <button
              type="button"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="all-cert-table-wrap">
          <table className="all-cert-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Department</th>
                <th>Course</th>
                <th>Date</th>
                <th>Time</th>
                <th>Certificate ID</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredCertificates.map(
                (certificate, index) => {
                  const userName =
                    getUserName(certificate);

                  const courseTitle =
                    getCourseTitle(certificate);

                  const completedDate =
                    getCompletedDate(certificate);

                  const attemptId =
                    certificate.attemptId || "";

                  const certificateId = attemptId
                    ? `CERT-${attemptId
                        .slice(-8)
                        .toUpperCase()}`
                    : `CERT-${certificate.userId
                        ?.slice(-4)
                        .toUpperCase()}-${certificate.courseId
                        ?.slice(-4)
                        .toUpperCase()}`;

                  return (
                    <tr
                      key={`${certificate.userId}-${certificate.courseId}-${certificate.attemptId}-${index}`}
                    >
                      <td>
                        <div className="all-cert-user-cell">
                          <div className="all-cert-avatar">
                            {userName
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {userName}
                            </strong>

                            <span>
                              {certificate.userData
                                ?.email ||
                                "Email not available"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="all-cert-department-name">
                          {certificate.departmentName ||
                            "Not Assigned"}
                        </span>
                      </td>

                      <td>
                        <span className="all-cert-course-name">
                          {courseTitle}
                        </span>
                      </td>

                      <td>
                        {formatDate(completedDate)}
                      </td>

                      <td>
                        {formatTime(completedDate)}
                      </td>

                      <td>
                        <span className="all-cert-id">
                          {certificateId}
                        </span>
                      </td>

                      <td>
                        {attemptId ? (
                          <Link
                            to={`${basePath}/certificate/${attemptId}`}
                            className="all-cert-view-btn"
                          >
                            <FaEye />
                            View
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="all-cert-view-btn disabled"
                            disabled
                          >
                            <FaEye />
                            Unavailable
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AllCertificates;