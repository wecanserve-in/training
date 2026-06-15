import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { push, ref, get } from "firebase/database";
import { database } from "../firebase";
import { departmentVideos } from "../data/videos";
import "../styles/addvideo.css";

function AddVideo() {
  const navigate = useNavigate();

  const departments = ["Sales", "Marketing", "HR", "Production", "Accounts"];

  const [courses, setCourses] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [availableVideos, setAvailableVideos] = useState([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("");
  const [courseId, setCourseId] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [videoSlug, setVideoSlug] = useState("");
  const [passingScore, setPassingScore] = useState(70);
  const [testDuration, setTestDuration] = useState(60);

  useEffect(() => {
    const fetchCourses = async () => {
      const snapshot = await get(ref(database, "courses"));

      if (snapshot.exists()) {
        const data = snapshot.val();

        const courseArray = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));

        setCourses(courseArray);
      }
    };

    fetchCourses();
  }, []);

  const handleDepartmentChange = (e) => {
    const selectedDepartment = e.target.value;

    setDepartment(selectedDepartment);
    setCourseId("");
    setCourseTitle("");
    setVideoSlug("");

    const matchedCourses = courses.filter(
      (course) => course.department === selectedDepartment
    );

    setFilteredCourses(matchedCourses);
    setAvailableVideos(departmentVideos[selectedDepartment] || []);
  };

  const handleCourseChange = (e) => {
    const selectedCourseId = e.target.value;

    const selectedCourse = courses.find(
      (course) => course.id === selectedCourseId
    );

    setCourseId(selectedCourseId);
    setCourseTitle(selectedCourse?.title || "");
    setVideoSlug("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!department) {
      alert("Please select department");
      return;
    }

    if (!courseId) {
      alert("Please select course");
      return;
    }

    if (!videoSlug) {
      alert("Please select video");
      return;
    }

    const finalVideoUrl = `/videos/${department}/${videoSlug}`;

    try {
      await push(ref(database, "videos"), {
        title: title.trim(),
        description: description.trim(),
        department,
        courseId,
        courseTitle,
        videoFileName: videoSlug,
        videoUrl: finalVideoUrl,
        passingScore: Number(passingScore),
        testDuration: Number(testDuration),
        createdAt: new Date().toISOString(),
      });

      alert("Video Added Successfully");
      navigate("/admin/videos");
    } catch (error) {
      console.error(error);
      alert("Failed to add video");
    }
  };

  return (
    <div className="admin-form-container">
      <div className="admin-nav-back-row">
        <Link to="/admin" className="btn-admin-back">
          ← Back to Admin Console
        </Link>
      </div>

      <div className="admin-form-card">
        <h1 className="admin-form-title">Add Video Inside Course</h1>

        <p className="admin-form-subtitle">
          Select department, choose course, then attach a video from that
          department folder.
        </p>

        <form onSubmit={handleSubmit} className="admin-core-form">
          <div className="admin-input-group">
            <label className="admin-field-label">Department</label>

            <select
              value={department}
              onChange={handleDepartmentChange}
              className="admin-form-input"
              required
            >
              <option value="">Select Department</option>

              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-input-group">
            <label className="admin-field-label">
              Select Course / Product / Topic
            </label>

            <select
              value={courseId}
              onChange={handleCourseChange}
              className="admin-form-input"
              required
              disabled={!department}
            >
              <option value="">
                {department ? "Select Course" : "Select Department First"}
              </option>

              {filteredCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>

            {department && filteredCourses.length === 0 && (
              <small className="field-hint-text">
                No course found for this department. Please create course first.
              </small>
            )}
          </div>

          <div className="admin-input-group">
            <label className="admin-field-label">Video Title</label>

            <input
              placeholder="e.g., Introduction Video"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="admin-form-input"
              required
            />
          </div>

          <div className="admin-input-group">
            <label className="admin-field-label">Video Description</label>

            <textarea
              placeholder="Short video description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="admin-form-textarea"
              rows="4"
              required
            />
          </div>

          <div className="admin-input-group">
            <label className="admin-field-label">Select Video File</label>

            <select
              value={videoSlug}
              onChange={(e) => setVideoSlug(e.target.value)}
              className="admin-form-input"
              required
              disabled={!department}
            >
              <option value="">
                {department ? "Select Video" : "Select Department First"}
              </option>

              {availableVideos.map((video) => (
                <option key={video} value={video}>
                  {video}
                </option>
              ))}
            </select>

            {department && availableVideos.length === 0 && (
              <small className="field-hint-text">
                No videos found for this department.
              </small>
            )}

            <small className="field-hint-text">
              Saved path:{" "}
              <strong>
                {department && videoSlug
                  ? `/videos/${department}/${videoSlug}`
                  : "/videos/Department/video.mp4"}
              </strong>
            </small>
          </div>

          <div className="admin-form-row-split">
            <div className="admin-input-group">
              <label className="admin-field-label">
                Passing Benchmark (%)
              </label>

              <input
                type="number"
                placeholder="70"
                min="0"
                max="100"
                value={passingScore}
                onChange={(e) => setPassingScore(e.target.value)}
                className="admin-form-input"
                required
              />
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">
                Exam Timer Limit (Seconds)
              </label>

              <input
                type="number"
                placeholder="60"
                min="5"
                value={testDuration}
                onChange={(e) => setTestDuration(e.target.value)}
                className="admin-form-input"
                required
              />
            </div>
          </div>

          <div className="admin-form-submit-zone">
            <button type="submit" className="btn-admin-submit-form">
              Save Video
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}





export default AddVideo;