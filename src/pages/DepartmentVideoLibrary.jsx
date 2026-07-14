import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { get, onValue, ref, remove } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { auth, database } from "../firebase";
import "../styles/videolibrarylist.css";

function DepartmentVideoLibrary() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [videos, setVideos] = useState([]);
  const [quizMap, setQuizMap] = useState({});
  const [selectedVideo, setSelectedVideo] = useState(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [loading, setLoading] = useState(true);

  const getRole = (user) => String(user?.role || "").trim().toLowerCase();

  const canSeeAll = useMemo(() => {
    const role = getRole(currentUser);
    return role === "admin" || role === "superadmin";
  }, [currentUser]);

  const normalizeText = (value) => String(value || "").trim().toLowerCase();

  const canUserSeeVideo = (video, userData) => {
    if (!userData) return false;
    const role = getRole(userData);
    if (role === "admin" || role === "superadmin") return true;
    return (
      video.createdBy === userData.id ||
      normalizeText(video.createdByEmail) === normalizeText(userData.email) ||
      (userData.departmentId && video.departmentId === userData.departmentId) ||
      normalizeText(video.department) === normalizeText(userData.department) ||
      normalizeText(video.departmentType) === normalizeText(userData.departmentType)
    );
  };

  const objectToArray = (data) => {
    if (!data || typeof data !== "object") return [];
    return Object.entries(data).map(([id, value]) => ({
      id,
      ...(value && typeof value === "object" ? value : { value }),
    }));
  };

  const getTime = (value) => {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      try {
        if (!loggedUser) { setCurrentUser(null); setAuthReady(true); return; }
        const userSnap = await get(ref(database, `users/${loggedUser.uid}`));
        const userData = { id: loggedUser.uid, email: loggedUser.email, ...(userSnap.exists() ? userSnap.val() : {}) };
        setCurrentUser(userData);
        setAuthReady(true);
      } catch (error) {
        console.error(error);
        setCurrentUser(null);
        setAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!currentUser) { setVideos([]); setQuizMap({}); setLoading(false); return; }

    setLoading(true);
    const loaded = { videos: false, quizzes: false };
    const markLoaded = () => { if (loaded.videos && loaded.quizzes) setLoading(false); };

    const unsubscribeVideos = onValue(ref(database, "videoLibrary"), (snapshot) => {
      if (!snapshot.exists()) { setVideos([]); loaded.videos = true; markLoaded(); return; }
      const allVideos = objectToArray(snapshot.val());
      const visibleVideos = allVideos
        .filter((video) => canUserSeeVideo(video, currentUser))
        .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
      setVideos(visibleVideos);
      loaded.videos = true;
      markLoaded();
    }, (error) => { console.error(error); setVideos([]); loaded.videos = true; markLoaded(); });

    const unsubscribeQuizzes = onValue(ref(database, "videoQuizzes"), (snapshot) => {
      setQuizMap(snapshot.exists() ? snapshot.val() : {});
      loaded.quizzes = true;
      markLoaded();
    }, (error) => { console.error(error); setQuizMap({}); loaded.quizzes = true; markLoaded(); });

    return () => { unsubscribeVideos(); unsubscribeQuizzes(); };
  }, [authReady, currentUser]);

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === "Escape") setSelectedVideo(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const departmentOptions = useMemo(() => {
    return [...new Set(videos.map((video) => video.department).filter(Boolean))].sort();
  }, [videos]);

  const typeOptions = useMemo(() => {
    const firebaseTypes = videos.map((video) => video.metadata?.videoType || video.videoType).filter(Boolean);
    return [...new Set(["Anatomy", "Therapy", "Product", "Other", ...firebaseTypes])];
  }, [videos]);

  const getVideoType = (video) => video.metadata?.videoType || video.videoType || "";

  const getVideoUrl = (video) => video.videoUrl || video.videoURL || video.fileUrl || video.fileURL || video.url || video.uploadUrl || video.downloadURL || video.videoFileUrl || "";

  const getThumbnailUrl = (video) => video.thumbnailUrl || video.thumbnailURL || video.thumbnail || video.imageUrl || video.imageURL || "";

  const getYoutubeEmbedUrl = (url) => {
    if (!url) return "";
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname.includes("youtube.com")) {
        const videoId = parsedUrl.searchParams.get("v");
        if (videoId) return `https://www.youtube.com/embed/${videoId}`;
        if (parsedUrl.pathname.includes("/shorts/")) return `https://www.youtube.com/embed/${parsedUrl.pathname.split("/shorts/")[1]?.split("/")[0]}`;
      }
      if (parsedUrl.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${parsedUrl.pathname.replace("/", "")}`;
      return "";
    } catch { return ""; }
  };

  const isYoutubeVideo = (url) => Boolean(getYoutubeEmbedUrl(url));

  const normalizeQuestions = (videoId) => {
    const quizData = quizMap?.[videoId];
    if (!quizData) return [];
    const questionsSource = quizData.questions || quizData.quizQuestions || quizData;
    if (Array.isArray(questionsSource)) {
      return questionsSource.filter(Boolean).map((q, i) => ({ id: q.id || i, ...(typeof q === "object" ? q : { question: String(q) }) }));
    }
    if (typeof questionsSource === "object") {
      return Object.entries(questionsSource)
        .filter(([key]) => !["createdAt", "updatedAt", "videoId", "title", "description"].includes(key))
        .map(([id, q]) => ({ id, ...(q && typeof q === "object" ? q : { question: String(q) }) }));
    }
    return [];
  };

  const getQuestionText = (q) => q.question || q.questionText || q.title || q.text || "Untitled question";

  const getQuestionOptions = (q) => {
    const options = q.options || q.choices || q.answers || q.optionList || [];
    if (Array.isArray(options)) return options.filter(Boolean).map((o) => typeof o === "object" ? o.text || o.label || o.value || "" : String(o)).filter(Boolean);
    if (options && typeof options === "object") return Object.values(options).map((o) => typeof o === "object" ? o.text || o.label || o.value || "" : String(o)).filter(Boolean);
    return [];
  };

  const deleteVideo = async (event, videoId) => {
    event.stopPropagation();
    if (!window.confirm("Delete this video?")) return;
    await remove(ref(database, `videoLibrary/${videoId}`));
    await remove(ref(database, `videoQuizzes/${videoId}`));
    if (selectedVideo?.id === videoId) setSelectedVideo(null);
  };

  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      const organName = video.metadata?.organName || video.organName || "";
      const videoType = video.metadata?.videoType || video.videoType || "";
      const typeSpecific = video.metadata?.typeSpecific || video.typeSpecific || "";
      const genericName = video.metadata?.genericName || video.genericName || "";
      const productForm = video.metadata?.productForm || video.productForm || "";

      const combinedText = [video.title, video.description, video.department, video.departmentType, organName, videoType, typeSpecific, genericName, productForm, ...(video.tags || [])]
        .filter(Boolean).join(" ").toLowerCase();

      return (
        combinedText.includes(search.toLowerCase()) &&
        (filterType ? normalizeText(videoType) === normalizeText(filterType) : true) &&
        (filterDepartment ? normalizeText(video.department) === normalizeText(filterDepartment) : true)
      );
    });
  }, [videos, search, filterType, filterDepartment]);

  if (loading) {
    return <div className="vl-page"><div className="vl-loading">Loading videos...</div></div>;
  }

  return (
    <div className="vl-page">

      {/* Hero */}
      <section className="vl-hero">
        <div className="vl-hero-content">
          <h1>Video Library</h1>
          <p>Browse, search and manage all training videos.</p>
        </div>
        <div className="vl-hero-right">
          <button
            type="button"
            className="vl-upload-btn"
            onClick={() => {
              const base = location.pathname.split("/video-library")[0];
              navigate(`${base}/video-library/upload`);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload New Video
          </button>
          <div className="vl-hero-stats">
            <div className="vl-hero-stat">
              <div className="vl-hero-stat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              </div>
              <div>
                <strong>{filteredVideos.length}</strong>
                <span>Videos</span>
              </div>
            </div>
            <div className="vl-hero-stat">
              <div className="vl-hero-stat-icon quiz-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <strong>{Object.keys(quizMap).length}</strong>
                <span>With Quiz</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Action Bar */}
      <div className="vl-action-bar">
        <div className="vl-search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="text" placeholder="Search video, description, organ, type, generic, tags..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="vl-filters">
          {canSeeAll && (
            <select className="vl-filter-select" value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}>
              <option value="">All Departments</option>
              {departmentOptions.map((d) => (<option key={d} value={d}>{d}</option>))}
            </select>
          )}
          <select className="vl-filter-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            {typeOptions.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
          {(search || filterDepartment || filterType) && (
            <button className="vl-btn vl-btn-clear" onClick={() => { setSearch(""); setFilterDepartment(""); setFilterType(""); }}>Clear</button>
          )}
        </div>
      </div>

      {/* Count Line */}
      <div className="vl-count-line">
        Showing <strong>{filteredVideos.length}</strong> of <strong>{videos.length}</strong> videos
      </div>

      {/* Video List */}
      {filteredVideos.length === 0 ? (
        <div className="vl-empty">
          <div className="vl-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          </div>
          <h3>No videos found</h3>
          <p>Try changing search or filters.</p>
        </div>
      ) : (
        <div className="vl-video-list">
          {filteredVideos.map((video) => {
            const organName = video.metadata?.organName || video.organName || "";
            const videoType = getVideoType(video);
            const typeSpecific = video.metadata?.typeSpecific || video.typeSpecific || "";
            const genericName = video.metadata?.genericName || video.genericName || "";
            const productForm = video.metadata?.productForm || video.productForm || "";
            const questions = normalizeQuestions(video.id);
            const thumbnailUrl = getThumbnailUrl(video);

            return (
              <button type="button" className="vl-video-card" key={video.id} onClick={() => setSelectedVideo(video)}>
                <div className="vl-video-thumb">
                  {thumbnailUrl ? (
                    <img src={thumbnailUrl} alt={video.title || "Training video"} />
                  ) : (
                    <div className="vl-thumb-fallback">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                  )}
                </div>

                <div className="vl-video-info">
                  <div className="vl-title-row">
                    <h3>{video.title || "Untitled Video"}</h3>
                    {questions.length > 0 && <span className="vl-quiz-pill">{questions.length} Qs</span>}
                  </div>
                  <p>{video.description || "No description added."}</p>
                  <div className="vl-video-meta">
                    {video.department && <span className="vl-meta-tag dept">{video.department}</span>}
                    {organName && <span className="vl-meta-tag">{organName}</span>}
                    {videoType && <span className="vl-meta-tag">{videoType}</span>}
                    {typeSpecific && <span className="vl-meta-tag">{typeSpecific}</span>}
                    {genericName && <span className="vl-meta-tag">{genericName}</span>}
                    {productForm && <span className="vl-meta-tag">{productForm}</span>}
                  </div>
                </div>

                {(canSeeAll || video.createdBy === currentUser?.id) && (
                  <button type="button" className="vl-delete-btn" onClick={(e) => deleteVideo(e, video.id)} title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Video Preview Modal */}
      {selectedVideo && (
        <div className="modal-overlay" onClick={() => setSelectedVideo(null)}>
          <div className="vl-preview-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="vl-modal-close" onClick={() => setSelectedVideo(null)}>×</button>

            <div className="vl-preview-area">
              {getVideoUrl(selectedVideo) ? (
                isYoutubeVideo(getVideoUrl(selectedVideo)) ? (
                  <iframe src={getYoutubeEmbedUrl(getVideoUrl(selectedVideo))} title={selectedVideo.title || "Video preview"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                ) : (
                  <video controls src={getVideoUrl(selectedVideo)}>Your browser does not support video preview.</video>
                )
              ) : (
                <div className="vl-no-preview">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  <p>No video preview URL found.</p>
                </div>
              )}
            </div>

            <div className="vl-modal-details">
              <span className="vl-modal-label">Video Preview</span>
              <h2>{selectedVideo.title || "Untitled Video"}</h2>
              <p className="vl-modal-desc">{selectedVideo.description || "No description added."}</p>

              <div className="vl-video-meta vl-modal-meta">
                {selectedVideo.department && <span className="vl-meta-tag dept">{selectedVideo.department}</span>}
                {(selectedVideo.metadata?.organName || selectedVideo.organName) && <span className="vl-meta-tag">{selectedVideo.metadata?.organName || selectedVideo.organName}</span>}
                {getVideoType(selectedVideo) && <span className="vl-meta-tag">{getVideoType(selectedVideo)}</span>}
                {(selectedVideo.metadata?.typeSpecific || selectedVideo.typeSpecific) && <span className="vl-meta-tag">{selectedVideo.metadata?.typeSpecific || selectedVideo.typeSpecific}</span>}
                {(selectedVideo.metadata?.genericName || selectedVideo.genericName) && <span className="vl-meta-tag">{selectedVideo.metadata?.genericName || selectedVideo.genericName}</span>}
              </div>

              <div className="vl-questions-box">
                <div className="vl-questions-head">
                  <span>Questions</span>
                  <strong>{normalizeQuestions(selectedVideo.id).length}</strong>
                </div>
                {normalizeQuestions(selectedVideo.id).length === 0 ? (
                  <p className="vl-no-questions">No questions added with this video.</p>
                ) : (
                  <div className="vl-question-list">
                    {normalizeQuestions(selectedVideo.id).map((q, index) => {
                      const options = getQuestionOptions(q);
                      const correctAnswer = q.correctAnswer || q.correct || q.answer || "";
                      const correctIdx = typeof correctAnswer === "number" ? correctAnswer : typeof correctAnswer === "string" ? ["a","b","c","d","e","f"].indexOf(correctAnswer.toLowerCase()) : -1;
                      const optionLabels = ["A", "B", "C", "D", "E", "F"];
                      return (
                        <div className="vl-question-card" key={q.id}>
                          <h4><span>Q{index + 1}</span>. {getQuestionText(q)}</h4>
                          {options.length > 0 && (
                            <ul>{options.map((opt, oi) => {
                              const isCorrect = correctIdx === oi;
                              return (
                                <li key={`${q.id}-${oi}`} className={isCorrect ? "correct" : ""}>
                                  <span className="vl-opt-label">{optionLabels[oi]}</span>
                                  {opt}
                                  {isCorrect && <span className="vl-correct-mark">✓</span>}
                                </li>
                              );
                            })}</ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default DepartmentVideoLibrary;
