import { useEffect, useMemo, useState } from "react";
import { get, onValue, ref, remove } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { auth, database } from "../firebase";
import "../styles/videolibrarylist.css";

function DepartmentVideoLibrary() {
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
      normalizeText(video.department) === normalizeText(userData.department) ||
      normalizeText(video.departmentType) ===
        normalizeText(userData.departmentType)
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
        if (!loggedUser) {
          setCurrentUser(null);
          setAuthReady(true);
          return;
        }

        const userSnap = await get(ref(database, `users/${loggedUser.uid}`));

        const userData = {
          id: loggedUser.uid,
          email: loggedUser.email,
          ...(userSnap.exists() ? userSnap.val() : {}),
        };

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

    if (!currentUser) {
      setVideos([]);
      setQuizMap({});
      setLoading(false);
      return;
    }

    setLoading(true);

    const loaded = {
      videos: false,
      quizzes: false,
    };

    const markLoaded = () => {
      if (loaded.videos && loaded.quizzes) {
        setLoading(false);
      }
    };

    const unsubscribeVideos = onValue(
      ref(database, "videoLibrary"),
      (snapshot) => {
        if (!snapshot.exists()) {
          setVideos([]);
          loaded.videos = true;
          markLoaded();
          return;
        }

        const allVideos = objectToArray(snapshot.val());

        const visibleVideos = allVideos
          .filter((video) => canUserSeeVideo(video, currentUser))
          .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));

        setVideos(visibleVideos);
        loaded.videos = true;
        markLoaded();
      },
      (error) => {
        console.error(error);
        setVideos([]);
        loaded.videos = true;
        markLoaded();
      }
    );

    const unsubscribeQuizzes = onValue(
      ref(database, "videoQuizzes"),
      (snapshot) => {
        setQuizMap(snapshot.exists() ? snapshot.val() : {});
        loaded.quizzes = true;
        markLoaded();
      },
      (error) => {
        console.error(error);
        setQuizMap({});
        loaded.quizzes = true;
        markLoaded();
      }
    );

    return () => {
      unsubscribeVideos();
      unsubscribeQuizzes();
    };
  }, [authReady, currentUser]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setSelectedVideo(null);
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const departmentOptions = useMemo(() => {
    return [
      ...new Set(videos.map((video) => video.department).filter(Boolean)),
    ].sort();
  }, [videos]);

  const typeOptions = useMemo(() => {
    const firebaseTypes = videos
      .map((video) => video.metadata?.videoType || video.videoType)
      .filter(Boolean);

    return [...new Set(["Anatomy", "Therapy", "Product", "Other", ...firebaseTypes])];
  }, [videos]);

  const getVideoType = (video) => {
    return video.metadata?.videoType || video.videoType || "";
  };

  const getVideoUrl = (video) => {
    return (
      video.videoUrl ||
      video.videoURL ||
      video.fileUrl ||
      video.fileURL ||
      video.url ||
      video.uploadUrl ||
      video.downloadURL ||
      video.videoFileUrl ||
      ""
    );
  };

  const getThumbnailUrl = (video) => {
    return (
      video.thumbnailUrl ||
      video.thumbnailURL ||
      video.thumbnail ||
      video.imageUrl ||
      video.imageURL ||
      ""
    );
  };

  const getYoutubeEmbedUrl = (url) => {
    if (!url) return "";

    try {
      const parsedUrl = new URL(url);

      if (parsedUrl.hostname.includes("youtube.com")) {
        const videoId = parsedUrl.searchParams.get("v");

        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}`;
        }

        if (parsedUrl.pathname.includes("/shorts/")) {
          return `https://www.youtube.com/embed/${
            parsedUrl.pathname.split("/shorts/")[1]?.split("/")[0]
          }`;
        }
      }

      if (parsedUrl.hostname.includes("youtu.be")) {
        return `https://www.youtube.com/embed/${parsedUrl.pathname.replace(
          "/",
          ""
        )}`;
      }

      return "";
    } catch {
      return "";
    }
  };

  const isYoutubeVideo = (url) => {
    return Boolean(getYoutubeEmbedUrl(url));
  };

  const normalizeQuestions = (videoId) => {
    const quizData = quizMap?.[videoId];

    if (!quizData) return [];

    const questionsSource = quizData.questions || quizData.quizQuestions || quizData;

    if (Array.isArray(questionsSource)) {
      return questionsSource
        .filter(Boolean)
        .map((question, index) => ({
          id: question.id || index,
          ...(typeof question === "object"
            ? question
            : { question: String(question) }),
        }));
    }

    if (typeof questionsSource === "object") {
      return Object.entries(questionsSource)
        .filter(([key]) => {
          return ![
            "createdAt",
            "updatedAt",
            "videoId",
            "title",
            "description",
          ].includes(key);
        })
        .map(([id, question]) => ({
          id,
          ...(question && typeof question === "object"
            ? question
            : { question: String(question) }),
        }));
    }

    return [];
  };

  const getQuestionText = (question) => {
    return (
      question.question ||
      question.questionText ||
      question.title ||
      question.text ||
      "Untitled question"
    );
  };

  const getQuestionOptions = (question) => {
    const options =
      question.options ||
      question.choices ||
      question.answers ||
      question.optionList ||
      [];

    if (Array.isArray(options)) {
      return options
        .filter(Boolean)
        .map((option) =>
          typeof option === "object"
            ? option.text || option.label || option.value || ""
            : String(option)
        )
        .filter(Boolean);
    }

    if (options && typeof options === "object") {
      return Object.values(options)
        .map((option) =>
          typeof option === "object"
            ? option.text || option.label || option.value || ""
            : String(option)
        )
        .filter(Boolean);
    }

    return [];
  };

  const deleteVideo = async (event, videoId) => {
    event.stopPropagation();

    if (!window.confirm("Delete this video?")) return;

    await remove(ref(database, `videoLibrary/${videoId}`));
    await remove(ref(database, `videoQuizzes/${videoId}`));

    if (selectedVideo?.id === videoId) {
      setSelectedVideo(null);
    }
  };

  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      const organName = video.metadata?.organName || video.organName || "";
      const videoType = video.metadata?.videoType || video.videoType || "";
      const typeSpecific =
        video.metadata?.typeSpecific || video.typeSpecific || "";
      const genericName =
        video.metadata?.genericName || video.genericName || "";
      const productForm =
        video.metadata?.productForm || video.productForm || "";

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

      const matchesType = filterType
        ? normalizeText(videoType) === normalizeText(filterType)
        : true;

      const matchesDepartment = filterDepartment
        ? normalizeText(video.department) === normalizeText(filterDepartment)
        : true;

      return matchesSearch && matchesType && matchesDepartment;
    });
  }, [videos, search, filterType, filterDepartment]);

  if (loading) {
    return (
      <div className="video-library-page">
        <div className="video-loading-box">Loading videos...</div>
      </div>
    );
  }

  return (
    <div className="video-library-page">
      <div className="video-library-table-card">
        <div className="library-toolbar">
          <input
            type="text"
            placeholder="Search video, description, organ, type, generic, tags..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {canSeeAll && (
            <select
              value={filterDepartment}
              onChange={(event) => setFilterDepartment(event.target.value)}
            >
              <option value="">All Departments</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          )}

          <select
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
          >
            <option value="">All Types</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="clear-video-filter-btn"
            onClick={() => {
              setSearch("");
              setFilterDepartment("");
              setFilterType("");
            }}
          >
            Clear
          </button>
        </div>

        <div className="video-count-line">
          Showing <strong>{filteredVideos.length}</strong> of{" "}
          <strong>{videos.length}</strong> videos
        </div>

        {filteredVideos.length === 0 ? (
          <div className="empty-video-state">
            <h3>No videos found</h3>
            <p>Try changing search or filters.</p>
          </div>
        ) : (
          <div className="video-list-grid">
            {filteredVideos.map((video) => {
              const organName =
                video.metadata?.organName || video.organName || "";
              const videoType = getVideoType(video);
              const typeSpecific =
                video.metadata?.typeSpecific || video.typeSpecific || "";
              const genericName =
                video.metadata?.genericName || video.genericName || "";
              const productForm =
                video.metadata?.productForm || video.productForm || "";

              const questions = normalizeQuestions(video.id);
              const thumbnailUrl = getThumbnailUrl(video);

              return (
                <button
                  type="button"
                  className="video-list-card"
                  key={video.id}
                  onClick={() => setSelectedVideo(video)}
                >
                  <div className="video-thumb">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={video.title || "Training video"}
                      />
                    ) : (
                      <div className="video-thumb-fallback">
                        <span>▶</span>
                      </div>
                    )}
                  </div>

                  <div className="video-list-content">
                    <div className="video-title-row">
                      <h3>{video.title || "Untitled Video"}</h3>

                      {questions.length > 0 && (
                        <span className="question-count-pill">
                          {questions.length} Qs
                        </span>
                      )}
                    </div>

                    <p>{video.description || "No description added."}</p>

                    <div className="video-list-meta">
                      {video.department && <span>{video.department}</span>}
                      {organName && <span>{organName}</span>}
                      {videoType && <span>{videoType}</span>}
                      {typeSpecific && <span>{typeSpecific}</span>}
                      {genericName && <span>{genericName}</span>}
                      {productForm && <span>{productForm}</span>}
                      {(video.tags || []).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </div>

                  {(canSeeAll || video.createdBy === currentUser?.id) && (
                    <button
                      type="button"
                      className="delete-video-btn"
                      onClick={(event) => deleteVideo(event, video.id)}
                    >
                      Delete
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedVideo && (
        <div
          className="video-modal-backdrop"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="video-preview-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="video-modal-close"
              onClick={() => setSelectedVideo(null)}
            >
              ×
            </button>

            <div className="video-preview-area">
              {getVideoUrl(selectedVideo) ? (
                isYoutubeVideo(getVideoUrl(selectedVideo)) ? (
                  <iframe
                    src={getYoutubeEmbedUrl(getVideoUrl(selectedVideo))}
                    title={selectedVideo.title || "Video preview"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video controls src={getVideoUrl(selectedVideo)}>
                    Your browser does not support video preview.
                  </video>
                )
              ) : (
                <div className="video-no-preview">
                  <span>▶</span>
                  <p>No video preview URL found.</p>
                </div>
              )}
            </div>

            <div className="video-modal-details">
              <div className="video-modal-title-row">
                <div>
                  <span className="modal-mini-label">Video Preview</span>
                  <h2>{selectedVideo.title || "Untitled Video"}</h2>
                </div>
              </div>

              <p className="video-modal-description">
                {selectedVideo.description || "No description added."}
              </p>

              <div className="video-list-meta modal-meta">
                {selectedVideo.department && (
                  <span>{selectedVideo.department}</span>
                )}
                {(selectedVideo.metadata?.organName ||
                  selectedVideo.organName) && (
                  <span>
                    {selectedVideo.metadata?.organName || selectedVideo.organName}
                  </span>
                )}
                {getVideoType(selectedVideo) && (
                  <span>{getVideoType(selectedVideo)}</span>
                )}
                {(selectedVideo.metadata?.typeSpecific ||
                  selectedVideo.typeSpecific) && (
                  <span>
                    {selectedVideo.metadata?.typeSpecific ||
                      selectedVideo.typeSpecific}
                  </span>
                )}
                {(selectedVideo.metadata?.genericName ||
                  selectedVideo.genericName) && (
                  <span>
                    {selectedVideo.metadata?.genericName ||
                      selectedVideo.genericName}
                  </span>
                )}
                {(selectedVideo.metadata?.productForm ||
                  selectedVideo.productForm) && (
                  <span>
                    {selectedVideo.metadata?.productForm ||
                      selectedVideo.productForm}
                  </span>
                )}
              </div>

              <div className="video-questions-box">
                <div className="video-questions-head">
                  <span>Questions</span>
                  <strong>{normalizeQuestions(selectedVideo.id).length}</strong>
                </div>

                {normalizeQuestions(selectedVideo.id).length === 0 ? (
                  <p className="no-question-text">
                    No questions added with this video.
                  </p>
                ) : (
                  <div className="question-preview-list">
                    {normalizeQuestions(selectedVideo.id).map(
                      (question, index) => {
                        const options = getQuestionOptions(question);

                        return (
                          <div className="question-preview-card" key={question.id}>
                            <h4>
                              {index + 1}. {getQuestionText(question)}
                            </h4>

                            {options.length > 0 && (
                              <ul>
                                {options.map((option, optionIndex) => (
                                  <li key={`${question.id}-${optionIndex}`}>
                                    {option}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      }
                    )}
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