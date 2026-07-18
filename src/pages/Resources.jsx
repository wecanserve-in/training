import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get, push, set } from "firebase/database";
import { auth, database } from "../firebase";
import {
  FaUpload,
  FaFileAlt,
  FaFilePdf,
  FaFileImage,
  FaFilePowerpoint,
  FaFileVideo,
  FaFile,
  FaTrash,
  FaUser,
  FaSearch,
  FaTimes,
} from "react-icons/fa";
import "../styles/resources.css";

const FILE_ICONS = {
  pdf: FaFilePdf,
  ppt: FaFilePowerpoint,
  pptx: FaFilePowerpoint,
  jpg: FaFileImage,
  jpeg: FaFileImage,
  png: FaFileImage,
  gif: FaFileImage,
  webp: FaFileImage,
  mp4: FaFileVideo,
  default: FaFile,
};

const getFileIcon = (filename) => {
  const ext = (filename || "").split(".").pop()?.toLowerCase();
  return FILE_ICONS[ext] || FILE_ICONS.default;
};

const getFileType = (filename) => {
  const ext = (filename || "").split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (["mp4", "webm", "mov"].includes(ext)) return "video";
  if (["pdf"].includes(ext)) return "pdf";
  if (["ppt", "pptx"].includes(ext)) return "presentation";
  return "file";
};

function Resources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      const userSnap = await get(ref(database, `users/${firebaseUser.uid}`));
      const userData = userSnap.exists() ? userSnap.val() : {};
      setUser({ uid: firebaseUser.uid, ...userData });

      await fetchResources();
    });
    return () => unsubscribe();
  }, []);

  const fetchResources = async () => {
    try {
      const snap = await get(ref(database, "resources"));
      if (!snap.exists()) {
        setResources([]);
        setLoading(false);
        return;
      }

      const data = snap.val();
      const list = Object.entries(data)
        .map(([id, item]) => ({ id, ...item }))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      setResources(list);
    } catch (err) {
      console.error("Failed to load resources:", err);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = ["superAdmin", "admin", "departmentAdmin"].includes(user?.role);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile || !title.trim() || !user) return;

    setUploading(true);
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("upload_preset", uploadPreset);
      formData.append("folder", "resources");

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Upload failed (${res.status})`);
      }

      const data = await res.json();

      const resourceData = {
        title: title.trim(),
        description: description.trim(),
        fileUrl: data.secure_url,
        fileName: selectedFile.name,
        fileType: getFileType(selectedFile.name),
        fileSize: selectedFile.size,
        uploadedBy: user.uid,
        uploadedByName: user.name || user.fullName || "Unknown",
        uploadedByRole: user.role || "user",
        createdAt: new Date().toISOString(),
      };

      await push(ref(database, "resources"), resourceData);

      setTitle("");
      setDescription("");
      setSelectedFile(null);
      setPreviewUrl(null);
      setShowUpload(false);
      await fetchResources();
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload resource. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (resourceId) => {
    if (!window.confirm("Delete this resource?")) return;
    try {
      const { remove } = await import("firebase/database");
      await remove(ref(database, `resources/${resourceId}`));
      setResources((prev) => prev.filter((r) => r.id !== resourceId));
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getRoleLabel = (role) => {
    if (role === "superAdmin") return "Super Admin";
    if (role === "admin") return "Admin";
    if (role === "departmentAdmin") return "Dept Admin";
    return "User";
  };

  const getRoleBadgeClass = (role) => {
    if (role === "superAdmin") return "role-super";
    if (role === "admin") return "role-admin";
    if (role === "departmentAdmin") return "role-dept";
    return "role-user";
  };

  const filteredResources = resources.filter((r) => {
    const matchSearch =
      !search ||
      r.title?.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      r.fileName?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || r.fileType === typeFilter;
    return matchSearch && matchType;
  });

  if (loading) {
    return <h2 className="resources-loading">Loading Resources...</h2>;
  }

  return (
    <div className="resources-page">
      <div className="resources-header">
        <div>
          <h1>News & Resources</h1>
          <p>Shared files, documents, news, and materials from your team.</p>
        </div>
        {isAdmin && (
          <button className="resources-upload-btn" onClick={() => setShowUpload(!showUpload)}>
            <FaUpload /> Upload Resource
          </button>
        )}
      </div>

      {showUpload && (
        <div className="resources-upload-card">
          <div className="upload-card-header">
            <h2>Upload New Resource</h2>
            <button onClick={() => { setShowUpload(false); setSelectedFile(null); setPreviewUrl(null); }}>
              <FaTimes />
            </button>
          </div>

          <div className="upload-form">
            <div className="upload-form-row">
              <div className="upload-field">
                <label>Title *</label>
                <input
                  type="text"
                  placeholder="Resource title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="upload-field">
                <label>Description</label>
                <input
                  type="text"
                  placeholder="Brief description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="upload-dropzone" onClick={() => fileInputRef.current?.click()}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.doc,.docx,.xls,.xlsx"
                onChange={handleFileSelect}
                hidden
              />
              {selectedFile ? (
                <div className="upload-selected-file">
                  {(() => {
                    const Icon = getFileIcon(selectedFile.name);
                    return <Icon className="upload-file-icon" />;
                  })()}
                  <div>
                    <strong>{selectedFile.name}</strong>
                    <span>{formatSize(selectedFile.size)}</span>
                  </div>
                </div>
              ) : (
                <p>Click to browse files (PDF, PPT, Images, Videos, etc.)</p>
              )}
            </div>

            <button
              className="upload-submit-btn"
              disabled={!title.trim() || !selectedFile || uploading}
              onClick={handleUpload}
            >
              {uploading ? "Uploading..." : "Upload Resource"}
            </button>
          </div>
        </div>
      )}

      <div className="resources-filter-bar">
        <div className="resources-search">
          <FaSearch />
          <input
            placeholder="Search resources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="pdf">PDF</option>
          <option value="presentation">Presentations</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="file">Other Files</option>
        </select>
      </div>

      {filteredResources.length === 0 ? (
        <div className="resources-empty">
          <FaFileAlt />
          <h3>No resources found</h3>
          <p>{isAdmin ? "Upload the first resource to get started." : "No resources shared yet."}</p>
        </div>
      ) : (
        <div className="resources-grid">
          {filteredResources.map((resource) => {
            const FileIcon = getFileIcon(resource.fileName);
            const isImage = resource.fileType === "image";
            const canDelete = isAdmin && resource.uploadedBy === user?.uid;

            return (
              <div className="resource-card" key={resource.id}>
                {isImage ? (
                  <a href={resource.fileUrl} target="_blank" rel="noopener noreferrer" className="resource-preview">
                    <img src={resource.fileUrl} alt={resource.title} />
                  </a>
                ) : (
                  <a href={resource.fileUrl} target="_blank" rel="noopener noreferrer" className="resource-preview resource-file-preview">
                    <FileIcon className="resource-file-icon" />
                    <span>{(resource.fileName || "").split(".").pop()?.toUpperCase()}</span>
                  </a>
                )}

                <div className="resource-body">
                  <h3>{resource.title}</h3>
                  {resource.description && <p>{resource.description}</p>}

                  <div className="resource-meta">
                    <span className="resource-file-name">{resource.fileName}</span>
                    {resource.fileSize && <span>{formatSize(resource.fileSize)}</span>}
                  </div>

                  <div className="resource-footer">
                    <div className="resource-uploader">
                      <FaUser className="uploader-icon" />
                      <div>
                        <strong>{resource.uploadedByName}</strong>
                        <span className={`role-badge ${getRoleBadgeClass(resource.uploadedByRole)}`}>
                          {getRoleLabel(resource.uploadedByRole)}
                        </span>
                      </div>
                    </div>
                    <small>{formatDate(resource.createdAt)}</small>
                  </div>

                  {canDelete && (
                    <button className="resource-delete-btn" onClick={() => handleDelete(resource.id)}>
                      <FaTrash /> Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Resources;
