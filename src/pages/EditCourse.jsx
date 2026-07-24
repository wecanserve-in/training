import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  get,
  ref,
  remove,
  set,
  update,
} from "firebase/database";

import { auth, database } from "../firebase";
import useBasePath from "../hooks/useBasePath";
import "../styles/editcourse.css";

/* ======================================================
   HELPERS
====================================================== */

const createQuestionId = () =>
  `question_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

const createEmptyQuestion = () => ({
  id: createQuestionId(),
  question: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
  marks: 1,
  explanation: "",
});

const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");

const normalizeOptions = (options) => {
  if (Array.isArray(options)) {
    return options.map((option) => {
      if (typeof option === "object" && option !== null) {
        return String(
          option.text ??
            option.label ??
            option.value ??
            option.option ??
            ""
        );
      }

      return String(option ?? "");
    });
  }

  if (options && typeof options === "object") {
    return Object.keys(options)
      .sort((firstKey, secondKey) => {
        const firstNumber = Number(firstKey);
        const secondNumber = Number(secondKey);

        if (
          Number.isFinite(firstNumber) &&
          Number.isFinite(secondNumber)
        ) {
          return firstNumber - secondNumber;
        }

        return String(firstKey).localeCompare(
          String(secondKey)
        );
      })
      .map((key) => {
        const option = options[key];

        if (typeof option === "object" && option !== null) {
          return String(
            option.text ??
              option.label ??
              option.value ??
              option.option ??
              ""
          );
        }

        return String(option ?? "");
      });
  }

  return ["", "", "", ""];
};

const normalizeCorrectAnswer = (
  questionData,
  normalizedOptions
) => {
  const rawOptions =
    questionData.options ||
    questionData.answers ||
    questionData.choices;

  /*
   * Handle options like:
   * [{ text: "A", isCorrect: false }, ...]
   */
  if (Array.isArray(rawOptions)) {
    const correctObjectIndex = rawOptions.findIndex(
      (option) =>
        typeof option === "object" &&
        option !== null &&
        (option.isCorrect === true ||
          option.correct === true ||
          option.is_correct === true)
    );

    if (correctObjectIndex >= 0) {
      return correctObjectIndex;
    }
  }

  /*
   * Prefer explicit index fields.
   */
  const explicitIndex =
    questionData.correctOptionIndex ??
    questionData.correctAnswerIndex ??
    questionData.correctIndex ??
    questionData.answerIndex;

  if (
    explicitIndex !== undefined &&
    explicitIndex !== null &&
    String(explicitIndex).trim() !== ""
  ) {
    const parsedIndex = Number(explicitIndex);

    if (Number.isInteger(parsedIndex)) {
      return Math.max(
        0,
        Math.min(
          parsedIndex,
          normalizedOptions.length - 1
        )
      );
    }
  }

  const possibleCorrectAnswer =
    questionData.correctOption ??
    questionData.correctAnswer ??
    questionData.answer ??
    questionData.correctAnswerText ??
    0;

  /*
   * Numeric answer/index.
   */
  if (typeof possibleCorrectAnswer === "number") {
    return Math.max(
      0,
      Math.min(
        possibleCorrectAnswer,
        normalizedOptions.length - 1
      )
    );
  }

  const answerValue = String(
    possibleCorrectAnswer ?? ""
  ).trim();

  /*
   * Numeric string such as "0", "1", "2".
   */
  if (/^\d+$/.test(answerValue)) {
    const parsedIndex = Number(answerValue);

    return Math.max(
      0,
      Math.min(
        parsedIndex,
        normalizedOptions.length - 1
      )
    );
  }

  /*
   * Letter such as A, B, C, D.
   */
  if (/^[a-z]$/i.test(answerValue)) {
    const letterIndex =
      answerValue.toUpperCase().charCodeAt(0) - 65;

    if (
      letterIndex >= 0 &&
      letterIndex < normalizedOptions.length
    ) {
      return letterIndex;
    }
  }

  /*
   * Correct answer stored as actual option text.
   */
  const matchingIndex = normalizedOptions.findIndex(
    (option) =>
      String(option).trim().toLowerCase() ===
      answerValue.toLowerCase()
  );

  return matchingIndex >= 0 ? matchingIndex : 0;
};

const normalizeQuestions = (questionsData) => {
  if (!questionsData) return [];

  const questionsArray = Array.isArray(questionsData)
    ? questionsData
        .filter(Boolean)
        .map((question, index) => ({
          id:
            question?.id ||
            question?.questionId ||
            `question_${index + 1}`,
          ...(question || {}),
        }))
    : Object.entries(questionsData).map(
        ([questionId, question]) => ({
          id: questionId,
          ...(question || {}),
        })
      );

  return questionsArray
    .filter(Boolean)
    .map((questionData, index) => {
      const normalizedOptions = normalizeOptions(
        questionData.options ||
          questionData.answers ||
          questionData.choices
      );

      const safeOptions =
        normalizedOptions.length >= 2
          ? normalizedOptions
          : [...normalizedOptions, "", ""].slice(0, 2);

      return {
        id:
          questionData.id ||
          questionData.questionId ||
          `question_${index + 1}`,

        question:
          questionData.question ||
          questionData.questionText ||
          questionData.title ||
          "",

        options: safeOptions,

        correctAnswer: normalizeCorrectAnswer(
          questionData,
          safeOptions
        ),

        marks: Math.max(
          1,
          Number(
            questionData.marks ??
              questionData.points ??
              1
          ) || 1
        ),

        explanation:
          questionData.explanation ||
          questionData.description ||
          "",
      };
    })
    .sort(
      (firstQuestion, secondQuestion) =>
        Number(firstQuestion.order || 0) -
        Number(secondQuestion.order || 0)
    );
};

/*
 * Old Firebase values might contain:
 * 20 = 20 minutes
 * 1200 = 20 minutes stored in seconds
 *
 * The learner QuizPage expects quizDuration/testDuration
 * in seconds, so this converts saved values back to minutes
 * for the edit input.
 */
const normalizeDurationToMinutes = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 20;
  }

  /*
   * More than 300 is almost certainly seconds.
   */
  if (numericValue > 300) {
    return Math.max(1, Math.round(numericValue / 60));
  }

  return Math.max(1, numericValue);
};

/* ======================================================
   COMPONENT
====================================================== */

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

  const [thumbnailFile, setThumbnailFile] =
    useState(null);

  const [thumbnailPreview, setThumbnailPreview] =
    useState("");

  const [existingThumbnail, setExistingThumbnail] =
    useState("");

  const [courseVideos, setCourseVideos] = useState([]);
  const [videoLibrary, setVideoLibrary] = useState([]);

  const [videoSearch, setVideoSearch] = useState("");
  const [filterType, setFilterType] = useState("");

  const [showAddVideos, setShowAddVideos] =
    useState(false);

  const [originalVideoIds, setOriginalVideoIds] =
    useState([]);

  const [dragIndex, setDragIndex] = useState(null);

  const [dragOverIndex, setDragOverIndex] =
    useState(null);

  /*
   * Quiz duration is maintained in minutes in UI.
   */
  const [quizDuration, setQuizDuration] = useState(20);

  const [passingPercentage, setPassingPercentage] =
    useState(70);

  const [quizQuestions, setQuizQuestions] = useState([]);

  const [originalQuizSnapshot, setOriginalQuizSnapshot] =
    useState("");

  const checkIsDeptAdmin = (user) =>
    normalizeRole(user?.role) === "departmentadmin";

  const checkCanEdit = (user) => {
    const role = normalizeRole(user?.role);

    return [
      "superadmin",
      "admin",
      "departmentadmin",
    ].includes(role);
  };

  /* ======================================================
     INITIAL LOAD
  ====================================================== */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (!firebaseUser) {
          navigate("/");
          return;
        }

        try {
          setLoading(true);

          const userSnapshot = await get(
            ref(database, `users/${firebaseUser.uid}`)
          );

          if (!userSnapshot.exists()) {
            alert("User profile not found.");
            navigate("/");
            return;
          }

          const userData = {
            id: firebaseUser.uid,
            email: firebaseUser.email || "",
            ...userSnapshot.val(),
          };

          if (!checkCanEdit(userData)) {
            alert(
              "You don't have permission to edit courses."
            );
            navigate(-1);
            return;
          }

          setCurrentUser(userData);

          await Promise.all([
            loadCourse(courseId, userData),
            loadVideoLibrary(userData),
          ]);
        } catch (error) {
          console.error("Course load error:", error);

          alert(
            error?.message ||
              "Failed to load the course."
          );
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [courseId, navigate]);

  useEffect(() => {
    return () => {
      if (thumbnailPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(thumbnailPreview);
      }
    };
  }, [thumbnailPreview]);

  const loadCourse = async (
    currentCourseId,
    userData
  ) => {
    const courseSnapshot = await get(
      ref(database, `courses/${currentCourseId}`)
    );

    if (!courseSnapshot.exists()) {
      alert("Course not found.");
      navigate(`${basePath}/courses`);
      return;
    }

    const courseData = courseSnapshot.val();
    const role = normalizeRole(userData.role);

    const isCreator =
      courseData.createdBy === userData.id;

    const isAdmin = [
      "superadmin",
      "admin",
    ].includes(role);

    const isDepartmentAdmin =
      role === "departmentadmin";

    if (
      !isCreator &&
      !isAdmin &&
      !isDepartmentAdmin
    ) {
      alert(
        "You don't have permission to edit this course."
      );

      navigate(-1);
      return;
    }

    setTitle(courseData.title || "");

    setOverview(
      courseData.description ||
        courseData.overview ||
        ""
    );

    setExistingThumbnail(
      courseData.courseThumbnail ||
        courseData.thumbnailUrl ||
        ""
    );

    const videosSnapshot = await get(
      ref(
        database,
        `courseVideos/${currentCourseId}`
      )
    );

    if (videosSnapshot.exists()) {
      const videos = Object.entries(
        videosSnapshot.val()
      )
        .map(([videoId, video]) => ({
          id: videoId,
          ...(video || {}),
        }))
        .sort(
          (firstVideo, secondVideo) =>
            Number(firstVideo.order || 0) -
            Number(secondVideo.order || 0)
        );

      setCourseVideos(videos);

      setOriginalVideoIds(
        videos.map((video) => video.id)
      );
    } else {
      setCourseVideos([]);
      setOriginalVideoIds([]);
    }

    await loadCourseQuiz(
      currentCourseId,
      courseData
    );
  };

  const loadCourseQuiz = async (
    currentCourseId,
    courseData
  ) => {
    /*
     * questions/{courseId} is the actual path used
     * by your QuizPage for the final course quiz.
     */
    const [
      questionsSnapshot,
      courseQuizSnapshot,
      legacyCourseQuizSnapshot,
      quizzesSnapshot,
      courseTestsSnapshot,
    ] = await Promise.all([
      get(
        ref(
          database,
          `questions/${currentCourseId}`
        )
      ),

      get(
        ref(
          database,
          `courseQuizzes/${currentCourseId}`
        )
      ),

      get(
        ref(
          database,
          `courseQuiz/${currentCourseId}`
        )
      ),

      get(
        ref(
          database,
          `quizzes/${currentCourseId}`
        )
      ),

      get(
        ref(
          database,
          `courseTests/${currentCourseId}`
        )
      ),
    ]);

    let questionsData = null;
    let quizSettingsData = null;

    /*
     * Questions must prefer questions/{courseId},
     * because that is what learner QuizPage loads.
     */
    if (questionsSnapshot.exists()) {
      questionsData = questionsSnapshot.val();
    }

    /*
     * Quiz settings can be loaded from canonical
     * or older quiz nodes.
     */
    if (courseQuizSnapshot.exists()) {
      quizSettingsData = courseQuizSnapshot.val();
    } else if (legacyCourseQuizSnapshot.exists()) {
      quizSettingsData =
        legacyCourseQuizSnapshot.val();
    } else if (quizzesSnapshot.exists()) {
      quizSettingsData = quizzesSnapshot.val();
    } else if (courseTestsSnapshot.exists()) {
      quizSettingsData =
        courseTestsSnapshot.val();
    }

    /*
     * Fallback question source.
     */
    if (!questionsData) {
      questionsData =
        quizSettingsData?.questions ||
        quizSettingsData?.quizQuestions ||
        quizSettingsData?.items ||
        courseData.quizQuestions ||
        courseData.questions ||
        courseData.quiz?.questions ||
        courseData.finalQuiz?.questions ||
        null;
    }

    const normalizedQuestions =
      normalizeQuestions(questionsData);

    /*
     * Prefer explicit minute field first.
     * quizDuration/testDuration are stored as seconds
     * by the updated save function.
     */
    let durationMinutes;

    const explicitMinutes = Number(
      quizSettingsData?.quizDurationMinutes ??
        quizSettingsData?.durationMinutes ??
        courseData.quizDurationMinutes ??
        courseData.durationMinutes
    );

    if (
      Number.isFinite(explicitMinutes) &&
      explicitMinutes > 0
    ) {
      durationMinutes = explicitMinutes;
    } else {
      const rawDuration =
        quizSettingsData?.testDuration ??
        quizSettingsData?.quizDuration ??
        quizSettingsData?.timeLimit ??
        courseData.testDuration ??
        courseData.quizDuration ??
        courseData.timeLimit ??
        1200;

      durationMinutes =
        normalizeDurationToMinutes(rawDuration);
    }

    const passing = Number(
      quizSettingsData?.passingPercentage ??
        quizSettingsData?.passPercentage ??
        quizSettingsData?.passingScore ??
        courseData.passingPercentage ??
        courseData.passPercentage ??
        courseData.passingScore ??
        70
    );

    const safeDurationMinutes = Math.max(
      1,
      Number(durationMinutes) || 20
    );

    const safePassingPercentage = Math.min(
      100,
      Math.max(1, Number(passing) || 70)
    );

    setQuizDuration(safeDurationMinutes);

    setPassingPercentage(
      safePassingPercentage
    );

    setQuizQuestions(normalizedQuestions);

    setOriginalQuizSnapshot(
      JSON.stringify({
        durationMinutes: safeDurationMinutes,
        passingPercentage:
          safePassingPercentage,
        questions: normalizedQuestions,
      })
    );
  };

  const loadVideoLibrary = async (userData) => {
    const librarySnapshot = await get(
      ref(database, "videoLibrary")
    );

    if (!librarySnapshot.exists()) {
      setVideoLibrary([]);
      return;
    }

    const libraryVideos = Object.entries(
      librarySnapshot.val()
    ).map(([videoId, video]) => ({
      id: videoId,
      ...(video || {}),
    }));

    let filteredVideos = libraryVideos;

    if (checkIsDeptAdmin(userData)) {
      filteredVideos = libraryVideos.filter(
        (video) =>
          video.department ===
            userData.department ||
          video.departmentType ===
            userData.departmentType ||
          (userData.departmentId &&
            video.departmentId ===
              userData.departmentId) ||
          video.createdBy === userData.id
      );
    }

    filteredVideos.sort(
      (firstVideo, secondVideo) =>
        new Date(
          secondVideo.createdAt || 0
        ).getTime() -
        new Date(
          firstVideo.createdAt || 0
        ).getTime()
    );

    setVideoLibrary(filteredVideos);
  };

  /* ======================================================
     THUMBNAIL
  ====================================================== */

  const uploadImageToCloudinary = async (file) => {
    if (!file) return "";

    const cloudName =
      import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

    const uploadPreset =
      import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error(
        "Cloudinary environment variables are missing."
      );
    }

    const formData = new FormData();

    formData.append("file", file);

    formData.append(
      "upload_preset",
      uploadPreset
    );

    const safeFolder = String(
      currentUser?.department || "General"
    ).replace(/[^a-zA-Z0-9_-]/g, "-");

    formData.append(
      "folder",
      `lms/${safeFolder}`
    );

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(
        "Thumbnail upload failed."
      );
    }

    const uploadedData =
      await response.json();

    return uploadedData.secure_url || "";
  };

  const handleThumbChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");

      event.target.value = "";
      return;
    }

    if (thumbnailPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailPreview);
    }

    setThumbnailFile(file);

    setThumbnailPreview(
      URL.createObjectURL(file)
    );
  };

  const removeThumb = () => {
    if (thumbnailPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailPreview);
    }

    setThumbnailFile(null);
    setThumbnailPreview("");
    setExistingThumbnail("");

    if (thumbInputRef.current) {
      thumbInputRef.current.value = "";
    }
  };

  /* ======================================================
     VIDEOS
  ====================================================== */

  const addVideoToCourse = (video) => {
    const alreadyAdded = courseVideos.some(
      (courseVideo) =>
        courseVideo.id === video.id
    );

    if (alreadyAdded) return;

    setCourseVideos((previousVideos) => [
      ...previousVideos,
      {
        ...video,
        id: video.id,
        order: previousVideos.length + 1,
        addedAt: new Date().toISOString(),
      },
    ]);
  };

  const removeVideoFromCourse = (videoId) => {
    setCourseVideos((previousVideos) =>
      previousVideos
        .filter((video) => video.id !== videoId)
        .map((video, index) => ({
          ...video,
          order: index + 1,
        }))
    );
  };

  const moveVideo = (fromIndex, toIndex) => {
    if (
      toIndex < 0 ||
      toIndex >= courseVideos.length
    ) {
      return;
    }

    setCourseVideos((previousVideos) => {
      const updatedVideos = [...previousVideos];

      const [movedVideo] =
        updatedVideos.splice(fromIndex, 1);

      updatedVideos.splice(
        toIndex,
        0,
        movedVideo
      );

      return updatedVideos.map(
        (video, index) => ({
          ...video,
          order: index + 1,
        })
      );
    });
  };

  const handleDragStart = (index) => {
    setDragIndex(index);
  };

  const handleDragOver = (event, index) => {
    event.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (index) => {
    if (
      dragIndex !== null &&
      dragIndex !== index
    ) {
      moveVideo(dragIndex, index);
    }

    setDragIndex(null);
    setDragOverIndex(null);
  };

  /* ======================================================
     QUIZ HANDLERS
  ====================================================== */

  const addQuizQuestion = () => {
    setQuizQuestions((previousQuestions) => [
      ...previousQuestions,
      createEmptyQuestion(),
    ]);
  };

  const removeQuizQuestion = (questionId) => {
    const shouldRemove = window.confirm(
      "Remove this quiz question?"
    );

    if (!shouldRemove) return;

    setQuizQuestions((previousQuestions) =>
      previousQuestions.filter(
        (question) =>
          question.id !== questionId
      )
    );
  };

  const updateQuizQuestion = (
    questionId,
    field,
    value
  ) => {
    setQuizQuestions((previousQuestions) =>
      previousQuestions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              [field]: value,
            }
          : question
      )
    );
  };

  const updateQuizOption = (
    questionId,
    optionIndex,
    value
  ) => {
    setQuizQuestions((previousQuestions) =>
      previousQuestions.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        const updatedOptions = [
          ...question.options,
        ];

        updatedOptions[optionIndex] = value;

        return {
          ...question,
          options: updatedOptions,
        };
      })
    );
  };

  const addOptionToQuestion = (questionId) => {
    setQuizQuestions((previousQuestions) =>
      previousQuestions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              options: [
                ...question.options,
                "",
              ],
            }
          : question
      )
    );
  };

  const removeOptionFromQuestion = (
    questionId,
    optionIndex
  ) => {
    setQuizQuestions((previousQuestions) =>
      previousQuestions.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        if (question.options.length <= 2) {
          alert(
            "Every question must have at least two options."
          );

          return question;
        }

        const updatedOptions =
          question.options.filter(
            (_, currentIndex) =>
              currentIndex !== optionIndex
          );

        let updatedCorrectAnswer =
          Number(question.correctAnswer) || 0;

        if (
          optionIndex ===
          Number(question.correctAnswer)
        ) {
          updatedCorrectAnswer = 0;
        } else if (
          optionIndex <
          Number(question.correctAnswer)
        ) {
          updatedCorrectAnswer -= 1;
        }

        return {
          ...question,
          options: updatedOptions,
          correctAnswer:
            updatedCorrectAnswer,
        };
      })
    );
  };

  const moveQuizQuestion = (
    fromIndex,
    toIndex
  ) => {
    if (
      toIndex < 0 ||
      toIndex >= quizQuestions.length
    ) {
      return;
    }

    setQuizQuestions((previousQuestions) => {
      const updatedQuestions = [
        ...previousQuestions,
      ];

      const [movedQuestion] =
        updatedQuestions.splice(
          fromIndex,
          1
        );

      updatedQuestions.splice(
        toIndex,
        0,
        movedQuestion
      );

      return updatedQuestions;
    });
  };

  /* ======================================================
     FILTERED VIDEO LIBRARY
  ====================================================== */

  const filteredAvailable = useMemo(() => {
    return videoLibrary.filter((video) => {
      const alreadyAdded = courseVideos.some(
        (courseVideo) =>
          courseVideo.id === video.id
      );

      if (alreadyAdded) return false;

      if (videoSearch.trim()) {
        const searchableText = [
          video.title,
          video.description,
          video.metadata?.organName,
          video.metadata?.videoType,
          video.metadata?.genericName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (
          !searchableText.includes(
            videoSearch
              .trim()
              .toLowerCase()
          )
        ) {
          return false;
        }
      }

      if (
        filterType &&
        video.metadata?.videoType !== filterType
      ) {
        return false;
      }

      return true;
    });
  }, [
    videoLibrary,
    courseVideos,
    videoSearch,
    filterType,
  ]);

  /* ======================================================
     VALIDATION
  ====================================================== */

  const validateQuiz = () => {
    if (quizQuestions.length === 0) {
      /*
       * Quiz is allowed to be empty.
       * QuizPage automatically generates certificate
       * when no questions exist.
       */
      return true;
    }

    const durationMinutes = Number(
      quizDuration
    );

    if (
      !Number.isFinite(durationMinutes) ||
      durationMinutes < 1
    ) {
      alert(
        "Quiz duration must be at least 1 minute."
      );

      return false;
    }

    const passing = Number(
      passingPercentage
    );

    if (
      !Number.isFinite(passing) ||
      passing < 1 ||
      passing > 100
    ) {
      alert(
        "Passing percentage must be between 1 and 100."
      );

      return false;
    }

    for (
      let questionIndex = 0;
      questionIndex < quizQuestions.length;
      questionIndex += 1
    ) {
      const question =
        quizQuestions[questionIndex];

      if (!String(question.question).trim()) {
        alert(
          `Enter question ${questionIndex + 1}.`
        );

        return false;
      }

      if (
        !Array.isArray(question.options) ||
        question.options.length < 2
      ) {
        alert(
          `Question ${
            questionIndex + 1
          } must have at least two options.`
        );

        return false;
      }

      const hasEmptyOption =
        question.options.some(
          (option) =>
            !String(option).trim()
        );

      if (hasEmptyOption) {
        alert(
          `Fill all options for question ${
            questionIndex + 1
          }.`
        );

        return false;
      }

      const correctAnswerIndex = Number(
        question.correctAnswer
      );

      if (
        !Number.isInteger(correctAnswerIndex) ||
        correctAnswerIndex < 0 ||
        correctAnswerIndex >=
          question.options.length
      ) {
        alert(
          `Select the correct answer for question ${
            questionIndex + 1
          }.`
        );

        return false;
      }

      if (
        !Number.isFinite(
          Number(question.marks)
        ) ||
        Number(question.marks) < 1
      ) {
        alert(
          `Marks for question ${
            questionIndex + 1
          } must be at least 1.`
        );

        return false;
      }
    }

    return true;
  };

  /* ======================================================
     RESET ASSIGNED USERS
  ====================================================== */

  const resetAssignedUsersProgress = async () => {
  const assignmentsSnapshot = await get(
    ref(database, "userAssignments")
  );

  if (!assignmentsSnapshot.exists()) {
    return;
  }

  const allAssignments =
    assignmentsSnapshot.val();

  const progressUpdates = {};

  for (const [userId, userCourses] of Object.entries(
    allAssignments
  )) {
    const assignment =
      userCourses?.[courseId];

    const isAssigned =
      assignment === true ||
      assignment?.assigned === true ||
      Boolean(assignment);

    if (!isAssigned) {
      continue;
    }

    /*
     * Reset only final-course completion.
     * Do not reset video progress.
     * Do not delete practice/revision quiz attempts.
     */
    progressUpdates[
      `completedCourses/${userId}/${courseId}`
    ] = null;

    progressUpdates[
      `courseProgress/${userId}/${courseId}/completed`
    ] = false;

    progressUpdates[
      `courseProgress/${userId}/${courseId}/courseTestCompleted`
    ] = false;

    progressUpdates[
      `courseProgress/${userId}/${courseId}/courseTestPassed`
    ] = false;

    progressUpdates[
      `courseProgress/${userId}/${courseId}/score`
    ] = null;

    progressUpdates[
      `courseProgress/${userId}/${courseId}/percentage`
    ] = null;

    progressUpdates[
      `courseProgress/${userId}/${courseId}/correct`
    ] = null;

    progressUpdates[
      `courseProgress/${userId}/${courseId}/totalMarks`
    ] = null;

    progressUpdates[
      `courseProgress/${userId}/${courseId}/finalQuizAttemptId`
    ] = null;

    progressUpdates[
      `courseProgress/${userId}/${courseId}/legacyAttemptId`
    ] = null;

    /*
     * Read existing attempts and remove only final attempts.
     * Practice attempts must remain because QuizPage checks them.
     */
    const attemptsSnapshot = await get(
      ref(
        database,
        `quizAttempts/${userId}/${courseId}`
      )
    );

    if (attemptsSnapshot.exists()) {
      const attempts =
        attemptsSnapshot.val() || {};

      Object.entries(attempts).forEach(
        ([attemptId, attempt]) => {
          const quizType = String(
            attempt?.quizType || ""
          )
            .trim()
            .toLowerCase();

          const isPracticeAttempt =
            quizType === "practice" ||
            Boolean(attempt?.videoId);

          const isFinalAttempt =
            quizType === "final" ||
            (!isPracticeAttempt &&
              String(attemptId).startsWith(
                "final_"
              ));

          if (isFinalAttempt) {
            progressUpdates[
              `quizAttempts/${userId}/${courseId}/${attemptId}`
            ] = null;
          }
        }
      );
    }
  }

  if (
    Object.keys(progressUpdates).length > 0
  ) {
    await update(
      ref(database),
      progressUpdates
    );
  }
};
  /* ======================================================
     SAVE
  ====================================================== */

  const handleSave = async () => {
    if (!title.trim()) {
      alert("Course title is required.");
      return;
    }

    if (courseVideos.length === 0) {
      alert(
        "Add at least one video to the course."
      );

      return;
    }

    if (!validateQuiz()) {
      return;
    }

    setSaving(true);

    try {
      let thumbnailUrl =
        existingThumbnail;

      if (thumbnailFile) {
        thumbnailUrl =
          await uploadImageToCloudinary(
            thumbnailFile
          );
      }

      const durationInMinutes = Math.max(
        1,
        Number(quizDuration) || 20
      );

      /*
       * QuizPage uses testDuration/quizDuration directly
       * as seconds.
       */
      const durationInSeconds =
        durationInMinutes * 60;

      const safePassingPercentage = Math.min(
        100,
        Math.max(
          1,
          Number(passingPercentage) || 70
        )
      );

      const sanitizedQuizQuestions =
        quizQuestions.map(
          (question, index) => {
            const cleanOptions =
              question.options.map((option) =>
                String(option).trim()
              );

            const correctAnswerIndex = Math.max(
              0,
              Math.min(
                Number(question.correctAnswer) || 0,
                cleanOptions.length - 1
              )
            );

            const correctAnswerText =
              cleanOptions[correctAnswerIndex] || "";

            const correctAnswerLetter =
              String.fromCharCode(
                65 + correctAnswerIndex
              );

            return {
              id: question.id,

              question:
                String(question.question).trim(),

              questionText:
                String(question.question).trim(),

              options: cleanOptions,

              /*
               * QuizPage-compatible formats
               */
              correctOptionIndex:
                correctAnswerIndex,

              correctAnswerIndex:
                correctAnswerIndex,

              correctIndex:
                correctAnswerIndex,

              /*
               * QuizPage checks correctOption against A/B/C/D.
               */
              correctOption:
                correctAnswerLetter,

              /*
               * QuizPage finally compares correctAnswer
               * with selected option text.
               */
              correctAnswer:
                correctAnswerText,

              correctAnswerText:
                correctAnswerText,

              answer:
                correctAnswerText,

              marks: Math.max(
                1,
                Number(question.marks) || 1
              ),

              explanation: String(
                question.explanation || ""
              ).trim(),

              order: index + 1,
            };
          }
        );

      const questionsObject =
        sanitizedQuizQuestions.reduce(
          (
            questionResult,
            question
          ) => {
            questionResult[question.id] = {
              id: question.id,

              question: question.question,

              questionText:
                question.questionText,

              options: question.options,

              correctOptionIndex:
                question.correctOptionIndex,

              correctAnswerIndex:
                question.correctAnswerIndex,

              correctIndex:
                question.correctIndex,

              correctOption:
                question.correctOption,

              correctAnswer:
                question.correctAnswer,

              correctAnswerText:
                question.correctAnswerText,

              answer: question.answer,

              marks: question.marks,

              explanation:
                question.explanation,

              order: question.order,
            };

            return questionResult;
          },
          {}
        );

      const totalMarks =
        sanitizedQuizQuestions.reduce(
          (sum, question) =>
            sum + Number(question.marks || 1),
          0
        );

      const quizPayload = {
        courseId,
        courseTitle: title.trim(),

        enabled:
          sanitizedQuizQuestions.length > 0,

        quizEnabled:
          sanitizedQuizQuestions.length > 0,

        hasQuiz:
          sanitizedQuizQuestions.length > 0,

        /*
         * Minute fields for edit/admin pages.
         */
        durationMinutes: durationInMinutes,
        quizDurationMinutes:
          durationInMinutes,

        /*
         * Second fields used by learner QuizPage.
         */
        quizDuration: durationInSeconds,
        testDuration: durationInSeconds,
        timeLimit: durationInSeconds,
        durationSeconds: durationInSeconds,
        quizDurationSeconds:
          durationInSeconds,
        timeLimitSeconds:
          durationInSeconds,

        passingPercentage:
          safePassingPercentage,

        passPercentage:
          safePassingPercentage,

        passingScore:
          safePassingPercentage,

        totalQuestions:
          sanitizedQuizQuestions.length,

        totalQuizQuestions:
          sanitizedQuizQuestions.length,

        totalMarks,

        questions: questionsObject,

        updatedAt:
          new Date().toISOString(),

        updatedBy: currentUser.id,
      };

      const currentVideoIds =
        courseVideos.map((video) => video.id);

      const videosChanged =
        JSON.stringify(originalVideoIds) !==
        JSON.stringify(currentVideoIds);

      const currentQuizSnapshot = JSON.stringify({
  durationMinutes: durationInMinutes,
  passingPercentage: safePassingPercentage,

  questions: sanitizedQuizQuestions.map(
    (question) => ({
      id: question.id,
      question: question.question,
      options: question.options,
      correctAnswerIndex:
        question.correctAnswerIndex,
      correctOption:
        question.correctOption,
      correctAnswer:
        question.correctAnswer,
      marks: question.marks,
      explanation:
        question.explanation,
      order: question.order,
    })
  ),
});
      const quizChanged =
        originalQuizSnapshot !==
        currentQuizSnapshot;

      /*
       * Update course details and timer fields.
       */
      await update(
        ref(database, `courses/${courseId}`),
        {
          title: title.trim(),

          description: overview.trim(),

          overview: overview.trim(),

          courseThumbnail: thumbnailUrl,

          thumbnailUrl,

          totalVideos:
            courseVideos.length,

          videoIds: currentVideoIds,

          quizEnabled:
            sanitizedQuizQuestions.length > 0,

          hasQuiz:
            sanitizedQuizQuestions.length > 0,

          /*
           * Minutes for edit UI.
           */
          durationMinutes:
            durationInMinutes,

          quizDurationMinutes:
            durationInMinutes,

          /*
           * Seconds for QuizPage timer.
           */
          quizDuration:
            durationInSeconds,

          testDuration:
            durationInSeconds,

          timeLimit:
            durationInSeconds,

          durationSeconds:
            durationInSeconds,

          quizDurationSeconds:
            durationInSeconds,

          timeLimitSeconds:
            durationInSeconds,

          passingPercentage:
            safePassingPercentage,

          passPercentage:
            safePassingPercentage,

          passingScore:
            safePassingPercentage,

          totalQuizQuestions:
            sanitizedQuizQuestions.length,

          totalQuestions:
            sanitizedQuizQuestions.length,

          totalQuizMarks: totalMarks,

          updatedAt:
            new Date().toISOString(),

          updatedBy: currentUser.id,
        }
      );

      /*
       * Replace course video mappings.
       */
      await remove(
        ref(
          database,
          `courseVideos/${courseId}`
        )
      );

      const videoUpdates = {};

      courseVideos.forEach(
        (video, index) => {
          videoUpdates[
            `courseVideos/${courseId}/${video.id}`
          ] = {
            ...video,

            id: video.id,

            videoId:
              video.videoId || video.id,

            courseId,

            courseTitle:
              title.trim(),

            order: index + 1,

            addedAt:
              video.addedAt ||
              new Date().toISOString(),
          };
        }
      );

      if (
        Object.keys(videoUpdates).length > 0
      ) {
        await update(
          ref(database),
          videoUpdates
        );
      }

      /*
       * Save complete quiz metadata.
       */
      await set(
        ref(
          database,
          `courseQuizzes/${courseId}`
        ),
        quizPayload
      );

      /*
       * Most important:
       * QuizPage reads questions/{courseId}.
       */
      await set(
        ref(
          database,
          `questions/${courseId}`
        ),
        questionsObject
      );

      const newlyAddedVideoIds =
        currentVideoIds.filter(
          (videoId) =>
            !originalVideoIds.includes(videoId)
        );

      if (videosChanged || quizChanged) {
        await set(
          ref(
            database,
            `courseContentUpdates/${courseId}`
          ),
          {
            lastUpdatedAt:
              new Date().toISOString(),

            updatedBy: currentUser.id,

            updateType:
              videosChanged && quizChanged
                ? "videos_and_quiz"
                : videosChanged
                  ? "videos"
                  : "quiz",

            newVideoIds:
              newlyAddedVideoIds,

            videosChanged,

            quizChanged,

            quizDurationMinutes:
              durationInMinutes,

            quizDurationSeconds:
              durationInSeconds,
          }
        );

        await resetAssignedUsersProgress();
      }

      setOriginalVideoIds(
        currentVideoIds
      );

      setOriginalQuizSnapshot(
        currentQuizSnapshot
      );

      alert(
        "Course, videos, quiz answers and quiz time updated successfully."
      );

      navigate(`${basePath}/courses`);
    } catch (error) {
      console.error(
        "Course update error:",
        error
      );

      alert(
        error?.message ||
          "Failed to update course."
      );
    } finally {
      setSaving(false);
    }
  };

  /* ======================================================
     DISPLAY HELPERS
  ====================================================== */

  const formatDuration = (seconds) => {
    const numericSeconds = Number(seconds);

    if (!numericSeconds) return "";

    const minutes = Math.floor(
      numericSeconds / 60
    );

    const remainingSeconds = Math.floor(
      numericSeconds % 60
    );

    return `${minutes}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  const totalQuizMarks = useMemo(
    () =>
      quizQuestions.reduce(
        (total, question) =>
          total +
          Math.max(
            1,
            Number(question.marks) || 1
          ),
        0
      ),
    [quizQuestions]
  );

  /* ======================================================
     LOADING
  ====================================================== */

  if (loading) {
    return (
      <div className="ec-page">
        <div className="ec-loading">
          Loading course...
        </div>
      </div>
    );
  }

  /* ======================================================
     UI
  ====================================================== */

  return (
    <div className="ec-page">
      <div className="ec-topbar">
        <button
          type="button"
          className="ec-back-btn"
          onClick={() =>
            navigate(`${basePath}/courses`)
          }
        >
          ← Back to Courses
        </button>

        <div className="ec-topbar-title">
          <h1>Edit Course</h1>

          <p>
            Edit course details, videos and final quiz.
          </p>
        </div>

        <button
          type="button"
          className="ec-save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving
            ? "Saving..."
            : "Save Changes"}
        </button>
      </div>

      <div className="ec-grid">
        <main className="ec-main">
          {/* Course details */}
          <section className="ec-card">
            <div className="ec-section-heading">
              <span className="ec-section-number">
                1
              </span>

              <div>
                <h2>Course Details</h2>

                <p>
                  Edit title, description and thumbnail.
                </p>
              </div>
            </div>

            <div className="ec-field">
              <label htmlFor="course-title">
                Course Title
              </label>

              <input
                id="course-title"
                type="text"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="Enter course title"
              />
            </div>

            <div className="ec-field">
              <label htmlFor="course-overview">
                Description
              </label>

              <textarea
                id="course-overview"
                rows={5}
                value={overview}
                onChange={(event) =>
                  setOverview(
                    event.target.value
                  )
                }
                placeholder="Enter course description"
              />
            </div>

            <div className="ec-field">
              <label>Thumbnail</label>

              <div className="ec-thumb-area">
                {thumbnailPreview ||
                existingThumbnail ? (
                  <div className="ec-thumb-preview">
                    <img
                      src={
                        thumbnailPreview ||
                        existingThumbnail
                      }
                      alt="Course thumbnail"
                    />

                    <button
                      type="button"
                      className="ec-thumb-remove"
                      onClick={removeThumb}
                      aria-label="Remove thumbnail"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ec-thumb-upload"
                    onClick={() =>
                      thumbInputRef.current?.click()
                    }
                  >
                    + Upload Thumbnail
                  </button>
                )}

                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleThumbChange}
                />
              </div>
            </div>
          </section>

          {/* Course videos */}
          <section className="ec-card">
            <div className="ec-card-header">
              <div className="ec-section-heading">
                <span className="ec-section-number">
                  2
                </span>

                <div>
                  <h2>Course Videos</h2>

                  <p>
                    {courseVideos.length} video
                    {courseVideos.length !== 1
                      ? "s"
                      : ""}{" "}
                    • Drag or use arrows to reorder
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="ec-add-videos-btn"
                onClick={() =>
                  setShowAddVideos(
                    (previous) => !previous
                  )
                }
              >
                {showAddVideos
                  ? "Close Library"
                  : "+ Add Videos"}
              </button>
            </div>

            {courseVideos.length === 0 ? (
              <div className="ec-empty">
                <p>
                  No videos in this course yet.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setShowAddVideos(true)
                  }
                >
                  Add Videos
                </button>
              </div>
            ) : (
              <div className="ec-video-list">
                {courseVideos.map(
                  (video, index) => (
                    <div
                      key={video.id}
                      className={[
                        "ec-video-row",
                        dragIndex === index
                          ? "dragging"
                          : "",
                        dragOverIndex === index
                          ? "drag-over"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      draggable
                      onDragStart={() =>
                        handleDragStart(index)
                      }
                      onDragOver={(event) =>
                        handleDragOver(
                          event,
                          index
                        )
                      }
                      onDragEnd={handleDragEnd}
                      onDrop={() =>
                        handleDrop(index)
                      }
                    >
                      <span className="ec-video-grip">
                        ⠿
                      </span>

                      <span className="ec-video-idx">
                        {index + 1}
                      </span>

                      <div className="ec-video-thumb">
                        {video.thumbnailUrl ? (
                          <img
                            src={
                              video.thumbnailUrl
                            }
                            alt=""
                          />
                        ) : (
                          <span>
                            {(
                              video.title || "V"
                            )[0]}
                          </span>
                        )}
                      </div>

                      <div className="ec-video-info">
                        <h4>
                          {video.title ||
                            video.videoTitle ||
                            "Untitled"}
                        </h4>

                        <span>
                          {video.metadata
                            ?.organName || ""}

                          {video.metadata
                            ?.videoType
                            ? ` • ${video.metadata.videoType}`
                            : ""}

                          {video.durationSeconds
                            ? ` • ${formatDuration(
                                video.durationSeconds
                              )}`
                            : ""}
                        </span>
                      </div>

                      <div className="ec-video-actions">
                        <button
                          type="button"
                          className="ec-move-btn"
                          onClick={() =>
                            moveVideo(
                              index,
                              index - 1
                            )
                          }
                          disabled={index === 0}
                          title="Move up"
                        >
                          ↑
                        </button>

                        <button
                          type="button"
                          className="ec-move-btn"
                          onClick={() =>
                            moveVideo(
                              index,
                              index + 1
                            )
                          }
                          disabled={
                            index ===
                            courseVideos.length - 1
                          }
                          title="Move down"
                        >
                          ↓
                        </button>

                        <button
                          type="button"
                          className="ec-remove-btn"
                          onClick={() =>
                            removeVideoFromCourse(
                              video.id
                            )
                          }
                          title="Remove video"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          {/* Final course quiz */}
          <section className="ec-card ec-quiz-section">
            <div className="ec-card-header">
              <div className="ec-section-heading">
                <span className="ec-section-number">
                  3
                </span>

                <div>
                  <h2>Final Course Quiz</h2>

                  <p>
                    Edit quiz time, passing score,
                    questions, options and correct answers.
                  </p>
                </div>
              </div>
            </div>

            <div className="ec-quiz-body">
              <div className="ec-quiz-settings">
                <div className="ec-field">
                  <label htmlFor="quiz-duration">
                    Quiz Duration
                  </label>

                  <div className="ec-input-suffix">
                    <input
                      id="quiz-duration"
                      type="number"
                      min="1"
                      max="300"
                      value={quizDuration}
                      onChange={(event) =>
                        setQuizDuration(
                          event.target.value
                        )
                      }
                    />

                    <span>minutes</span>
                  </div>
                </div>

                <div className="ec-field">
                  <label htmlFor="passing-percentage">
                    Passing Percentage
                  </label>

                  <div className="ec-input-suffix">
                    <input
                      id="passing-percentage"
                      type="number"
                      min="1"
                      max="100"
                      value={passingPercentage}
                      onChange={(event) =>
                        setPassingPercentage(
                          event.target.value
                        )
                      }
                    />

                    <span>%</span>
                  </div>
                </div>

                <div className="ec-quiz-summary">
                  <span>
                    Questions

                    <strong>
                      {quizQuestions.length}
                    </strong>
                  </span>

                  <span>
                    Total Marks

                    <strong>
                      {totalQuizMarks}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="ec-quiz-toolbar">
                <div>
                  <h3>Quiz Questions</h3>

                  <p>
                    Select the radio button beside the
                    correct answer.
                  </p>
                </div>

                <button
                  type="button"
                  className="ec-add-question-btn"
                  onClick={addQuizQuestion}
                >
                  + Add Question
                </button>
              </div>

              {quizQuestions.length === 0 ? (
                <div className="ec-empty ec-quiz-empty">
                  <p>
                    No quiz questions have been added.
                  </p>

                  <button
                    type="button"
                    onClick={addQuizQuestion}
                  >
                    Add First Question
                  </button>
                </div>
              ) : (
                <div className="ec-question-list">
                  {quizQuestions.map(
                    (question, questionIndex) => (
                      <article
                        className="ec-question-card"
                        key={question.id}
                      >
                        <div className="ec-question-header">
                          <div>
                            <span className="ec-question-number">
                              Question{" "}
                              {questionIndex + 1}
                            </span>

                            <span className="ec-question-marks-label">
                              {question.marks || 1} mark
                              {Number(
                                question.marks
                              ) !== 1
                                ? "s"
                                : ""}
                            </span>
                          </div>

                          <div className="ec-question-actions">
                            <button
                              type="button"
                              onClick={() =>
                                moveQuizQuestion(
                                  questionIndex,
                                  questionIndex - 1
                                )
                              }
                              disabled={
                                questionIndex === 0
                              }
                              title="Move question up"
                            >
                              ↑
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                moveQuizQuestion(
                                  questionIndex,
                                  questionIndex + 1
                                )
                              }
                              disabled={
                                questionIndex ===
                                quizQuestions.length -
                                  1
                              }
                              title="Move question down"
                            >
                              ↓
                            </button>

                            <button
                              type="button"
                              className="ec-delete-question"
                              onClick={() =>
                                removeQuizQuestion(
                                  question.id
                                )
                              }
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="ec-field">
                          <label>
                            Question Text
                          </label>

                          <textarea
                            rows={3}
                            value={
                              question.question
                            }
                            onChange={(event) =>
                              updateQuizQuestion(
                                question.id,
                                "question",
                                event.target.value
                              )
                            }
                            placeholder="Enter the quiz question"
                          />
                        </div>

                        <div className="ec-question-options">
                          <div className="ec-options-heading">
                            <label>
                              Answer Options
                            </label>

                            <button
                              type="button"
                              onClick={() =>
                                addOptionToQuestion(
                                  question.id
                                )
                              }
                            >
                              + Add Option
                            </button>
                          </div>

                          {question.options.map(
                            (
                              option,
                              optionIndex
                            ) => (
                              <div
                                className={[
                                  "ec-option-row",
                                  Number(
                                    question.correctAnswer
                                  ) === optionIndex
                                    ? "is-correct"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                key={`${question.id}-option-${optionIndex}`}
                              >
                                <label className="ec-correct-radio">
                                  <input
                                    type="radio"
                                    name={`correct-${question.id}`}
                                    checked={
                                      Number(
                                        question.correctAnswer
                                      ) ===
                                      optionIndex
                                    }
                                    onChange={() =>
                                      updateQuizQuestion(
                                        question.id,
                                        "correctAnswer",
                                        optionIndex
                                      )
                                    }
                                  />

                                  <span>
                                    {String.fromCharCode(
                                      65 +
                                        optionIndex
                                    )}
                                  </span>
                                </label>

                                <input
                                  type="text"
                                  value={option}
                                  onChange={(event) =>
                                    updateQuizOption(
                                      question.id,
                                      optionIndex,
                                      event.target.value
                                    )
                                  }
                                  placeholder={`Option ${String.fromCharCode(
                                    65 + optionIndex
                                  )}`}
                                />

                                <button
                                  type="button"
                                  className="ec-remove-option"
                                  onClick={() =>
                                    removeOptionFromQuestion(
                                      question.id,
                                      optionIndex
                                    )
                                  }
                                  disabled={
                                    question.options
                                      .length <= 2
                                  }
                                  title="Remove option"
                                >
                                  ✕
                                </button>
                              </div>
                            )
                          )}
                        </div>

                        <div className="ec-question-bottom-grid">
                          <div className="ec-field">
                            <label>Marks</label>

                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={
                                question.marks
                              }
                              onChange={(event) =>
                                updateQuizQuestion(
                                  question.id,
                                  "marks",
                                  event.target.value
                                )
                              }
                            />
                          </div>

                          <div className="ec-field">
                            <label>
                              Explanation

                              <span className="ec-optional">
                                Optional
                              </span>
                            </label>

                            <input
                              type="text"
                              value={
                                question.explanation
                              }
                              onChange={(event) =>
                                updateQuizQuestion(
                                  question.id,
                                  "explanation",
                                  event.target.value
                                )
                              }
                              placeholder="Explain the correct answer"
                            />
                          </div>
                        </div>
                      </article>
                    )
                  )}
                </div>
              )}

              <button
                type="button"
                className="ec-add-question-bottom"
                onClick={addQuizQuestion}
              >
                + Add Another Question
              </button>
            </div>
          </section>
        </main>

        {/* Video library sidebar */}
        {showAddVideos && (
          <aside className="ec-sidebar">
            <div className="ec-card ec-add-panel">
              <div className="ec-sidebar-heading">
                <div>
                  <h2>Video Library</h2>

                  <p>
                    Select videos to add to this course.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowAddVideos(false)
                  }
                  className="ec-sidebar-close"
                >
                  ×
                </button>
              </div>

              <input
                type="text"
                placeholder="Search videos..."
                value={videoSearch}
                onChange={(event) =>
                  setVideoSearch(
                    event.target.value
                  )
                }
                className="ec-search"
              />

              <select
                value={filterType}
                onChange={(event) =>
                  setFilterType(
                    event.target.value
                  )
                }
                className="ec-filter"
              >
                <option value="">
                  All Types
                </option>

                <option value="Anatomy">
                  Anatomy
                </option>

                <option value="Therapy">
                  Therapy
                </option>

                <option value="Product">
                  Product
                </option>

                <option value="Other">
                  Other
                </option>
              </select>

              <p className="ec-lib-count">
                {filteredAvailable.length} available
              </p>

              <div className="ec-lib-list">
                {filteredAvailable.map((video) => (
                  <button
                    type="button"
                    key={video.id}
                    className="ec-lib-card"
                    onClick={() =>
                      addVideoToCourse(video)
                    }
                  >
                    <div className="ec-lib-thumb">
                      {video.thumbnailUrl ? (
                        <img
                          src={
                            video.thumbnailUrl
                          }
                          alt=""
                        />
                      ) : (
                        <span>
                          {(
                            video.title || "V"
                          )[0]}
                        </span>
                      )}
                    </div>

                    <div className="ec-lib-info">
                      <h4>
                        {video.title ||
                          "Untitled"}
                      </h4>

                      <span>
                        {video.metadata
                          ?.organName || ""}

                        {video.metadata
                          ?.videoType
                          ? ` • ${video.metadata.videoType}`
                          : ""}
                      </span>
                    </div>

                    <span className="ec-lib-add">
                      +
                    </span>
                  </button>
                ))}

                {filteredAvailable.length === 0 && (
                  <p className="ec-lib-empty">
                    No more videos available.
                  </p>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export default EditCourse;