import { useEffect, useMemo, useState } from "react";
import { get, ref } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { auth, database } from "../firebase";
import { Link, useNavigate } from "react-router-dom";
import "../styles/departmentcourses.css";

function DepartmentCourses() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [courseVideos, setCourseVideos] = useState({});
  const [videoLibrary, setVideoLibrary] = useState([]);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterOrgan, setFilterOrgan] = useState("");
  const [filterQuiz, setFilterQuiz] = useState("");
  const [filterVideoCount, setFilterVideoCount] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");

  const [loading, setLoading] = useState(true);

  const fetchData = async (user) => {
    const courseSnap = await get(ref(database, "courses"));
    const courseVideosSnap = await get(ref(database, "courseVideos"));
    const videoLibrarySnap = await get(ref(database, "videoLibrary"));

    const allCourses = courseSnap.exists()
      ? Object.entries(courseSnap.val()).map(([id, course]) => ({ id, ...course }))
      : [];

    const role = String(user.role || "").toLowerCase();
    let visibleCourses = [];

    if (role === "superadmin" || role === "admin") {
      visibleCourses = allCourses;
    } else if (role === "departmentadmin") {
      visibleCourses = allCourses.filter((course) => {
        const courseDeptId = String(course.departmentId || "").trim();
        const userDeptId = String(user.departmentId || "").trim();
        const courseDept = String(course.department || "").trim().toLowerCase();
        const userDept = String(user.department || "").trim().toLowerCase();

        if (courseDeptId && userDeptId && courseDeptId === userDeptId) return true;
        if (courseDept && userDept && courseDept === userDept) return true;
        return false;
      });
    } else {
      const assignedCourseIds = user.assignedCourses || [];
      visibleCourses = allCourses.filter((course) => assignedCourseIds.includes(course.id));
    }

    visibleCourses.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const allCourseVideos = courseVideosSnap.exists() ? courseVideosSnap.val() : {};
    const libraryVideos = videoLibrarySnap.exists()
      ? Object.entries(videoLibrarySnap.val()).map(([id, video]) => ({ id, ...video }))
      : [];

    setCourses(visibleCourses);
    setCourseVideos(allCourseVideos);
    setVideoLibrary(libraryVideos);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) { navigate("/"); return; }
      const userSnap = await get(ref(database, `users/${loggedUser.uid}`));
      if (!userSnap.exists()) { navigate("/"); return; }
      const userData = { id: loggedUser.uid, email: loggedUser.email, ...userSnap.val() };
      setCurrentUser(userData);
      await fetchData(userData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const getCourseVideos = (course) => {
    const mappedVideos = courseVideos?.[course.id]
      ? Object.entries(courseVideos[course.id]).map(([id, video]) => ({ id, ...video }))
      : [];
    if (mappedVideos.length > 0) return mappedVideos.sort((a, b) => (a.order || 0) - (b.order || 0));
    if (Array.isArray(course.videoIds) && course.videoIds.length > 0) {
      return course.videoIds.map((videoId) => videoLibrary.find((video) => video.id === videoId)).filter(Boolean);
    }
    return [];
  };

  const getCourseThumbnail = (course) => {
    if (course.thumbnailUrl) return course.thumbnailUrl;
    if (course.courseThumbnail) return course.courseThumbnail;
    const videos = getCourseVideos(course);
    return videos.find((v) => v.thumbnailUrl)?.thumbnailUrl || "";
  };

  const organOptions = useMemo(() => {
    const organs = [];
    courses.forEach((course) => {
      getCourseVideos(course).forEach((video) => {
        if (video.metadata?.organName) organs.push(video.metadata.organName);
      });
    });
    return [...new Set(organs)];
  }, [courses, courseVideos, videoLibrary]);

  const departmentOptions = useMemo(() => {
    return [...new Set(courses.map((course) => course.department).filter(Boolean))];
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const searchValue = search.toLowerCase();
    return courses.filter((course) => {
      const videos = getCourseVideos(course);
      const courseOrgans = videos.map((video) => video.metadata?.organName).filter(Boolean);
      const courseTypes = videos.map((video) => video.metadata?.videoType).filter(Boolean);
      const combinedText = [
        course.title, course.description, course.overview, course.department,
        course.departmentType, course.createdByName,
        ...videos.map((video) => video.title),
        ...videos.map((video) => video.description),
        ...videos.map((video) => video.metadata?.organName),
        ...videos.map((video) => video.metadata?.videoType),
        ...videos.map((video) => video.metadata?.genericName),
      ].filter(Boolean).join(" ").toLowerCase();

      const questionCount = Number(course.totalQuestions || 0);
      const videoCount = videos.length || Number(course.totalVideos || 0);

      return (
        combinedText.includes(searchValue) &&
        (filterDepartment ? course.department === filterDepartment : true) &&
        (filterType ? courseTypes.includes(filterType) : true) &&
        (filterOrgan ? courseOrgans.includes(filterOrgan) : true) &&
        (filterQuiz === "withQuiz" ? questionCount > 0 : filterQuiz === "withoutQuiz" ? questionCount === 0 : true) &&
        (filterVideoCount === "single" ? videoCount === 1 : filterVideoCount === "multi" ? videoCount > 1 : true)
      );
    });
  }, [courses, courseVideos, videoLibrary, search, filterType, filterOrgan, filterQuiz, filterVideoCount, filterDepartment]);

  if (loading) {
    return <div className="dc-page"><div className="dc-loading">Loading courses...</div></div>;
  }

  const role = String(currentUser?.role || "").toLowerCase();
  let basePath = "";
  if (role === "superadmin") basePath = "/super-admin";
  else if (role === "admin") basePath = "/admin";
  else if (role === "departmentadmin") basePath = "/department-admin";
  else basePath = "/user";

  const totalVideos = filteredCourses.reduce((sum, c) => sum + (getCourseVideos(c).length || Number(c.totalVideos || 0)), 0);
  const withQuiz = filteredCourses.filter((c) => Number(c.totalQuestions || 0) > 0).length;

  return (
    <div className="dc-page">

      {/* Hero */}
      <section className="dc-hero">
        <div className="dc-hero-content">
          <h1>Course Library</h1>
          <p>Browse, search and manage all training courses.</p>
        </div>
        <div className="dc-hero-stats">
          <div className="dc-hero-stat">
            <div className="dc-hero-stat-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </div>
            <div>
              <strong>{filteredCourses.length}</strong>
              <span>Courses</span>
            </div>
          </div>
          <div className="dc-hero-stat">
            <div className="dc-hero-stat-icon video-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            </div>
            <div>
              <strong>{totalVideos}</strong>
              <span>Videos</span>
            </div>
          </div>
          <div className="dc-hero-stat">
            <div className="dc-hero-stat-icon quiz-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div>
              <strong>{withQuiz}</strong>
              <span>With Quiz</span>
            </div>
          </div>
        </div>
      </section>

      {/* Action Bar */}
      <div className="dc-action-bar">
        <div className="dc-search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="text" placeholder="Search course, organ, video, generic..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {role === "departmentadmin" && (
          <Link to={`${basePath}/courses/create`} className="dc-btn dc-btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Course
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="dc-filters">
        {(role === "admin" || role === "superadmin") && (
          <select className="dc-filter-select" value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}>
            <option value="">All Departments</option>
            {departmentOptions.map((dept) => (<option key={dept} value={dept}>{dept}</option>))}
          </select>
        )}
        <select className="dc-filter-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          <option value="Anatomy">Anatomy</option>
          <option value="Therapy">Therapy</option>
          <option value="Product">Product</option>
          <option value="Other">Other</option>
        </select>
        <select className="dc-filter-select" value={filterOrgan} onChange={(e) => setFilterOrgan(e.target.value)}>
          <option value="">All Organs</option>
          {organOptions.map((organ) => (<option key={organ} value={organ}>{organ}</option>))}
        </select>
        <select className="dc-filter-select" value={filterQuiz} onChange={(e) => setFilterQuiz(e.target.value)}>
          <option value="">Quiz: All</option>
          <option value="withQuiz">With Quiz</option>
          <option value="withoutQuiz">Without Quiz</option>
        </select>
        <select className="dc-filter-select" value={filterVideoCount} onChange={(e) => setFilterVideoCount(e.target.value)}>
          <option value="">Videos: All</option>
          <option value="single">Single Video</option>
          <option value="multi">Multiple Videos</option>
        </select>
      </div>

      {/* Course List */}
      {filteredCourses.length === 0 ? (
        <div className="dc-empty">
          <div className="dc-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </div>
          <h3>No courses found</h3>
          <p>Create your first course or change search/filters.</p>
        </div>
      ) : (
        <div className="dc-course-list">
          {filteredCourses.map((course) => {
            const thumbnail = getCourseThumbnail(course);
            const overviewLink = `${basePath}/course-overview/${course.id}`;
            const editLink = `${basePath}/courses/edit/${course.id}`;
            const assignLink = `${basePath}/assignments?courseId=${course.id}`;
            const videoCount = getCourseVideos(course).length || Number(course.totalVideos || 0);

            return (
              <div className="dc-course-card" key={course.id} onClick={() => navigate(overviewLink)}>
                <div className="dc-course-thumb">
                  {thumbnail ? (
                    <img src={thumbnail} alt={course.title} />
                  ) : (
                    <div className="dc-thumb-fallback">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                  )}
                </div>

                <div className="dc-course-info">
                  <h3>{course.title}</h3>
                  <p className="dc-course-desc">{course.description || course.overview || "No description provided."}</p>
                  <div className="dc-course-meta">
                    <span className="dc-dept-badge">{course.department || "General"}</span>
                    <span className="dc-meta-item">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                      {videoCount} videos
                    </span>
                    {Number(course.totalQuestions || 0) > 0 && (
                      <span className="dc-meta-item dc-quiz-badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Quiz
                      </span>
                    )}
                  </div>
                </div>

                <div className="dc-course-actions">
                  <button className="dc-action-edit" onClick={(e) => { e.stopPropagation(); navigate(editLink); }} title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  </button>
                  <button className="dc-action-assign" onClick={(e) => { e.stopPropagation(); navigate(assignLink); }} title="Assign">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

export default DepartmentCourses;
