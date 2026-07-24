import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref, set, update, remove } from "firebase/database";
import { auth, database } from "../firebase";
import useBasePath from "../hooks/useBasePath";
import "../styles/editcourse.css";

function EditCourse() {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const basePath = useBasePath();
  const thumbInputRef = useRef(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [existingThumbnail, setExistingThumbnail] = useState("");

  const [courseVideos, setCourseVideos] = useState([]);
  const [videoLibrary, setVideoLibrary] = useState([]);
  const [videoSearch, setVideoSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showAddVideos, setShowAddVideos] = useState(false);

  const [originalVideoIds, setOriginalVideoIds] = useState([]);

  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const checkIsDeptAdmin = (user) => {
    const r = String(user?.role || "").trim().toLowerCase().replace(/[\s_-]/g, "");
    return r === "departmentadmin";
  };

  const checkCanEdit = (user) => {
    if (!user) return false;
    const r = String(user.role || "").trim().toLowerCase().replace(/[\s_-]/g, "");
    if (r === "superadmin" || r === "admin") return true;
    if (r === "departmentadmin") return true;
    return false;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/");
        return;
      }

      const userSnap = await get(ref(database, `users/${user.uid}`));
      if (!userSnap.exists()) {
        alert("User profile not found");
        navigate("/");
        return;
      }

      const userData = { id: user.uid, email: user.email || "", ...userSnap.val() };

      if (!checkCanEdit(userData)) {
        alert("You don't have permission to edit courses.");
        navigate(-1);
        return;
      }

      setCurrentUser(userData);
      await loadCourse(courseId, userData);
      await loadVideoLibrary(userData);
      setLoading(false);
    });

    return () => unsub();
  }, [courseId, navigate]);

  const loadCourse = async (cId, userData) => {
    const courseSnap = await get(ref(database, `courses/${cId}`));
    if (!courseSnap.exists()) {
      alert("Course not found");
      navigate(`${basePath}/courses`);
      return;
    }

    const courseData = courseSnap.val();

    const isCreator = courseData.createdBy === userData.id;
    const r = String(userData.role || "").toLowerCase().replace(/[\s_-]/g, "");
    const isAdmin = r === "superadmin" || r === "admin";
    const isDeptAdmin = r === "departmentadmin";

    if (!isCreator && !isAdmin && !isDeptAdmin) {
      alert("You don't have permission to edit this course.");
      navigate(-1);
      return;
    }

    setTitle(courseData.title || "");
    setOverview(courseData.description || courseData.overview || "");
    setExistingThumbnail(courseData.courseThumbnail || courseData.thumbnailUrl || "");

    const videosSnap = await get(ref(database, `courseVideos/${cId}`));
    if (videosSnap.exists()) {
      const videos = Object.entries(videosSnap.val())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      setCourseVideos(videos);
      setOriginalVideoIds(videos.map((v) => v.id));
    }
  };

  const loadVideoLibrary = async (userData) => {
    const snap = await get(ref(database, "videoLibrary"));
    if (!snap.exists()) {
      setVideoLibrary([]);
      return;
    }

    const data = Object.entries(snap.val()).map(([id, video]) => ({ id, ...video }));

    let filtered;
    if (checkIsDeptAdmin(userData)) {
      filtered = data.filter(
        (v) =>
          v.department === userData.department ||
          v.departmentType === userData.departmentType ||
          (userData.departmentId && v.departmentId === userData.departmentId) ||
          v.createdBy === userData.id
      );
    } else {
      filtered = data;
    }

    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    setVideoLibrary(filtered);
  };

  const uploadImageToCloudinary = async (file) => {
    if (!file) return "";
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) throw new Error("Cloudinary env variables missing.");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    const safeFolder = (currentUser?.department || "General").replace(/[^a-zA-Z0-9_-]/g, "-");
    formData.append("folder", `lms/${safeFolder}`);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Thumbnail upload failed.");
    const data = await res.json();
    return data.secure_url || "";
  };

  const handleThumbChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (thumbnailPreview?.startsWith("blob:")) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const removeThumb = () => {
    if (thumbnailPreview?.startsWith("blob:")) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailFile(null);
    setThumbnailPreview("");
    setExistingThumbnail("");
    if (thumbInputRef.current) thumbInputRef.current.value = "";
  };

  const addVideoToCourse = (video) => {
    if (courseVideos.some((v) => v.id === video.id)) return;
    setCourseVideos((prev) => [
      ...prev,
      {
        id: video.id,
        ...video,
        order: prev.length + 1,
        addedAt: new Date().toISOString(),
      },
    ]);
  };

  const removeVideoFromCourse = (videoId) => {
    setCourseVideos((prev) =>
      prev
        .filter((v) => v.id !== videoId)
        .map((v, i) => ({ ...v, order: i + 1 }))
    );
  };

  const moveVideo = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= courseVideos.length) return;
    setCourseVideos((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated.map((v, i) => ({ ...v, order: i + 1 }));
    });
  };

  const handleDragStart = (index) => setDragIndex(index);
  const handleDragOver = (e, index) => { e.preventDefault(); setDragOverIndex(index); };
  const handleDragEnd = () => { setDragIndex(null); setDragOverIndex(null); };
  const handleDrop = (index) => {
    if (dragIndex !== null && dragIndex !== index) {
      moveVideo(dragIndex, index);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const filteredAvailable = videoLibrary.filter((v) => {
    if (courseVideos.some((cv) => cv.id === v.id)) return false;
    if (videoSearch) {
      const text = [v.title, v.description, v.metadata?.organName, v.metadata?.videoType, v.metadata?.genericName]
        .filter(Boolean).join(" ").toLowerCase();
      if (!text.includes(videoSearch.toLowerCase())) return false;
    }
    if (filterType && v.metadata?.videoType !== filterType) return false;
    return true;
  });

  const handleSave = async () => {
    if (!title.trim()) {
      alert("Course title is required.");
      return;
    }
    if (courseVideos.length === 0) {
      alert("Add at least one video to the course.");
      return;
    }

    setSaving(true);
    try {
      let thumbUrl = existingThumbnail;
      if (thumbnailFile) {
        thumbUrl = await uploadImageToCloudinary(thumbnailFile);
      }

      await update(ref(database, `courses/${courseId}`), {
        title: title.trim(),
        description: overview.trim(),
        overview: overview.trim(),
        courseThumbnail: thumbUrl,
        thumbnailUrl: thumbUrl,
        totalVideos: courseVideos.length,
        videoIds: courseVideos.map((v) => v.id),
        updatedAt: new Date().toISOString(),
      });

      await remove(ref(database, `courseVideos/${courseId}`));

      await Promise.all(
        courseVideos.map((video, i) =>
          set(ref(database, `courseVideos/${courseId}/${video.id}`), {
            ...video,
            courseId,
            courseTitle: title.trim(),
            order: i + 1,
            addedAt: video.addedAt || new Date().toISOString(),
          })
        )
      );

      const newVideoIds = courseVideos
        .filter((v) => !originalVideoIds.includes(v.id))
        .map((v) => v.id);

      if (newVideoIds.length > 0) {
        await set(ref(database, `courseContentUpdates/${courseId}`), {
          lastUpdatedAt: new Date().toISOString(),
          updatedBy: currentUser.id,
          newVideoIds,
        });
      }

      alert("Course updated successfully.");
      navigate(`${basePath}/courses`);
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to update course.");
    } finally {
      setSaving(false);
    }
  };

  const formatDuration = (sec) => {
    if (!sec) return "";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="ec-page">
        <div className="ec-loading">Loading course...</div>
      </div>
    );
  }

  return (
    <div className="ec-page">
      <div className="ec-topbar">
        <button className="ec-back-btn" onClick={() => navigate(`${basePath}/courses`)}>
          ← Back to Courses
        </button>
        <h1>Edit Course</h1>
        <button className="ec-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="ec-grid">
        <div className="ec-main">
          {/* Course Info */}
          <div className="ec-card">
            <h2>Course Details</h2>
            <div className="ec-field">
              <label>Course Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter course title"
              />
            </div>
            <div className="ec-field">
              <label>Description</label>
              <textarea
                rows={4}
                value={overview}
                onChange={(e) => setOverview(e.target.value)}
                placeholder="Enter course description"
              />
            </div>
            <div className="ec-field">
              <label>Thumbnail</label>
              <div className="ec-thumb-area">
                {(thumbnailPreview || existingThumbnail) ? (
                  <div className="ec-thumb-preview">
                    <img src={thumbnailPreview || existingThumbnail} alt="Thumbnail" />
                    <button className="ec-thumb-remove" onClick={removeThumb}>×</button>
                  </div>
                ) : (
                  <button className="ec-thumb-upload" onClick={() => thumbInputRef.current?.click()}>
                    + Upload Thumbnail
                  </button>
                )}
                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleThumbChange}
                />
              </div>
            </div>
          </div>

          {/* Current Videos */}
          <div className="ec-card">
            <div className="ec-card-header">
              <div>
                <h2>Course Videos</h2>
                <p>{courseVideos.length} video{courseVideos.length !== 1 ? "s" : ""} • Drag to reorder</p>
              </div>
              <button className="ec-add-videos-btn" onClick={() => setShowAddVideos(!showAddVideos)}>
                {showAddVideos ? "Close Library" : "+ Add Videos"}
              </button>
            </div>

            {courseVideos.length === 0 ? (
              <div className="ec-empty">
                <p>No videos in this course yet.</p>
                <button onClick={() => setShowAddVideos(true)}>Add Videos</button>
              </div>
            ) : (
              <div className="ec-video-list">
                {courseVideos.map((video, index) => (
                  <div
                    key={video.id}
                    className={`ec-video-row ${dragIndex === index ? "dragging" : ""} ${dragOverIndex === index ? "drag-over" : ""}`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onDrop={() => handleDrop(index)}
                  >
                    <span className="ec-video-grip">⠿</span>
                    <span className="ec-video-idx">{index + 1}</span>
                    <div className="ec-video-thumb">
                      {video.thumbnailUrl ? (
                        <img src={video.thumbnailUrl} alt="" />
                      ) : (
                        <span>{(video.title || "V")[0]}</span>
                      )}
                    </div>
                    <div className="ec-video-info">
                      <h4>{video.title || video.videoTitle || "Untitled"}</h4>
                      <span>{video.metadata?.organName || ""} {video.metadata?.videoType ? `• ${video.metadata.videoType}` : ""} {video.durationSeconds ? `• ${formatDuration(video.durationSeconds)}` : ""}</span>
                    </div>
                    <div className="ec-video-actions">
                      <button className="ec-move-btn" onClick={() => moveVideo(index, index - 1)} disabled={index === 0} title="Move up">↑</button>
                      <button className="ec-move-btn" onClick={() => moveVideo(index, index + 1)} disabled={index === courseVideos.length - 1} title="Move down">↓</button>
                      <button className="ec-remove-btn" onClick={() => removeVideoFromCourse(video.id)} title="Remove">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Add Videos Panel */}
        {showAddVideos && (
          <div className="ec-sidebar">
            <div className="ec-card ec-add-panel">
              <h2>Video Library</h2>
              <input
                type="text"
                placeholder="Search videos..."
                value={videoSearch}
                onChange={(e) => setVideoSearch(e.target.value)}
                className="ec-search"
              />
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="ec-filter">
                <option value="">All Types</option>
                <option value="Anatomy">Anatomy</option>
                <option value="Therapy">Therapy</option>
                <option value="Product">Product</option>
                <option value="Other">Other</option>
              </select>
              <p className="ec-lib-count">{filteredAvailable.length} available</p>
              <div className="ec-lib-list">
                {filteredAvailable.map((video) => (
                  <div key={video.id} className="ec-lib-card" onClick={() => addVideoToCourse(video)}>
                    <div className="ec-lib-thumb">
                      {video.thumbnailUrl ? (
                        <img src={video.thumbnailUrl} alt="" />
                      ) : (
                        <span>{(video.title || "V")[0]}</span>
                      )}
                    </div>
                    <div className="ec-lib-info">
                      <h4>{video.title}</h4>
                      <span>{video.metadata?.organName || ""} {video.metadata?.videoType ? `• ${video.metadata.videoType}` : ""}</span>
                    </div>
                    <span className="ec-lib-add">+</span>
                  </div>
                ))}
                {filteredAvailable.length === 0 && (
                  <p className="ec-lib-empty">No more videos available</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EditCourse;
