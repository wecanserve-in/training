import { useEffect, useMemo, useState } from "react";
import { get, ref, remove } from "firebase/database";
import { database } from "../firebase";
import { Link } from "react-router-dom";
import "../styles/videolibrarylist.css";

function DepartmentVideoLibrary() {
  const [videos, setVideos] = useState([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");

  const loadVideos = async () => {
    const snap = await get(ref(database, "videoLibrary"));

    if (!snap.exists()) {
      setVideos([]);
      return;
    }

    const data = Object.entries(snap.val()).map(([id, video]) => ({
      id,
      ...video,
    }));

    data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    setVideos(data);
  };

  useEffect(() => {
    loadVideos();
  }, []);

  const deleteVideo = async (videoId) => {
    if (!window.confirm("Delete this video?")) return;

    await remove(ref(database, `videoLibrary/${videoId}`));
    await remove(ref(database, `videoQuizzes/${videoId}`));

    loadVideos();
  };

  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      const organName = video.metadata?.organName || video.organName || "";
      const videoType = video.metadata?.videoType || video.videoType || "";
      const typeSpecific = video.metadata?.typeSpecific || video.typeSpecific || "";
      const genericName = video.metadata?.genericName || video.genericName || "";
      const productForm = video.metadata?.productForm || video.productForm || "";

      const combinedText = [
        video.title,
        video.description,
        video.department,
        video.departmentType,
        organName,
        videoType,
        typeSpecific,
        genericName,
        productForm,
        ...(video.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = combinedText.includes(search.toLowerCase());
      const matchesType = filterType ? videoType === filterType : true;

      return matchesSearch && matchesType;
    });
  }, [videos, search, filterType]);

  return (
    <div className="video-library-page">
      <div className="video-library-header">
        <div>
          <span>Video Library</span>
          <h1>Training Videos</h1>
          <p>Upload once and reuse in multiple courses.</p>
        </div>

        <Link to="/department-admin/video-library/upload" className="upload-video-btn">
          + Upload Video
        </Link>
      </div>

      <div className="video-library-table-card">
        <div className="table-head">
          <div>
            <h2>All Videos</h2>
            <p>{filteredVideos.length} of {videos.length} videos showing</p>
          </div>
        </div>

        <div className="library-toolbar">
          <input
            type="text"
            placeholder="Search by title, organ, type, generic, tags..."
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
        </div>

        {filteredVideos.length === 0 ? (
          <div className="empty-video-state">
            <h3>No videos found</h3>
            <p>Try changing search or filters.</p>
          </div>
        ) : (
          <div className="video-list-grid">
            {filteredVideos.map((video) => {
              const organName = video.metadata?.organName || video.organName || "";
              const videoType = video.metadata?.videoType || video.videoType || "";
              const typeSpecific = video.metadata?.typeSpecific || video.typeSpecific || "";
              const genericName = video.metadata?.genericName || video.genericName || "";

              return (
                <div className="video-list-card" key={video.id}>
                  <div className="video-thumb">
                    {video.thumbnailUrl ? (
                      <img src={video.thumbnailUrl} alt={video.title || "Training video"} />
                    ) : (
                      <div className="video-thumb-fallback">No Thumbnail</div>
                    )}
                  </div>

                  <div className="video-list-content">
                    <h3>{video.title}</h3>
                    <p>{video.description || "No description added."}</p>

                    <div className="video-list-meta">
                      {organName && <span>{organName}</span>}
                      {videoType && <span>{videoType}</span>}
                      {typeSpecific && <span>{typeSpecific}</span>}
                      {genericName && <span>{genericName}</span>}
                      {(video.tags || []).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </div>

                  <button className="delete-video-btn" onClick={() => deleteVideo(video.id)}>
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default DepartmentVideoLibrary;