import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, ref, remove } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/departmentmembers.css";

function DepartmentMembers() {
  const [currentUser, setCurrentUser] = useState(null);

  const [allUsers, setAllUsers] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [progress, setProgress] = useState({});
  const [completedCourses, setCompletedCourses] = useState({});
  const [results, setResults] = useState({});
  const [videoLibrary, setVideoLibrary] = useState([]);
  const [oldVideos, setOldVideos] = useState([]);
  const [courseVideos, setCourseVideos] = useState({});

  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unassigningId, setUnassigningId] = useState("");

  const normalize = (value) => String(value || "").trim().toLowerCase();

  const getRole = (user) => normalize(user?.role);

  const isAdminRole = (role) => {
    const cleanRole = normalize(role);
    return cleanRole === "admin" || cleanRole === "superadmin";
  };

  const isDepartmentAdminRole = (role) => {
    const cleanRole = normalize(role);

    return (
      cleanRole === "departmentadmin" ||
      cleanRole === "department admin" ||
      cleanRole === "department_admin" ||
      cleanRole === "deptadmin" ||
      cleanRole === "dept admin"
    );
  };

  const sameText = (a, b) => {
    const first = normalize(a);
    const second = normalize(b);
    return Boolean(first && second && first === second);
  };

  const getTime = (value) => {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  };

  const objectToArray = (data) => {
    if (!data || typeof data !== "object") return [];

    return Object.entries(data).map(([id, value]) => ({
      id,
      ...(value && typeof value === "object" ? value : {}),
    }));
  };

  const getDepartmentName = (item) => {
    return (
      item?.department ||
      item?.departmentName ||
      item?.departmentType ||
      item?.dept ||
      item?.deptName ||
      ""
    );
  };

  const getCourseTitle = (course) => {
    return (
      course?.title ||
      course?.courseTitle ||
      course?.courseName ||
      course?.name ||
      "Untitled Course"
    );
  };

  const getCourseDescription = (course) => {
    return course?.description || course?.overview || "No description added.";
  };

  const getCourseThumbnail = (course, videos = []) => {
    if (course?.thumbnailUrl) return course.thumbnailUrl;
    if (course?.courseThumbnail) return course.courseThumbnail;
    if (course?.imageUrl) return course.imageUrl;

    const videoWithThumb = videos.find(
      (video) => video.thumbnailUrl || video.thumbnailURL || video.thumbnail
    );

    return (
      videoWithThumb?.thumbnailUrl ||
      videoWithThumb?.thumbnailURL ||
      videoWithThumb?.thumbnail ||
      ""
    );
  };

  const getUserName = (user) => {
    return user?.name || user?.fullName || user?.displayName || "Unnamed User";
  };

  const getDesignation = (user) => {
    return (
      user?.designation ||
      user?.userRole ||
      user?.jobTitle ||
      user?.roleTitle ||
      user?.position ||
      "-"
    );
  };

  const getLocation = (user) => {
    return (
      [user?.city || user?.cityArea || user?.area, user?.state, user?.zone]
        .filter(Boolean)
        .join(", ") || "-"
    );
  };

  const getInitial = (user) => {
    return (getUserName(user) || user?.email || "U").charAt(0).toUpperCase();
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      try {
        if (!loggedUser) {
          setCurrentUser(null);
          setAuthReady(true);
          setLoading(false);
          return;
        }

        const userSnap = await get(ref(database, `users/${loggedUser.uid}`));

        if (!userSnap.exists()) {
          setCurrentUser(null);
          setAuthReady(true);
          setLoading(false);
          return;
        }

        const userData = {
          id: loggedUser.uid,
          email: loggedUser.email,
          ...userSnap.val(),
        };

        setCurrentUser(userData);
        setAuthReady(true);
      } catch (error) {
        console.error("Failed to load current user:", error);
        setCurrentUser(null);
        setAuthReady(true);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !currentUser) return;

    setLoading(true);

    const loadedPaths = new Set();

    const markLoaded = (path) => {
      loadedPaths.add(path);

      if (loadedPaths.size === 9) {
        setLoading(false);
      }
    };

    const watchPath = (path, setter, asArray = false) => {
      return onValue(
        ref(database, path),
        (snapshot) => {
          const value = snapshot.exists() ? snapshot.val() : asArray ? [] : {};
          setter(asArray ? objectToArray(value) : value);
          markLoaded(path);
        },
        (error) => {
          console.error(`Firebase error at ${path}:`, error);
          setter(asArray ? [] : {});
          markLoaded(path);
        }
      );
    };

    const unsubUsers = watchPath("users", setAllUsers, true);
    const unsubCourses = watchPath("courses", setAllCourses, true);
    const unsubAssignments = watchPath("userAssignments", setAssignments);
    const unsubProgress = watchPath("progress", setProgress);
    const unsubCompleted = watchPath("completedCourses", setCompletedCourses);
    const unsubResults = watchPath("results", setResults);
    const unsubVideoLibrary = watchPath("videoLibrary", setVideoLibrary, true);
    const unsubOldVideos = watchPath("videos", setOldVideos, true);
    const unsubCourseVideos = watchPath("courseVideos", setCourseVideos);

    return () => {
      unsubUsers();
      unsubCourses();
      unsubAssignments();
      unsubProgress();
      unsubCompleted();
      unsubResults();
      unsubVideoLibrary();
      unsubOldVideos();
      unsubCourseVideos();
    };
  }, [authReady, currentUser]);

  const currentRole = getRole(currentUser);
  const canSeeAll = isAdminRole(currentRole);

  const departmentName =
    currentUser?.department ||
    currentUser?.departmentName ||
    currentUser?.departmentType ||
    "";

  const users = useMemo(() => {
    return allUsers.filter((user) => {
      const role = getRole(user);
      return !isAdminRole(role) && !isDepartmentAdminRole(role);
    });
  }, [allUsers]);

  const userMap = useMemo(() => {
    const map = {};

    users.forEach((user) => {
      map[user.id] = user;
    });

    return map;
  }, [users]);

  const courses = useMemo(() => {
    const visibleCourses = canSeeAll
      ? allCourses
      : allCourses.filter((course) => {
          return (
            course.createdBy === currentUser?.id ||
            course.createdById === currentUser?.id ||
            sameText(course.createdByEmail, currentUser?.email) ||
            sameText(getDepartmentName(course), departmentName)
          );
        });

    return [...visibleCourses].sort(
      (a, b) => getTime(b.createdAt) - getTime(a.createdAt)
    );
  }, [allCourses, canSeeAll, currentUser, departmentName]);

  const courseIdSet = useMemo(() => {
    return new Set(courses.map((course) => String(course.id)));
  }, [courses]);

  const courseMap = useMemo(() => {
    const map = {};

    courses.forEach((course) => {
      map[course.id] = course;
    });

    return map;
  }, [courses]);

  const courseVideosMap = useMemo(() => {
    const map = {};
    const mergedVideos = [...videoLibrary, ...oldVideos];

    courses.forEach((course) => {
      const mappedVideos = courseVideos?.[course.id]
        ? Object.entries(courseVideos[course.id]).map(([videoId, video]) => ({
            id: videoId,
            ...video,
          }))
        : [];

      if (mappedVideos.length > 0) {
        map[course.id] = mappedVideos.sort(
          (a, b) => Number(a.order || 0) - Number(b.order || 0)
        );
        return;
      }

      if (Array.isArray(course.videoIds) && course.videoIds.length > 0) {
        map[course.id] = course.videoIds
          .map((videoId) =>
            mergedVideos.find((video) => String(video.id) === String(videoId))
          )
          .filter(Boolean);

        return;
      }

      map[course.id] = mergedVideos
        .filter((video) => String(video.courseId || "") === String(course.id))
        .sort((a, b) => getTime(a.createdAt) - getTime(b.createdAt));
    });

    return map;
  }, [courses, videoLibrary, oldVideos, courseVideos]);

  const isCompleted = (userId, courseId) => {
    const completed = completedCourses?.[userId]?.[courseId];
    const result = results?.[userId]?.[courseId];

    return Boolean(
      completed === true ||
        completed?.passed ||
        completed?.completed ||
        completed?.isCompleted ||
        result?.passed ||
        result?.completed ||
        result?.isPassed
    );
  };

  const getUserCourseProgress = (userId, courseId) => {
    if (isCompleted(userId, courseId)) return 100;

    const userProgress = progress?.[userId] || {};
    const courseVideosForUser = courseVideosMap?.[courseId] || [];
    const videoIds = new Set(courseVideosForUser.map((video) => String(video.id)));

    if (courseVideosForUser.length > 0) {
      const total = courseVideosForUser.reduce((sum, video) => {
        const videoProgress = userProgress?.[video.id];

        if (videoProgress?.completed) return sum + 100;

        return sum + Number(videoProgress?.watchedPercent || 0);
      }, 0);

      return Math.max(
        0,
        Math.min(100, Math.round(total / courseVideosForUser.length))
      );
    }

    const relevantProgress = Object.entries(userProgress).filter(([, item]) => {
      return String(item?.courseId || "") === String(courseId);
    });

    if (relevantProgress.length === 0) return 0;

    const total = relevantProgress.reduce((sum, [, item]) => {
      if (item?.completed) return sum + 100;
      return sum + Number(item?.watchedPercent || 0);
    }, 0);

    return Math.max(
      0,
      Math.min(100, Math.round(total / relevantProgress.length))
    );
  };

  const getUserCourseStatus = (userId, courseId) => {
    const assignment = assignments?.[userId]?.[courseId];

    if (!assignment?.assigned) return "notAssigned";

    if (isCompleted(userId, courseId)) return "completed";

    const percent = getUserCourseProgress(userId, courseId);

    if (percent > 0) return "inProgress";

    return "notStarted";
  };

  const getStatusLabel = (status) => {
    if (status === "completed") return "Completed";
    if (status === "inProgress") return "In Progress";
    if (status === "notStarted") return "Not Started";
    return "Not Assigned";
  };

  const assignmentRows = useMemo(() => {
    const rows = [];

    Object.entries(assignments || {}).forEach(([userId, userAssignments]) => {
      const user = userMap[userId];

      if (!user) return;

      Object.entries(userAssignments || {}).forEach(([courseId, assignment]) => {
        if (!assignment?.assigned) return;
        if (!courseIdSet.has(String(courseId))) return;

        const course = courseMap[courseId];

        if (!course) return;

        const progressPercent = getUserCourseProgress(userId, courseId);
        const status = getUserCourseStatus(userId, courseId);

        rows.push({
          id: `${userId}-${courseId}`,
          userId,
          courseId,
          user,
          course,
          assignment,
          status,
          progressPercent,
          started: status === "inProgress" || status === "completed",
        });
      });
    });

    return rows.sort(
      (a, b) => getTime(b.assignment?.assignedAt) - getTime(a.assignment?.assignedAt)
    );
  }, [
    assignments,
    userMap,
    courseMap,
    courseIdSet,
    courseVideosMap,
    completedCourses,
    results,
    progress,
  ]);

  const stats = useMemo(() => {
    return assignmentRows.reduce(
      (acc, row) => {
        acc.total += 1;

        if (row.started) acc.started += 1;
        if (row.status === "completed") acc.completed += 1;
        if (row.status === "inProgress") acc.inProgress += 1;
        if (row.status === "notStarted") acc.notStarted += 1;

        return acc;
      },
      {
        total: 0,
        started: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
      }
    );
  }, [assignmentRows]);

  const courseOptions = useMemo(() => {
    return courses
      .map((course) => ({
        id: course.id,
        title: getCourseTitle(course),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [courses]);

  const filteredRows = useMemo(() => {
    const value = search.toLowerCase().trim();

    return assignmentRows.filter((row) => {
      const searchableText = [
        getUserName(row.user),
        row.user.email,
        getDepartmentName(row.user),
        getDesignation(row.user),
        getLocation(row.user),
        getCourseTitle(row.course),
        getCourseDescription(row.course),
        getDepartmentName(row.course),
        getStatusLabel(row.status),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !value || searchableText.includes(value);
      const matchesCourse = !courseFilter || row.courseId === courseFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "started" && row.started) ||
        row.status === statusFilter;

      return matchesSearch && matchesCourse && matchesStatus;
    });
  }, [assignmentRows, search, courseFilter, statusFilter]);

  const courseGroups = useMemo(() => {
    return courses
      .map((course) => {
        const rows = filteredRows.filter((row) => row.courseId === course.id);

        if (rows.length === 0) return null;

        const completed = rows.filter((row) => row.status === "completed").length;
        const inProgress = rows.filter((row) => row.status === "inProgress").length;
        const notStarted = rows.filter((row) => row.status === "notStarted").length;
        const started = rows.filter((row) => row.started).length;

        const completionRate =
          rows.length > 0 ? Math.round((completed / rows.length) * 100) : 0;

        const videos = courseVideosMap?.[course.id] || [];

        return {
          course,
          rows,
          completed,
          inProgress,
          notStarted,
          started,
          completionRate,
          videos,
          thumbnail: getCourseThumbnail(course, videos),
        };
      })
      .filter(Boolean);
  }, [courses, filteredRows, courseVideosMap]);

  const removeAssignment = async (row) => {
    const userName = getUserName(row.user);
    const courseTitle = getCourseTitle(row.course);

    const confirmRemove = window.confirm(
      `Unassign "${courseTitle}" from ${userName}?`
    );

    if (!confirmRemove) return;

    try {
      setUnassigningId(row.id);
      await remove(ref(database, `userAssignments/${row.userId}/${row.courseId}`));
    } catch (error) {
      console.error("Failed to unassign:", error);
      alert("Failed to unassign course.");
    } finally {
      setUnassigningId("");
    }
  };

  if (loading) {
    return <div className="tracker-page">Loading assignments...</div>;
  }

  return (
    <div className="tracker-page">
      <div className="tracker-stats-grid">
        <button
          type="button"
          className={`tracker-stat-card ${statusFilter === "all" ? "active" : ""}`}
          onClick={() => setStatusFilter("all")}
        >
          <h3>{stats.total}</h3>
          <p>Total Assigned</p>
        </button>

        <button
          type="button"
          className={`tracker-stat-card ${statusFilter === "started" ? "active" : ""}`}
          onClick={() => setStatusFilter("started")}
        >
          <h3>{stats.started}</h3>
          <p>Started</p>
        </button>

        <button
          type="button"
          className={`tracker-stat-card ${statusFilter === "inProgress" ? "active" : ""}`}
          onClick={() => setStatusFilter("inProgress")}
        >
          <h3>{stats.inProgress}</h3>
          <p>In Progress</p>
        </button>

        <button
          type="button"
          className={`tracker-stat-card ${statusFilter === "notStarted" ? "active" : ""}`}
          onClick={() => setStatusFilter("notStarted")}
        >
          <h3>{stats.notStarted}</h3>
          <p>Not Started</p>
        </button>

        <button
          type="button"
          className={`tracker-stat-card ${statusFilter === "completed" ? "active" : ""}`}
          onClick={() => setStatusFilter("completed")}
        >
          <h3>{stats.completed}</h3>
          <p>Completed</p>
        </button>
      </div>

      <div className="tracker-filter-card">
        <input
          type="text"
          placeholder="Search course, user, email, designation, location..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          value={courseFilter}
          onChange={(event) => setCourseFilter(event.target.value)}
        >
          <option value="">All Courses</option>
          {courseOptions.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All Status</option>
          <option value="started">Started</option>
          <option value="inProgress">In Progress</option>
          <option value="notStarted">Not Started</option>
          <option value="completed">Completed</option>
        </select>

        <button
          type="button"
          onClick={() => {
            setSearch("");
            setCourseFilter("");
            setStatusFilter("all");
          }}
        >
          Clear
        </button>
      </div>

      <div className="tracker-course-groups">
        {courseGroups.length === 0 ? (
          <div className="tracker-empty-card">
            <h3>No assignment records found</h3>
            <p>Try changing search or filters.</p>
          </div>
        ) : (
          courseGroups.map((group) => (
            <section className="tracker-course-card" key={group.course.id}>
              <div className="tracker-course-head">
                <div className="tracker-course-thumb">
                  {group.thumbnail ? (
                    <img src={group.thumbnail} alt={getCourseTitle(group.course)} />
                  ) : (
                    <div>{getCourseTitle(group.course).charAt(0)}</div>
                  )}
                </div>

                <div className="tracker-course-info">
                  <div className="tracker-course-title-row">
                    <h2>{getCourseTitle(group.course)}</h2>
                    <span>{group.rows.length} Assigned</span>
                  </div>

                  <p>{getCourseDescription(group.course)}</p>

                  <div className="tracker-course-meta">
                    <span>{getDepartmentName(group.course) || departmentName || "Training"}</span>
                    <span>{group.videos.length || group.course.totalVideos || 0} Videos</span>
                    <span>{group.course.totalQuestions || 0} Questions</span>
                    <span>Pass {group.course.passingScore || 70}%</span>
                  </div>

                  <div className="tracker-course-progress">
                    <div>
                      <span style={{ width: `${group.completionRate}%` }}></span>
                    </div>
                    <strong>{group.completionRate}%</strong>
                  </div>
                </div>
              </div>

              <div className="tracker-course-mini-stats">
                <div>
                  <span>Started</span>
                  <b>{group.started}</b>
                </div>

                <div>
                  <span>In Progress</span>
                  <b>{group.inProgress}</b>
                </div>

                <div>
                  <span>Not Started</span>
                  <b>{group.notStarted}</b>
                </div>

                <div>
                  <span>Completed</span>
                  <b>{group.completed}</b>
                </div>
              </div>

              <div className="tracker-users-table-wrap">
                <table className="tracker-users-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Department</th>
                      <th>Designation</th>
                      <th>Location</th>
                      <th>Assigned On</th>
                      <th>Started</th>
                      <th>Progress</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="tracker-user-cell">
                            <div className="tracker-avatar">
                              {getInitial(row.user)}
                            </div>

                            <div>
                              <strong>{getUserName(row.user)}</strong>
                              <small>{row.user.email || "-"}</small>
                            </div>
                          </div>
                        </td>

                        <td>{getDepartmentName(row.user) || "-"}</td>
                        <td>{getDesignation(row.user)}</td>
                        <td>{getLocation(row.user)}</td>

                        <td>
                          {row.assignment?.assignedAt
                            ? new Date(row.assignment.assignedAt).toLocaleDateString("en-IN")
                            : "-"}
                        </td>

                        <td>
                          <span className={`tracker-started-pill ${row.started ? "yes" : "no"}`}>
                            {row.started ? "Started" : "Not Started"}
                          </span>
                        </td>

                        <td>
                          <div className="tracker-progress">
                            <div>
                              <span style={{ width: `${row.progressPercent}%` }}></span>
                            </div>
                            <b>{row.progressPercent}%</b>
                          </div>
                        </td>

                        <td>
                          <span className={`tracker-status ${row.status}`}>
                            {getStatusLabel(row.status)}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="tracker-unassign-btn"
                            disabled={unassigningId === row.id}
                            onClick={() => removeAssignment(row)}
                          >
                            {unassigningId === row.id ? "Removing..." : "Unassign"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

export default DepartmentMembers;