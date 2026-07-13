import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { get, ref } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { auth, database } from "../firebase";
import "../styles/courseoverview.css";

function CourseOverview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [course, setCourse] = useState(null);
  const [videos, setVideos] = useState([]);
  const [questions, setQuestions] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [selectedVideo, setSelectedVideo] = useState(null);

  useEffect(() => {
    const fetchCourseData = async (user) => {
      try {
        const courseSnap = await get(ref(database, `courses/${id}`));
        if (!courseSnap.exists()) {
          setCourse(null);
          setLoading(false);
          return;
        }
        const courseData = { id, ...courseSnap.val() };
        setCourse(courseData);

        const [courseVideosSnap, librarySnap, oldVideosSnap, questionsSnap] = await Promise.all([
          get(ref(database, `courseVideos/${id}`)),
          get(ref(database, "videoLibrary")),
          get(ref(database, "videos")),
          get(ref(database, "questions"))
        ]);

        const libraryVideos = librarySnap.exists() ? librarySnap.val() : {};
        const oldVideos = oldVideosSnap.exists() ? oldVideosSnap.val() : {};
        
        let courseLessons = [];

        if (courseVideosSnap.exists()) {
          const mappedData = courseVideosSnap.val();
          courseLessons = Object.entries(mappedData).map(([mappingId, mappedVideo]) => {
            const actualVideoId = mappedVideo.videoId || mappingId;
            const fullVideo = libraryVideos[actualVideoId] || oldVideos[actualVideoId] || {};
            return { ...fullVideo, ...mappedVideo, id: actualVideoId, mappingId };
          });
        } else if (Array.isArray(courseData.videoIds) && courseData.videoIds.length > 0) {
          courseLessons = courseData.videoIds.map((videoId) => {
            const fullVideo = libraryVideos[videoId] || oldVideos[videoId] || {};
            return { ...fullVideo, id: videoId };
          });
        }

        courseLessons.sort((a, b) => (Number(a.order || 0) - Number(b.order || 0)) || (new Date(a.createdAt || 0) - new Date(b.createdAt || 0)));
        setVideos(courseLessons);

        // ✅ 3. ULTIMATE QUESTION FINDER (Finds both Course & Video specific questions)
        const videoIds = courseLessons.map(v => v.id);
        let fetchedQuestions = [];

        if (questionsSnap.exists()) {
          const qData = questionsSnap.val();

          const processQuestion = (qId, qObj, parentKey) => {
            const isForCourse = qObj.courseId === id || parentKey === id;
            const isForVideo = videoIds.includes(qObj.videoId) || videoIds.includes(parentKey);

            if (isForCourse || isForVideo) {
              fetchedQuestions.push({
                id: qId,
                ...qObj,
                // Ensure we tag it with the correct videoId if it belongs to a video
                videoId: qObj.videoId || (videoIds.includes(parentKey) ? parentKey : null)
              });
            }
          };

          Object.entries(qData).forEach(([key, val]) => {
            if (!val || typeof val !== 'object') return;

            // Flat structure: val is the question itself
            if (val.question || val.questionText) {
              processQuestion(key, val, null);
            } else {
              // Folder structure: val contains multiple questions
              Object.entries(val).forEach(([nestedKey, nestedVal]) => {
                if (nestedVal && (nestedVal.question || nestedVal.questionText)) {
                  processQuestion(nestedKey, nestedVal, key);
                }
              });
            }
          });
        }
        
        // Remove duplicates just in case
        fetchedQuestions = Array.from(new Map(fetchedQuestions.map(q => [q.id, q])).values());
        setQuestions(fetchedQuestions);
        
      } catch (error) {
        console.error("Error fetching course data:", error);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) {
        navigate("/");
        return;
      }
      const userSnap = await get(ref(database, `users/${loggedUser.uid}`));
      if (userSnap.exists()) {
        const userData = { uid: loggedUser.uid, ...userSnap.val() };
        setCurrentUser(userData);
        fetchCourseData(userData);
      }
    });

    return () => unsubscribe();
  }, [id, navigate]);

  if (loading) return <div className="co-page"><div className="co-loading">Loading Course Overview...</div></div>;

  if (!course) {
    return (
      <div className="co-page">
        <div className="co-error">
          <h2>Course Not Found</h2>
          <button onClick={() => navigate(currentUser?.role === 'admin' || currentUser?.role === 'superAdmin' ? '/admin/courses' : '/department-admin/courses')}>Go to Course Library</button>
        </div>
      </div>
    );
  }

  const thumbnail = course.thumbnailUrl || course.courseThumbnail || videos.find(v => v.thumbnailUrl)?.thumbnailUrl || "";
  const totalQuestions = questions.length;

  let basePath = "";
  if (currentUser?.role === "superAdmin") basePath = "/super-admin";
  else if (currentUser?.role === "admin") basePath = "/admin";
  else if (currentUser?.role === "departmentAdmin") basePath = "/department-admin";

  const editLink = `${basePath}/courses/edit/${course.id}`;
  const assignLink = `${basePath}/assignments?courseId=${course.id}`;

// ✅ Fixed: Added video.durationSeconds to match your database
  const formatTime = (video) => {
    const timeInfo = video.durationSeconds || video.duration || video.videoDuration || video.metadata?.duration || 0;
    
    if (!timeInfo) return "0:00";
    if (typeof timeInfo === "string" && timeInfo.includes(":")) return timeInfo;
    
    const seconds = Number(timeInfo);
    if (isNaN(seconds)) return "0:00";
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderOptions = (q) => {
    let optionsList = [];
    if (Array.isArray(q.options)) optionsList = q.options;
    else if (q.optionA || q.option1) optionsList = [q.optionA || q.option1, q.optionB || q.option2, q.optionC || q.option3, q.optionD || q.option4].filter(Boolean);
    else if (q.options && typeof q.options === 'object') optionsList = Object.values(q.options);

    if (optionsList.length === 0) return null;

    return (
      <div className="co-question-options">
        {optionsList.map((opt, i) => {
          const isCorrect = (q.correctOptionIndex === i) || (q.correctAnswer === opt) || (q.correctOption === `option${i + 1}`) || (q.correctOption === String.fromCharCode(65 + i));
          return (
            <div key={i} className={`co-option ${isCorrect ? 'correct' : ''}`}>
              {String.fromCharCode(65 + i)}. {opt}
              {isCorrect && <span className="co-correct-badge">✓ Correct</span>}
            </div>
          );
        })}
      </div>
    );
  };

  // ✅ Get Questions specific to the Selected Video for the Modal
  const videoSpecificQuestions = selectedVideo 
    ? questions.filter(q => q.videoId === selectedVideo.id) 
    : [];

  return (
    <div className="co-page">
      
      {/* VIDEO PREVIEW MODAL */}
      {selectedVideo && (
        <div className="co-modal-backdrop" onClick={() => setSelectedVideo(null)}>
          <div className="co-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="co-modal-close" onClick={() => setSelectedVideo(null)}>✕</button>
            
            <div className="co-modal-video-wrapper">
              <video controls controlsList="nodownload" autoPlay className="co-modal-player">
                <source src={selectedVideo.videoUrl || selectedVideo.url || selectedVideo.fileUrl} type="video/mp4" />
              </video>
            </div>

            <div className="co-modal-details">
              <h2>{selectedVideo.title || selectedVideo.videoTitle}</h2>
              <p>{selectedVideo.description || "No description provided for this video."}</p>
              <div className="co-modal-meta">
                <span>⏱ Duration: {formatTime(selectedVideo)}</span>
                <span>📝 {videoSpecificQuestions.length} Questions</span>
              </div>
            </div>

            {/* Video Specific Questions inside Modal */}
            {videoSpecificQuestions.length > 0 && (
              <div className="co-modal-questions">
                <h3>Video Revision Quiz</h3>
                <div className="co-questions-list">
                  {videoSpecificQuestions.map((q, index) => (
                    <div key={q.id} className="co-question-item">
                      <h4><span>Q{index + 1}.</span> {q.questionText || q.question}</h4>
                      {renderOptions(q)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="co-container">
        
        {/* TOP BAR */}
        <div className="co-top-bar">
          <button className="co-back-btn" onClick={() => navigate(`${basePath}/courses`)}>
            ← Back to Course Library
          </button>
          <div className="co-actions">
            <button className="co-btn-edit" onClick={() => navigate(editLink)}>Edit Course</button>
            <button className="co-btn-assign" onClick={() => navigate(assignLink)}>Assign Course</button>
          </div>
        </div>

        {/* HERO SECTION */}
        <div className="co-hero-card">
          <div className="co-hero-thumb">
            {thumbnail ? <img src={thumbnail} alt={course.title} /> : <div className="co-hero-fallback">▶</div>}
          </div>
          <div className="co-hero-content">
            <span className="co-badge">{course.department || "General"}</span>
            <h1>{course.title}</h1>
            <p className="co-description">{course.description || course.overview || "No description provided."}</p>
            
            <div className="co-meta-badges">
              <span>📚 {videos.length} Videos</span>
              <span>📝 {totalQuestions > 0 ? `${totalQuestions} Questions` : "No Quiz"}</span>
              {course.passingScore && <span>🏆 {course.passingScore}% Pass Mark</span>}
            </div>
          </div>
        </div>

        {/* MAIN CONTENT GRID */}
        <div className="co-grid">
          <div className="co-main-column">
            
            {/* VIDEO PLAYLIST */}
            <div className="co-section-card">
              <div className="co-section-header">
                <h2>Course Content</h2>
                <span>{videos.length} Lessons</span>
              </div>
              
            <div className="co-video-list">
                {videos.length === 0 ? (
                  <p className="co-empty-text">No videos added.</p>
                ) : (
                  videos.map((video, index) => {
                    // ✅ Fixed: Check totalQuizQuestions from your DB as well
                    const dbQuizCount = Number(video.totalQuizQuestions || 0);
                    const fetchedCount = questions.filter(q => q.videoId === video.id).length;
                    const vQuestionsCount = fetchedCount > 0 ? fetchedCount : dbQuizCount;
                    
                    return (
                      <div 
                        key={video.id} 
                        className="co-video-item clickable"
                        onClick={() => setSelectedVideo(video)}
                      >
                        <div className="co-video-number">{index + 1}</div>
                        <div className="co-video-thumb-small">
                          {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="thumb" /> : <div className="co-small-fallback">▶</div>}
                        </div>
                        <div className="co-video-details">
                          <h4>{video.title || video.videoTitle}</h4>
                          <p>{video.description || "No description"}</p>
                          
                          {vQuestionsCount > 0 && (
                            <span className="quiz-badge">
                              Has Revision Quiz ({vQuestionsCount})
                            </span>
                          )}
                        </div>
                        <div className="co-video-duration">
                          {formatTime(video)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* OVERALL COURSE QUESTIONS LIST */}
            {questions.length > 0 && (
              <div className="co-section-card">
                <div className="co-section-header">
                  <h2>All Course & Video Questions</h2>
                  <span>{questions.length} Questions Total</span>
                </div>
                <div className="co-questions-list">
                  {questions.map((q, index) => {
                    const videoName = videos.find(v => v.id === q.videoId)?.title || videos.find(v => v.id === q.videoId)?.videoTitle;
                    
                    return (
                      <div key={q.id} className="co-question-item">
                        {/* If it's a video question, show a badge */}
                        {q.videoId && videoName && (
                          <div style={{ marginBottom: "8px", fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                            Video Quiz: {videoName}
                          </div>
                        )}
                        <h4><span>Q{index + 1}.</span> {q.questionText || q.question}</h4>
                        {renderOptions(q)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="co-side-column">
            <div className="co-section-card">
              <h2>Quiz Information</h2>
              <div className="co-info-list">
                <div className="co-info-item">
                  <span>Has Questions?</span>
                  <strong>{totalQuestions > 0 ? "Yes" : "No"}</strong>
                </div>
                {totalQuestions > 0 && (
                  <>
                    <div className="co-info-item">
                      <span>Total Questions</span>
                      <strong>{totalQuestions}</strong>
                    </div>
                    <div className="co-info-item">
                      <span>Time Limit</span>
                      <strong>{course.testDuration || "Unlimited"} sec</strong>
                    </div>
                    <div className="co-info-item">
                      <span>Passing Score</span>
                      <strong>{course.passingScore || 70}%</strong>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default CourseOverview;