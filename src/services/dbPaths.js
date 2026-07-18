// ─── Master Data Paths ───
export const usersRoot = "users";
export const userPath = (uid) => `users/${uid}`;

export const coursesRoot = "courses";
export const coursePath = (courseId) => `courses/${courseId}`;

export const departmentsRoot = "departments";
export const departmentPath = (deptId) => `departments/${deptId}`;

export const videosRoot = "videos";
export const videoPath = (videoId) => `videos/${videoId}`;

export const videoLibraryRoot = "videoLibrary";
export const videoLibraryItemPath = (videoId) => `videoLibrary/${videoId}`;

export const courseVideosRoot = "courseVideos";
export const courseVideosForCoursePath = (courseId) => `courseVideos/${courseId}`;
export const courseVideoMappingPath = (courseId, videoId) => `courseVideos/${courseId}/${videoId}`;

export const questionsRoot = "questions";
export const questionsForCoursePath = (courseId) => `questions/${courseId}`;
export const questionPath = (courseId, questionId) => `questions/${courseId}/${questionId}`;

export const videoQuizzesRoot = "videoQuizzes";
export const videoQuizzesForVideoPath = (videoId) => `videoQuizzes/${videoId}`;
export const videoQuizQuestionPath = (videoId, questionId) => `videoQuizzes/${videoId}/${questionId}`;

export const masterDesignationsRoot = "master/designations";
export const designationPath = (id) => `master/designations/${id}`;

// ─── User-Specific Data Paths (NEW normalized) ───
export const userAssignmentsRoot = "userAssignments";
export const userAssignmentsPath = (uid) => `userAssignments/${uid}`;
export const userAssignmentPath = (uid, courseId) => `userAssignments/${uid}/${courseId}`;

export const courseProgressRoot = "courseProgress";
export const courseProgressPath = (uid) => `courseProgress/${uid}`;
export const courseProgressForCoursePath = (uid, courseId) => `courseProgress/${uid}/${courseId}`;

export const videoProgressRoot = "videoProgress";
export const videoProgressPath = (uid) => `videoProgress/${uid}`;
export const videoProgressForCoursePath = (uid, courseId) => `videoProgress/${uid}/${courseId}`;
export const videoProgressForVideoPath = (uid, courseId, videoId) => `videoProgress/${uid}/${courseId}/${videoId}`;

export const quizAttemptsRoot = "quizAttempts";
export const quizAttemptsPath = (uid) => `quizAttempts/${uid}`;
export const quizAttemptsForCoursePath = (uid, courseId) => `quizAttempts/${uid}/${courseId}`;
export const quizAttemptPath = (uid, courseId, quizId) => `quizAttempts/${uid}/${courseId}/${quizId}`;

export const certificatesRoot = "certificates";
export const certificatesPath = (uid) => `certificates/${uid}`;
export const certificatePath = (uid, courseId) => `certificates/${uid}/${courseId}`;

export const learningActivityRoot = "learningActivity";
export const learningActivityPath = (uid) => `learningActivity/${uid}`;
export const learningActivityDayPath = (uid, dayKey) => `learningActivity/${uid}/${dayKey}`;
export const learningActivityVideoPath = (uid, dayKey, videoId) => `learningActivity/${uid}/${dayKey}/${videoId}`;

// ─── Legacy Paths (kept for migration reads) ───
export const legacyProgressPath = (uid) => `progress/${uid}`;
export const legacyProgressVideoPath = (uid, videoId) => `progress/${uid}/${videoId}`;
export const legacyCompletedCoursesPath = (uid) => `completedCourses/${uid}`;
export const legacyCompletedCoursePath = (uid, courseId) => `completedCourses/${uid}/${courseId}`;
export const legacyAttemptsPath = (uid) => `attempts/${uid}`;
export const legacyAttemptPath = (uid, attemptId) => `attempts/${uid}/${attemptId}`;
export const legacyResultsPath = (uid) => `results/${uid}`;
export const legacyVideoQuizAttemptsPath = (uid) => `videoQuizAttempts/${uid}`;
export const legacyVideoQuizAttemptPath = (uid, attemptId) => `videoQuizAttempts/${uid}/${attemptId}`;
