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

   const role = String(user.role || "").toLowerCase();


let visibleCourses = [];

if (role === "superadmin" || role === "admin") {
  // Superadmin and Admin can see all courses
  visibleCourses = allCourses;
} else if (role === "departmentadmin") {
  // Department admin can see only own department courses
  visibleCourses = allCourses.filter(
    (course) => course.department === user.department
  );
} else {
  // Normal user can see only assigned courses
  const assignedCourseIds = user.assignedCourses || [];

  visibleCourses = allCourses.filter((course) =>
    assignedCourseIds.includes(course.id)
  );
}

visibleCourses.sort(
  (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
);


    const allCourseVideos = courseVideosSnap.exists() ? courseVideosSnap.val() : {};

    const libraryVideos = videoLibrarySnap.exists()
      ? Object.entries(videoLibrarySnap.val()).map(([id, video]) => ({
          id,
          ...video,
        }))
      : [];

   setCourses(visibleCourses);
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
      ...new Set(courses.map((course) => course.department).filter(Boolean)),
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
      const matchesDepartment = filterDepartment ? course.department === filterDepartment : true;
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

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesType &&
        matchesOrgan &&
        matchesQuiz &&
        matchesVideoCount
      );
    });
  }, [courses, courseVideos, videoLibrary, search, filterType, filterOrgan, filterQuiz, filterVideoCount, filterDepartment]);

  if (loading) {
    return <div className="department-courses-page">Loading courses...</div>;
  }

  // ✅ Get Base Path to keep sidebar active
// ✅ Get Base Path to keep sidebar active
const role = String(currentUser?.role || "").toLowerCase();

let basePath = "";

if (role === "superadmin") basePath = "/super-admin";
else if (role === "admin") basePath = "/admin";
else if (role === "departmentadmin") basePath = "/department-admin";
else basePath = "/user";

 

  return (
    <div className="department-courses-page">
      <div className="courses-list-card">
        
        <div className="courses-list-head">
          <div>
            <h2>Course Library</h2>
            <p>{filteredCourses.length} of {courses.length} courses showing</p>
          </div>
          <Link to={role === "admin" || role === "superadmin" ? `${basePath}/add-course` : `${basePath}/courses/create`} className="create-course-btn">
            + Create New Course
          </Link>
        </div>

        <div className="course-toolbar course-toolbar-wide">
          <input
            type="text"
            placeholder="Search course, organ, video, generic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          
{(role === "admin" || role === "superadmin") && (
            <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}>
              <option value="">All Departments</option>
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          )}

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
              <option key={organ} value={organ}>{organ}</option>
            ))}
          </select>
          <select value={filterQuiz} onChange={(e) => setFilterQuiz(e.target.value)}>
            <option value="">Quiz: All</option>
            <option value="withQuiz">With Quiz</option>
            <option value="withoutQuiz">Without Quiz</option>
          </select>
        </div>

        {filteredCourses.length === 0 ? (
          <div className="empty-course-state">
            <h3>No courses found</h3>
            <p>Create your first course or change search/filter.</p>
          </div>
        ) : (
          <div className="clean-course-list">
            {filteredCourses.map((course) => {
              const thumbnail = getCourseThumbnail(course); 
              
              // ✅ Role-aware links
              const overviewLink = `${basePath}/course-overview/${course.id}`;
              const editLink = `${basePath}/courses/edit/${course.id}`;
              const assignLink = `${basePath}/assignments?courseId=${course.id}`;

              return (
                <div
                  className="clean-course-card"
                  key={course.id}
                  onClick={() => navigate(overviewLink)} // Using Role-Aware link
                >
                  <div className="clean-course-thumb">
                    {thumbnail ? (
                      <img src={thumbnail} alt={course.title} />
                    ) : (
                      <div className="clean-thumb-fallback">▶</div>
                    )}
                  </div>

                  <div className="clean-course-info">
                    <h3>{course.title}</h3>
                    <p className="clean-course-desc">
                      {course.description || course.overview || "No description provided."}
                    </p>
                    <span className="clean-course-dept-badge">{course.department || "General"}</span>
                  </div>

                  <div className="clean-course-actions">
                    <button
                      className="clean-btn-edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(editLink);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="clean-btn-assign"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(assignLink);
                      }}
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