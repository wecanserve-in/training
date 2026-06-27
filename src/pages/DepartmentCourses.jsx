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
      ? Object.entries(courseSnap.val()).map(([id, course]) => ({
          id,
          ...course,
        }))
      : [];

const canSeeAllCourses =
  user.role === "admin" || user.role === "superAdmin";

const ownCourses = canSeeAllCourses
  ? allCourses
  : allCourses.filter((course) => {
      return (
        course.createdBy === user.id ||
        course.createdByEmail === user.email ||
        course.department === user.department
      );
    });

    ownCourses.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const allCourseVideos = courseVideosSnap.exists() ? courseVideosSnap.val() : {};

    const libraryVideos = videoLibrarySnap.exists()
      ? Object.entries(videoLibrarySnap.val()).map(([id, video]) => ({
          id,
          ...video,
        }))
      : [];

    setCourses(ownCourses);
    setCourseVideos(allCourseVideos);
    setVideoLibrary(libraryVideos);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) {
        navigate("/");
        return;
      }

      const userSnap = await get(ref(database, `users/${loggedUser.uid}`));

      if (!userSnap.exists()) {
        navigate("/");
        return;
      }

      const userData = {
        id: loggedUser.uid,
        email: loggedUser.email,
        ...userSnap.val(),
      };

      setCurrentUser(userData);
      await fetchData(userData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const getCourseVideos = (course) => {
    const mappedVideos = courseVideos?.[course.id]
      ? Object.entries(courseVideos[course.id]).map(([id, video]) => ({
          id,
          ...video,
        }))
      : [];

    if (mappedVideos.length > 0) {
      return mappedVideos.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    if (Array.isArray(course.videoIds) && course.videoIds.length > 0) {
      return course.videoIds
        .map((videoId) => videoLibrary.find((video) => video.id === videoId))
        .filter(Boolean);
    }

    return [];
  };

  const getCourseThumbnail = (course) => {
    if (course.thumbnailUrl) return course.thumbnailUrl;
    if (course.courseThumbnail) return course.courseThumbnail;

    const videos = getCourseVideos(course);
    const videoWithThumbnail = videos.find((video) => video.thumbnailUrl);

    return videoWithThumbnail?.thumbnailUrl || "";
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
  return [
    ...new Set(
      courses
        .map((course) => course.department)
        .filter(Boolean)
    ),
  ];
}, [courses]);

  const filteredCourses = useMemo(() => {
    const searchValue = search.toLowerCase();

    return courses.filter((course) => {
      const videos = getCourseVideos(course);

      const courseOrgans = videos.map((video) => video.metadata?.organName).filter(Boolean);
      const courseTypes = videos.map((video) => video.metadata?.videoType).filter(Boolean);


      const combinedText = [
        course.title,
        course.description,
        course.overview,
        course.department,
        course.departmentType,
        course.createdByName,
        ...videos.map((video) => video.title),
        ...videos.map((video) => video.description),
        ...videos.map((video) => video.metadata?.organName),
        ...videos.map((video) => video.metadata?.videoType),
        ...videos.map((video) => video.metadata?.genericName),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const questionCount = Number(course.totalQuestions || 0);
      const videoCount = videos.length || Number(course.totalVideos || 0);

      const matchesSearch = combinedText.includes(searchValue);
      const matchesDepartment =
  filterDepartment
    ? course.department === filterDepartment
    : true;
      const matchesType = filterType ? courseTypes.includes(filterType) : true;
      const matchesOrgan = filterOrgan ? courseOrgans.includes(filterOrgan) : true;

      const matchesQuiz =
        filterQuiz === "withQuiz"
          ? questionCount > 0
          : filterQuiz === "withoutQuiz"
          ? questionCount === 0
          : true;

        

      const matchesVideoCount =
        filterVideoCount === "single"
          ? videoCount === 1
          : filterVideoCount === "multi"
          ? videoCount > 1
          : true;
return matchesSearch &&
       matchesDepartment &&
       matchesType &&
       matchesOrgan &&
       matchesQuiz &&
      matchesVideoCount;
    });
  }, [
    courses,
    courseVideos,
    videoLibrary,
    search,
    filterType,
    filterOrgan,
  filterQuiz,
filterVideoCount,
filterDepartment,
]);
  if (loading) {
    return <div className="department-courses-page">Loading courses...</div>;
  }

  return (
    <div className="department-courses-page">
      <div className="courses-header-card">
        <div>
          <span>Courses</span>
          <h1>Course Library</h1>
         <p>
  {currentUser?.role === "admin" || currentUser?.role === "superAdmin"
    ? "Showing all courses. Use filters to narrow the list."
    : `Showing courses created for ${currentUser?.department || "your department"}.`}
</p>
        </div>

<Link
  to={
    currentUser?.role === "admin" || currentUser?.role === "superAdmin"
      ? "/admin/add-course"
      : "/department-admin/courses/create"
  }
  className="create-course-btn"
>
  + Create New Course
</Link>
      </div>

      <div className="courses-list-card">
        <div className="courses-list-head">
          <div>
            <h2>My Created Courses</h2>
            <p>
              {filteredCourses.length} of {courses.length} courses showing
            </p>
          </div>
        </div>

        <div className="course-toolbar course-toolbar-wide">
          <input
            type="text"
            placeholder="Search course, organ, video, generic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            <option value="Anatomy">Anatomy</option>
            <option value="Therapy">Therapy</option>
            <option value="Product">Product</option>
            <option value="Other">Other</option>
          </select>

          <select value={filterOrgan} onChange={(e) => setFilterOrgan(e.target.value)}>
            <option value="">All Organs</option>
            {organOptions.map((organ) => (
              <option key={organ} value={organ}>
                {organ}
              </option>
            ))}
          </select>

          <select value={filterQuiz} onChange={(e) => setFilterQuiz(e.target.value)}>
            <option value="">Quiz: All</option>
            <option value="withQuiz">With Quiz</option>
            <option value="withoutQuiz">Without Quiz</option>
          </select>

          <select value={filterVideoCount} onChange={(e) => setFilterVideoCount(e.target.value)}>
            <option value="">Videos: All</option>
            <option value="single">Single Video</option>
            <option value="multi">Multiple Videos</option>
          </select>

          <select
  value={filterDepartment}
  onChange={(e) => setFilterDepartment(e.target.value)}
>
  <option value="">All Departments</option>

  {departmentOptions.map((dept) => (
    <option key={dept} value={dept}>
      {dept}
    </option>
  ))}
</select>

        </div>

        {filteredCourses.length === 0 ? (
          <div className="empty-course-state">
            <h3>No courses found</h3>
            <p>Create your first course or change search/filter.</p>
          </div>
        ) : (
          <div className="course-list-grid">
            {filteredCourses.map((course) => {
              const videos = getCourseVideos(course);
              const thumbnail = getCourseThumbnail(course);
           
              const questionCount = Number(course.totalQuestions || 0);

              return (
                <div className="course-list-card" key={course.id}>
                  <div className="course-thumb">
                    {thumbnail ? (
                      <img src={thumbnail} alt={course.title || "Course"} />
                    ) : (
                      <div className="course-thumb-fallback">
                        <span>▶</span>
                        <p>No Thumbnail</p>
                      </div>
                    )}
                  </div>

                  <div className="course-list-content">
                    <div className="course-title-row">
                      <h3>{course.title}</h3>
                      <span className="course-status active">
                        {questionCount > 0 ? "Quiz Added" : "No Quiz"}
                      </span>
                    </div>

                    <p>{course.description || course.overview || "No description added."}</p>

                    <div className="course-meta-row">
                      <span>{course.department || "No Department"}</span>
                      <span>{videos.length || course.totalVideos || 0} videos</span>
                      <span>{questionCount} questions</span>
                      <span>Pass {course.passingScore || 70}%</span>
                      <span>{course.testDuration || 60}s quiz</span>
                    </div>

                    {videos.length > 0 && (
                      <div className="course-video-preview">
                        {videos.slice(0, 3).map((video, index) => (
                          <span key={video.id}>
                            {index + 1}. {video.title}
                          </span>
                        ))}
                        {videos.length > 3 && <span>+{videos.length - 3} more</span>}
                      </div>
                    )}
                  </div>

                  <div className="course-actions">
                    <button
                      type="button"
                      className="course-edit-btn"
                      onClick={() =>
  navigate(
    currentUser?.role === "admin" || currentUser?.role === "superAdmin"
      ? `/admin/courses/edit/${course.id}`
      : `/department-admin/courses/edit/${course.id}`
  )
}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="course-assign-btn"
                    onClick={() =>
  navigate(
    currentUser?.role === "admin" || currentUser?.role === "superAdmin"
      ? `/admin/assignments?courseId=${course.id}`
      : `/department-admin/assignments?courseId=${course.id}`
  )
}
                    >
                      Assign
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default DepartmentCourses;