import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { get, push, ref, set } from "firebase/database";
import { database } from "../firebase";
import "../styles/addvideo.css";

const createSafeSlug = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function AddVideo() {
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [department, setDepartment] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  const [courseId, setCourseId] = useState("");
  const [courseTitle, setCourseTitle] = useState("");

  const [videoFile, setVideoFile] = useState(null);

  const [passingScore, setPassingScore] = useState(70);
  const [testDuration, setTestDuration] = useState(60);

  const [loadingData, setLoadingData] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    const fetchDepartmentsAndCourses = async () => {
      try {
        setLoadingData(true);

        const [departmentSnapshot, courseSnapshot] = await Promise.all([
          get(ref(database, "departments")),
          get(ref(database, "courses")),
        ]);

        if (departmentSnapshot.exists()) {
          const departmentData = departmentSnapshot.val();

          const departmentArray = Object.entries(departmentData)
            .map(([id, departmentItem]) => ({
              id,
              departmentName:
                departmentItem?.departmentName ||
                departmentItem?.name ||
                "Unnamed Department",
            }))
            .sort((a, b) =>
              a.departmentName.localeCompare(b.departmentName)
            );

          setDepartments(departmentArray);
        } else {
          setDepartments([]);
        }

        if (courseSnapshot.exists()) {
          const courseData = courseSnapshot.val();

          const courseArray = Object.entries(courseData).map(
            ([id, courseItem]) => ({
              id,
              ...courseItem,
            })
          );

          setCourses(courseArray);
        } else {
          setCourses([]);
        }
      } catch (error) {
        console.error("[Fetch Data Error]", error);
        alert("Failed to load departments and courses.");
      } finally {
        setLoadingData(false);
      }
    };

    fetchDepartmentsAndCourses();
  }, []);

  const handleDepartmentChange = (event) => {
    const selectedDepartmentId = event.target.value;

    const selectedDepartment = departments.find(
      (departmentItem) => departmentItem.id === selectedDepartmentId
    );

    const selectedDepartmentName =
      selectedDepartment?.departmentName || "";

    setDepartmentId(selectedDepartmentId);
    setDepartment(selectedDepartmentName);

    setCourseId("");
    setCourseTitle("");
    setVideoFile(null);
    setUploadProgress(0);

    const matchedCourses = courses.filter((course) => {
      const courseDepartmentName =
        course?.department ||
        course?.departmentName ||
        "";

      const courseDepartmentId = course?.departmentId || "";

      return (
        courseDepartmentId === selectedDepartmentId ||
        courseDepartmentName === selectedDepartmentName
      );
    });

    setFilteredCourses(matchedCourses);
  };

  const handleCourseChange = (event) => {
    const selectedCourseId = event.target.value;

    const selectedCourse = courses.find(
      (course) => course.id === selectedCourseId
    );

    setCourseId(selectedCourseId);
    setCourseTitle(
      selectedCourse?.title ||
        selectedCourse?.courseTitle ||
        selectedCourse?.name ||
        ""
    );
  };

  const handleVideoFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;

    setVideoFile(selectedFile);
    setUploadProgress(0);

    if (!selectedFile) {
      return;
    }

    const allowedVideoTypes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-m4v",
    ];

    if (
      selectedFile.type &&
      !allowedVideoTypes.includes(selectedFile.type)
    ) {
      alert("Please select an MP4, WebM, MOV, or M4V video file.");
      event.target.value = "";
      setVideoFile(null);
      return;
    }
  };

  const uploadVideoToCloudinary = (file) => {
    return new Promise((resolve, reject) => {
      const cloudName =
        import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

      const uploadPreset =
        import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName) {
        reject(
          new Error(
            "VITE_CLOUDINARY_CLOUD_NAME is missing from the .env file."
          )
        );
        return;
      }

      if (!uploadPreset) {
        reject(
          new Error(
            "VITE_CLOUDINARY_UPLOAD_PRESET is missing from the .env file."
          )
        );
        return;
      }

      const safeDepartment =
        createSafeSlug(department) || "general";

      const originalFileName =
        file.name.replace(/\.[^/.]+$/, "");

      const safeFileName =
        createSafeSlug(originalFileName) || "video";

      const uniquePublicId = `${safeFileName}-${Date.now()}`;

      const formData = new FormData();

      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);

      /*
       * Raw department names such as "Sales & Marketing"
       * must not be used directly.
       *
       * This creates:
       * training-portal/videos/sales-and-marketing
       */
      formData.append(
        "folder",
        `training-portal/videos/${safeDepartment}`
      );

      /*
       * Keep public_id URL-safe and do not include
       * the full folder path inside public_id.
       */
      formData.append("public_id", uniquePublicId);

      const uploadRequest = new XMLHttpRequest();

      uploadRequest.open(
        "POST",
        `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`
      );

      uploadRequest.upload.onprogress = (progressEvent) => {
        if (!progressEvent.lengthComputable) {
          return;
        }

        const percentage = Math.round(
          (progressEvent.loaded / progressEvent.total) * 100
        );

        setUploadProgress(percentage);
      };

      uploadRequest.onload = () => {
        let responseData;

        try {
          responseData = JSON.parse(uploadRequest.responseText);
        } catch (error) {
          reject(
            new Error(
              "Invalid response received from Cloudinary."
            )
          );
          return;
        }

        if (
          uploadRequest.status >= 200 &&
          uploadRequest.status < 300
        ) {
          resolve(responseData);
          return;
        }

        reject(
          new Error(
            responseData?.error?.message ||
              "Cloudinary video upload failed."
          )
        );
      };

      uploadRequest.onerror = () => {
        reject(
          new Error(
            "Network error occurred while uploading the video."
          )
        );
      };

      uploadRequest.onabort = () => {
        reject(new Error("Video upload was cancelled."));
      };

      uploadRequest.send(formData);
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!departmentId || !department) {
      alert("Please select a department.");
      return;
    }

    if (!courseId) {
      alert("Please select a course.");
      return;
    }

    if (!title.trim()) {
      alert("Please enter the video title.");
      return;
    }

    if (!description.trim()) {
      alert("Please enter the video description.");
      return;
    }

    if (!videoFile) {
      alert("Please select a video file.");
      return;
    }

    const numericPassingScore = Number(passingScore);
    const numericTestDuration = Number(testDuration);

    if (
      Number.isNaN(numericPassingScore) ||
      numericPassingScore < 0 ||
      numericPassingScore > 100
    ) {
      alert("Passing benchmark must be between 0 and 100.");
      return;
    }

    if (
      Number.isNaN(numericTestDuration) ||
      numericTestDuration < 5
    ) {
      alert("Exam timer must be at least 5 seconds.");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const cloudinaryResult =
        await uploadVideoToCloudinary(videoFile);

      if (!cloudinaryResult?.secure_url) {
        throw new Error(
          "Cloudinary did not return a valid video URL."
        );
      }

      const newVideoReference = push(
        ref(database, "videos")
      );

      const videoId = newVideoReference.key;

      if (!videoId) {
        throw new Error(
          "Firebase could not generate a video ID."
        );
      }

      const createdAt = new Date().toISOString();

      const videoData = {
        id: videoId,

        title: title.trim(),
        description: description.trim(),

        department,
        departmentName: department,
        departmentId,

        courseId,
        courseTitle,

        videoFileName: videoFile.name,
        originalFileName: videoFile.name,

        videoUrl: cloudinaryResult.secure_url,
        secureUrl: cloudinaryResult.secure_url,

        publicId: cloudinaryResult.public_id || "",
        cloudinaryPublicId:
          cloudinaryResult.public_id || "",

        resourceType:
          cloudinaryResult.resource_type || "video",

        format: cloudinaryResult.format || "",
        duration: Number(
          cloudinaryResult.duration || 0
        ),
        width: Number(cloudinaryResult.width || 0),
        height: Number(cloudinaryResult.height || 0),
        bytes: Number(cloudinaryResult.bytes || 0),

        passingScore: numericPassingScore,
        testDuration: numericTestDuration,

        status: "active",
        createdAt,
        updatedAt: createdAt,
      };

      /*
       * Save the main video record.
       */
      await set(newVideoReference, videoData);

      /*
       * Save a lightweight course-to-video mapping.
       *
       * Structure:
       * courseVideos/{courseId}/{videoId}
       */
      await set(
        ref(
          database,
          `courseVideos/${courseId}/${videoId}`
        ),
        {
          videoId,
          courseId,
          courseTitle,
          departmentId,
          department,
          title: title.trim(),
          videoUrl: cloudinaryResult.secure_url,
          publicId: cloudinaryResult.public_id || "",
          createdAt,
        }
      );

      setUploadProgress(100);

      alert("Video uploaded and saved successfully.");

      navigate("/admin/videos");
    } catch (error) {
      console.error("[Video Upload Error]", error);

      alert(
        error?.message ||
          "Failed to upload and save the video."
      );
    } finally {
      setUploading(false);
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
        <h1 className="admin-form-title">
          Add Video Inside Course
        </h1>

        <p className="admin-form-subtitle">
          Select a department and course, upload the video
          to Cloudinary, and save its details in Firebase.
        </p>

        {loadingData ? (
          <div className="admin-form-loading">
            Loading departments and courses...
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="admin-core-form"
          >
            <div className="admin-input-group">
              <label className="admin-field-label">
                Department
              </label>

              <select
                value={departmentId}
                onChange={handleDepartmentChange}
                className="admin-form-input"
                required
                disabled={uploading}
              >
                <option value="">
                  Select Department
                </option>

                {departments.map((departmentItem) => (
                  <option
                    key={departmentItem.id}
                    value={departmentItem.id}
                  >
                    {departmentItem.departmentName}
                  </option>
                ))}
              </select>

              {departments.length === 0 && (
                <small className="field-hint-text">
                  No departments found. Please create a
                  department first.
                </small>
              )}
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
                disabled={!departmentId || uploading}
              >
                <option value="">
                  {departmentId
                    ? "Select Course"
                    : "Select Department First"}
                </option>

                {filteredCourses.map((course) => (
                  <option
                    key={course.id}
                    value={course.id}
                  >
                    {course.title ||
                      course.courseTitle ||
                      course.name ||
                      "Unnamed Course"}
                  </option>
                ))}
              </select>

              {departmentId &&
                filteredCourses.length === 0 && (
                  <small className="field-hint-text">
                    No course found for this department.
                    Please create a course first.
                  </small>
                )}
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">
                Video Title
              </label>

              <input
                type="text"
                placeholder="e.g., Introduction Video"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                className="admin-form-input"
                required
                disabled={uploading}
              />
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">
                Video Description
              </label>

              <textarea
                placeholder="Enter a short video description..."
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                className="admin-form-textarea"
                rows="4"
                required
                disabled={uploading}
              />
            </div>

            <div className="admin-input-group">
              <label className="admin-field-label">
                Upload Video File
              </label>

              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                onChange={handleVideoFileChange}
                className="admin-form-input"
                required
                disabled={
                  !departmentId ||
                  !courseId ||
                  uploading
                }
              />

              {!departmentId && (
                <small className="field-hint-text">
                  Select a department first.
                </small>
              )}

              {departmentId && !courseId && (
                <small className="field-hint-text">
                  Select a course before choosing the video.
                </small>
              )}

              {videoFile && (
                <small className="field-hint-text">
                  Selected file:{" "}
                  <strong>{videoFile.name}</strong>
                </small>
              )}

              {department && (
                <small className="field-hint-text">
                  Cloudinary folder:{" "}
                  <strong>
                    training-portal/videos/
                    {createSafeSlug(department)}
                  </strong>
                </small>
              )}

              {uploading && (
                <div className="video-upload-progress-wrapper">
                  <div className="video-upload-progress-info">
                    <span>Uploading video</span>
                    <strong>{uploadProgress}%</strong>
                  </div>

                  <div className="video-upload-progress-track">
                    <div
                      className="video-upload-progress-fill"
                      style={{
                        width: `${uploadProgress}%`,
                      }}
                    />
                  </div>
                </div>
              )}
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
                  onChange={(event) =>
                    setPassingScore(event.target.value)
                  }
                  className="admin-form-input"
                  required
                  disabled={uploading}
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
                  onChange={(event) =>
                    setTestDuration(event.target.value)
                  }
                  className="admin-form-input"
                  required
                  disabled={uploading}
                />
              </div>
            </div>

            <div className="admin-form-submit-zone">
              <button
                type="submit"
                className="btn-admin-submit-form"
                disabled={
                  uploading ||
                  !departmentId ||
                  !courseId ||
                  !videoFile
                }
              >
                {uploading
                  ? `Uploading ${uploadProgress}%`
                  : "Upload & Save Video"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default AddVideo;