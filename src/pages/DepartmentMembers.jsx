import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, ref } from "firebase/database";
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
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const getCourseThumbnail = (course) => {
    if (course?.thumbnailUrl) return course.thumbnailUrl;
    if (course?.courseThumbnail) return course.courseThumbnail;
    if (course?.thumbnail) return course.thumbnail;
    return "";
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
      if (loadedPaths.size === 9) setLoading(false);
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
      if (isAdminRole(role) || isDepartmentAdminRole(role)) return false;
      if (!departmentName) return true;
      return sameText(getDepartmentName(user), departmentName);
    });
  }, [allUsers, departmentName]);

  const courses = useMemo(() => {
    if (canSeeAll) return [...allCourses].sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));

    const userDeptId = String(currentUser?.departmentId || "").trim();
    const userDept = String(departmentName || "").trim().toLowerCase();

    if (!userDeptId && !userDept) return [];

    return allCourses
      .filter((course) => {
        const courseDeptId = String(course.departmentId || "").trim();
        const courseDept = String(getDepartmentName(course) || "").trim().toLowerCase();
        if (courseDeptId && userDeptId && courseDeptId === userDeptId) return true;
        if (courseDept && userDept && courseDept === userDept) return true;
        return false;
      })
      .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
  }, [allCourses, canSeeAll, currentUser, departmentName]);

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
    const videos = courseVideosMap?.[courseId] || [];

    if (videos.length > 0) {
      const total = videos.reduce((sum, video) => {
        const vp = userProgress?.[video.id];
        if (vp?.completed) return sum + 100;
        return sum + Number(vp?.watchedPercent || 0);
      }, 0);
      return Math.max(0, Math.min(100, Math.round(total / videos.length)));
    }

    const relevant = Object.entries(userProgress).filter(([, item]) =>
      String(item?.courseId || "") === String(courseId)
    );

    if (relevant.length === 0) return 0;

    const total = relevant.reduce((sum, [, item]) => {
      if (item?.completed) return sum + 100;
      return sum + Number(item?.watchedPercent || 0);
    }, 0);

    return Math.max(0, Math.min(100, Math.round(total / relevant.length)));
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

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((user) => {
      if (!q) return true;
      const text = [
        getUserName(user),
        user.email,
        getDesignation(user),
        getLocation(user),
        getDepartmentName(user),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [users, search]);

  const memberStats = useMemo(() => {
    const map = {};
    users.forEach((user) => {
      let assigned = 0, completed = 0, inProgress = 0, notStarted = 0;
      courses.forEach((course) => {
        const status = getUserCourseStatus(user.id, course.id);
        if (status === "notAssigned") return;
        assigned++;
        if (status === "completed") completed++;
        if (status === "inProgress") inProgress++;
        if (status === "notStarted") notStarted++;
      });
      const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
      map[user.id] = { assigned, completed, inProgress, notStarted, rate };
    });
    return map;
  }, [users, courses, assignments, completedCourses, results, progress, courseVideosMap]);

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return users.find((u) => u.id === selectedUserId) || null;
  }, [users, selectedUserId]);

  const selectedUserCourses = useMemo(() => {
    if (!selectedUserId) return [];
    return courses
      .map((course) => {
        const status = getUserCourseStatus(selectedUserId, course.id);
        if (status === "notAssigned") return null;
        const percent = getUserCourseProgress(selectedUserId, course.id);
        const thumb = getCourseThumbnail(course);
        const videoCount = (courseVideosMap?.[course.id] || []).length || course.totalVideos || 0;
        return {
          course,
          status,
          percent,
          thumb,
          videoCount,
          title: getCourseTitle(course),
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const order = { completed: 0, inProgress: 1, notStarted: 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
      });
  }, [selectedUserId, courses, assignments, completedCourses, results, progress, courseVideosMap]);

  const selectedUserStats = useMemo(() => {
    if (!selectedUserId) return { assigned: 0, completed: 0, inProgress: 0, notStarted: 0, rate: 0 };
    return memberStats[selectedUserId] || { assigned: 0, completed: 0, inProgress: 0, notStarted: 0, rate: 0 };
  }, [selectedUserId, memberStats]);

  if (loading) {
    return <div className="dm-page"><div className="dm-loading">Loading members...</div></div>;
  }

  return (
    <div className="dm-page">
      {/* Header */}
      <div className="dm-header">
        <div>
          <h1>Department Members</h1>
          <p>{users.length} members in {departmentName || "your department"}</p>
        </div>
      </div>

      <div className="dm-layout">
        {/* Left: Member List */}
        <div className="dm-member-panel">
          <div className="dm-search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              type="text"
              placeholder="Search members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="dm-member-list">
            {filteredUsers.length === 0 ? (
              <div className="dm-empty">No members found.</div>
            ) : (
              filteredUsers.map((user) => {
                const stats = memberStats[user.id] || {};
                const isSelected = selectedUserId === user.id;
                return (
                  <div
                    key={user.id}
                    className={`dm-member-row ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <div className="dm-member-avatar" style={{ background: isSelected ? "#059669" : "#e8f5ee", color: isSelected ? "#fff" : "#059669" }}>
                      {getInitial(user)}
                    </div>
                    <div className="dm-member-info">
                      <strong>{getUserName(user)}</strong>
                      <span>{getDesignation(user)}</span>
                    </div>
                    <div className="dm-member-mini-stat">
                      <span>{stats.assigned || 0}</span>
                      <small>Courses</small>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Member Detail */}
        <div className="dm-detail-panel">
          {!selectedUser ? (
            <div className="dm-detail-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <h3>Select a member</h3>
              <p>Click on a member's name to see their assigned courses and progress</p>
            </div>
          ) : (
            <>
              {/* Member Profile Card */}
              <div className="dm-profile-card">
                <div className="dm-profile-avatar">
                  {getInitial(selectedUser)}
                </div>
                <div className="dm-profile-info">
                  <h2>{getUserName(selectedUser)}</h2>
                  <p>{selectedUser.email || "-"}</p>
                  <div className="dm-profile-meta">
                    <span>{getDesignation(selectedUser)}</span>
                    <span>{getLocation(selectedUser)}</span>
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="dm-detail-stats">
                <div className="dm-detail-stat">
                  <strong>{selectedUserStats.assigned}</strong>
                  <span>Assigned</span>
                </div>
                <div className="dm-detail-stat completed">
                  <strong>{selectedUserStats.completed}</strong>
                  <span>Completed</span>
                </div>
                <div className="dm-detail-stat progress">
                  <strong>{selectedUserStats.inProgress}</strong>
                  <span>In Progress</span>
                </div>
                <div className="dm-detail-stat pending">
                  <strong>{selectedUserStats.notStarted}</strong>
                  <span>Not Started</span>
                </div>
                <div className="dm-detail-stat rate">
                  <strong>{selectedUserStats.rate}%</strong>
                  <span>Completion</span>
                </div>
              </div>

              {/* Course List */}
              <div className="dm-course-section">
                <h3>Assigned Courses ({selectedUserCourses.length})</h3>

                {selectedUserCourses.length === 0 ? (
                  <div className="dm-empty-courses">No courses assigned to this member.</div>
                ) : (
                  <div className="dm-course-list">
                    {selectedUserCourses.map((item) => (
                      <div className="dm-course-row" key={item.course.id}>
                        {item.thumb ? (
                          <img className="dm-course-thumb" src={item.thumb} alt={item.title} />
                        ) : (
                          <div className="dm-course-avatar">
                            {item.title.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="dm-course-info">
                          <strong>{item.title}</strong>
                          <span>{item.videoCount} Videos</span>
                        </div>
                        <div className="dm-course-progress-area">
                          <div className="dm-course-bar">
                            <div className="dm-course-bar-fill" style={{ width: `${item.percent}%` }}></div>
                          </div>
                          <span className="dm-course-percent">{item.percent}%</span>
                        </div>
                        <span className={`dm-course-status ${item.status}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default DepartmentMembers;
