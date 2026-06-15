import { useEffect, useState } from "react";
import { ref, get, remove } from "firebase/database";
import { database } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import "../styles/managevideos.css";

function ManageVideos() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);

  const fetchVideos = async () => {
    const snapshot = await get(ref(database, "videos"));

    if (snapshot.exists()) {
      const data = snapshot.val();

      const videoArray = Object.keys(data).map((key) => ({
        id: key,
        ...data[key],
      }));

      setVideos(videoArray);
    } else {
      setVideos([]);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this course?"
    );

    if (!confirmDelete) return;

    await remove(ref(database, `videos/${id}`));
    fetchVideos();
  };

  return (
    <div className="manage-catalog-container">
      <div className="catalog-header-row">
        <div>
          <div className="back-link-wrapper">
            <Link to="/admin" className="btn-catalog-back">
              ← Admin Dashboard
            </Link>
          </div>

          <h1 className="catalog-main-title">Manage Video Catalog</h1>
          <p className="catalog-subtitle">
            Inspect active courses, departments, media paths and quiz settings.
          </p>
        </div>

        <Link to="/admin/add-video" className="btn-catalog-create-new">
          + Add New Video Course
        </Link>
      </div>

      <div className="table-card-wrapper">
        {videos.length === 0 ? (
          <div className="empty-catalog-fallback">
            <p>No video modules found.</p>
          </div>
        ) : (
          <table className="admin-data-table">
            <thead>
              <tr>
                <th style={{ width: "25%" }}>Course Title</th>
                <th style={{ width: "15%" }}>Department</th>
                <th style={{ width: "25%" }}>Video Path</th>
                <th style={{ width: "12%", textAlign: "center" }}>
                  Pass %
                </th>
                <th style={{ width: "12%", textAlign: "center" }}>
                  Duration
                </th>
                <th style={{ width: "11%", textAlign: "right" }}>
                  Operations
                </th>
              </tr>
            </thead>

            <tbody>
              {videos.map((video) => (
                <tr key={video.id}>
                  <td>
                    <div className="table-cell-title">{video.title}</div>
                    <div className="table-cell-desc-truncate">
                      {video.description}
                    </div>
                  </td>

                  <td>
                    <span className="badge-metric accent-blue">
                      {video.department || "Not Set"}
                    </span>
                  </td>

                  <td>
                    <code className="table-cell-code-route">
                      {video.videoUrl}
                    </code>
                  </td>

                  <td style={{ textAlign: "center" }}>
                    <span className="badge-metric accent-blue">
                      {video.passingScore}%
                    </span>
                  </td>

                  <td style={{ textAlign: "center" }}>
                    <span className="badge-metric accent-grey">
                      {video.testDuration}s
                    </span>
                  </td>

                  <td>
                    <div className="table-actions-cell-group">
                      <button
                        onClick={() =>
                          navigate(`/admin/edit-video/${video.id}`)
                        }
                        className="btn-action-table-edit"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => handleDelete(video.id)}
                        className="btn-action-table-delete"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default ManageVideos;