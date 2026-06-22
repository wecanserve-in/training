import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth, database } from "../firebase";
import { ref, get, set } from "firebase/database";
import "../styles/quizpage.css";

function QuizPage() {
  const { id } = useParams(); // courseId
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuizData = async () => {
      const user = auth.currentUser;

      if (!user) {
        navigate("/");
        return;
      }

      const completedSnapshot = await get(
        ref(database, `completedCourses/${user.uid}/${id}`)
      );

      if (completedSnapshot.exists()) {
        const completedData = completedSnapshot.val();

        if (completedData.passed && completedData.attemptId) {
          navigate(`/certificate/${completedData.attemptId}`);
          return;
        }
      }

      const courseSnapshot = await get(ref(database, `courses/${id}`));

      if (!courseSnapshot.exists()) {
        alert("Course not found");
        navigate("/assigned-courses");
        return;
      }

      const courseData = {
        id,
        ...courseSnapshot.val(),
      };

      setCourse(courseData);

      const videosSnapshot = await get(ref(database, "videos"));
      const questionsSnapshot = await get(ref(database, "questions"));

      let courseVideos = [];

      if (videosSnapshot.exists()) {
        courseVideos = Object.entries(videosSnapshot.val())
          .map(([videoId, video]) => ({
            id: videoId,
            ...video,
          }))
          .filter((video) => video.courseId === id);
      }

      const durationFromVideo = courseVideos[0]?.testDuration || 60;
      setTimeLeft(durationFromVideo);

      let allQuestions = [];

      if (questionsSnapshot.exists()) {
        const questionsData = questionsSnapshot.val();

        courseVideos.forEach((video) => {
          const videoQuestions = questionsData[video.id];

          if (videoQuestions) {
            const questionArray = Object.entries(videoQuestions).map(
              ([questionId, question]) => ({
                id: `${video.id}_${questionId}`,
                videoId: video.id,
                ...question,
              })
            );

            allQuestions = [...allQuestions, ...questionArray];
          }
        });
      }

      setQuizQuestions(allQuestions);
      setLoading(false);
    };

    fetchQuizData();
  }, [id, navigate]);

  const currentQuestion = quizQuestions[currentIndex];

  const progressPercent = useMemo(() => {
    if (quizQuestions.length === 0) return 0;
    return Math.round(((currentIndex + 1) / quizQuestions.length) * 100);
  }, [currentIndex, quizQuestions.length]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const submitQuiz = async () => {
    if (submitted || !course) return;

    setSubmitted(true);

    let correct = 0;

    quizQuestions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) {
        correct += 1;
      }
    });

    const total = quizQuestions.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;

    const passingScore = course.passingScore || 70;
    const passed = score >= passingScore;

    const user = auth.currentUser;
    const attemptId = `${user.uid}_${id}_${Date.now()}`;

    await set(ref(database, `attempts/${attemptId}`), {
      userId: user.uid,
      userName: user.displayName || "",
      courseId: id,
      courseTitle: course.title || course.courseTitle || "",
      score,
      total,
      correct,
      passed,
      submittedAt: new Date().toISOString(),
    });

    await set(ref(database, `completedCourses/${user.uid}/${id}`), {
      courseId: id,
      courseTitle: course.title || course.courseTitle || "",
      passed,
      score,
      attemptId,
      completedAt: new Date().toISOString(),
    });

    navigate(`/result/${attemptId}`);
  };

  useEffect(() => {
    if (loading || submitted || !course) return;

    if (timeLeft <= 0) {
      submitQuiz();
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, submitted, loading, course]);

  if (loading) {
    return <h2 className="quiz-status-msg">Loading Quiz...</h2>;
  }

  if (!course) {
    return <h1 className="quiz-status-msg error">Course not found</h1>;
  }

  if (quizQuestions.length === 0) {
    return (
      <div className="quiz-clean-page">
        <div className="quiz-empty-card">
          <h1>{course.title || course.courseTitle}</h1>
          <p>No quiz questions added for this course yet.</p>

          <button onClick={() => navigate(`/course/${id}`)}>
            Back to Course
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-clean-page">
      <div className="quiz-clean-card">
        <div className="quiz-clean-header">
          <div>
            <h1>{course.title || course.courseTitle}</h1>

            <p>
              Question {currentIndex + 1} of {quizQuestions.length}
            </p>
          </div>

          <div className="quiz-timer-clean">
            <span>{formatTime(timeLeft)}</span>
            <small>Total Marks: {quizQuestions.length}</small>
          </div>
        </div>

        <div className="quiz-progress-line">
          <span style={{ width: `${progressPercent}%` }}></span>
        </div>

        <div className="quiz-question-area">
          <h2>{currentQuestion.question}</h2>

          <div className="quiz-options-clean">
            {currentQuestion.options.map((option, index) => {
              const isSelected = answers[currentQuestion.id] === option;
              const label = String.fromCharCode(65 + index);

              return (
                <label
                  key={option}
                  className={`quiz-option-clean ${
                    isSelected ? "selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value={option}
                    checked={isSelected}
                    onChange={() =>
                      setAnswers({
                        ...answers,
                        [currentQuestion.id]: option,
                      })
                    }
                  />

                  <span className="option-letter">{label}.</span>
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="quiz-bottom-actions">
          <button
            type="button"
            className="quiz-prev-btn"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => prev - 1)}
          >
            Previous
          </button>

          {currentIndex === quizQuestions.length - 1 ? (
            <button
              type="button"
              className="quiz-next-btn"
              onClick={submitQuiz}
            >
              Submit
            </button>
          ) : (
            <button
              type="button"
              className="quiz-next-btn"
              onClick={() => setCurrentIndex((prev) => prev + 1)}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuizPage;