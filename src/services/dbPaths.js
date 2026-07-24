// ============================================================
// MASTER DATA PATHS
// ============================================================

export const usersRoot = "users";

export const userPath = (uid) =>
  `users/${uid}`;


export const coursesRoot = "courses";

export const coursePath = (courseId) =>
  `courses/${courseId}`;


export const departmentsRoot = "departments";

export const departmentPath = (departmentId) =>
  `departments/${departmentId}`;


export const videosRoot = "videos";

export const videoPath = (videoId) =>
  `videos/${videoId}`;


export const videoLibraryRoot = "videoLibrary";

export const videoLibraryItemPath = (videoId) =>
  `videoLibrary/${videoId}`;


// ============================================================
// COURSE VIDEO MAPPING PATHS
// ============================================================

export const courseVideosRoot = "courseVideos";

export const courseVideosForCoursePath = (courseId) =>
  `courseVideos/${courseId}`;

export const courseVideoMappingPath = (
  courseId,
  mappingId
) =>
  `courseVideos/${courseId}/${mappingId}`;


// ============================================================
// COURSE FINAL QUIZ QUESTIONS
// ============================================================

export const questionsRoot = "questions";

export const questionsForCoursePath = (courseId) =>
  `questions/${courseId}`;

export const questionPath = (
  courseId,
  questionId
) =>
  `questions/${courseId}/${questionId}`;


// ============================================================
// VIDEO PRACTICE QUIZ QUESTIONS
// ============================================================

export const videoQuizzesRoot = "videoQuizzes";

/**
 * Legacy/global video quiz structure:
 *
 * videoQuizzes/{videoId}/{questionId}
 */
export const videoQuizzesForVideoPath = (videoId) =>
  `videoQuizzes/${videoId}`;

export const videoQuizQuestionPath = (
  videoId,
  questionId
) =>
  `videoQuizzes/${videoId}/${questionId}`;

/**
 * Course-specific video quiz structure:
 *
 * videoQuizzes/{courseId}/{videoId}/{questionId}
 *
 * Prefer this structure when the same video may have
 * a different practice quiz in different courses.
 */
export const videoQuizzesForCourseVideoPath = (
  courseId,
  videoId
) =>
  `videoQuizzes/${courseId}/${videoId}`;

export const courseVideoQuizQuestionPath = (
  courseId,
  videoId,
  questionId
) =>
  `videoQuizzes/${courseId}/${videoId}/${questionId}`;


// ============================================================
// MASTER DESIGNATIONS
// ============================================================

export const masterDesignationsRoot =
  "master/designations";

export const designationPath = (designationId) =>
  `master/designations/${designationId}`;


// ============================================================
// USER COURSE ASSIGNMENTS
// ============================================================

export const userAssignmentsRoot =
  "userAssignments";

export const userAssignmentsPath = (uid) =>
  `userAssignments/${uid}`;

export const userAssignmentPath = (
  uid,
  courseId
) =>
  `userAssignments/${uid}/${courseId}`;


// ============================================================
// COURSE PROGRESS
// ============================================================

/**
 * Structure:
 *
 * courseProgress/{uid}/{courseId}
 */
export const courseProgressRoot =
  "courseProgress";

export const courseProgressPath = (uid) =>
  `courseProgress/${uid}`;

export const courseProgressForCoursePath = (
  uid,
  courseId
) =>
  `courseProgress/${uid}/${courseId}`;


// ============================================================
// VIDEO PROGRESS
// ============================================================

/**
 * Correct normalized structure:
 *
 * videoProgress/{uid}/{courseId}/{videoId}
 *
 * This keeps progress separate when the same video
 * is used in multiple courses.
 */
export const videoProgressRoot =
  "videoProgress";

export const videoProgressPath = (uid) =>
  `videoProgress/${uid}`;

export const videoProgressForCoursePath = (
  uid,
  courseId
) =>
  `videoProgress/${uid}/${courseId}`;

export const videoProgressForVideoPath = (
  uid,
  courseId,
  videoId
) =>
  `videoProgress/${uid}/${courseId}/${videoId}`;


// ============================================================
// QUIZ ATTEMPTS
// ============================================================

/**
 * Structure:
 *
 * quizAttempts/{uid}/{courseId}/{attemptId}
 *
 * Practice quiz attempts and final course test attempts
 * may both be stored here using quizType:
 *
 * quizType: "practice"
 * quizType: "final"
 */
export const quizAttemptsRoot =
  "quizAttempts";

export const quizAttemptsPath = (uid) =>
  `quizAttempts/${uid}`;

export const quizAttemptsForCoursePath = (
  uid,
  courseId
) =>
  `quizAttempts/${uid}/${courseId}`;

export const quizAttemptPath = (
  uid,
  courseId,
  attemptId
) =>
  `quizAttempts/${uid}/${courseId}/${attemptId}`;


// ============================================================
// CERTIFICATES
// ============================================================

/**
 * Structure:
 *
 * certificates/{uid}/{courseId}
 */
export const certificatesRoot =
  "certificates";

export const certificatesPath = (uid) =>
  `certificates/${uid}`;

export const certificatePath = (
  uid,
  courseId
) =>
  `certificates/${uid}/${courseId}`;


// ============================================================
// LEARNING ACTIVITY
// ============================================================

/**
 * Correct normalized structure:
 *
 * learningActivity/{uid}/{dayKey}/{courseId}/{videoId}
 *
 * Including courseId prevents the same reused video's
 * watch time from merging across multiple courses.
 */
export const learningActivityRoot =
  "learningActivity";

export const learningActivityPath = (uid) =>
  `learningActivity/${uid}`;

export const learningActivityDayPath = (
  uid,
  dayKey
) =>
  `learningActivity/${uid}/${dayKey}`;

export const learningActivityCoursePath = (
  uid,
  dayKey,
  courseId
) =>
  `learningActivity/${uid}/${dayKey}/${courseId}`;

export const learningActivityVideoPath = (
  uid,
  dayKey,
  courseId,
  videoId
) =>
  `learningActivity/${uid}/${dayKey}/${courseId}/${videoId}`;


// ============================================================
// DOUBT CHAT PATHS
// ============================================================

export const doubtThreadsRoot =
  "doubtThreads";

export const doubtThreadPath = (threadId) =>
  `doubtThreads/${threadId}`;


export const doubtMessagesRoot =
  "doubtMessages";

export const doubtMessagesForThreadPath = (
  threadId
) =>
  `doubtMessages/${threadId}`;

export const doubtMessagePath = (
  threadId,
  messageId
) =>
  `doubtMessages/${threadId}/${messageId}`;


// ============================================================
// NOTIFICATION PATHS
// ============================================================

export const notificationsRoot =
  "notifications";

export const notificationsForUserPath = (uid) =>
  `notifications/${uid}`;

export const notificationPath = (
  uid,
  notificationId
) =>
  `notifications/${uid}/${notificationId}`;


// ============================================================
// COURSE CONTENT UPDATES (tracks new video additions)
// ============================================================

/**
 * Structure:
 *
 * courseContentUpdates/{courseId}
 * {
 *   lastUpdatedAt: "ISO string",
 *   updatedBy: "uid",
 *   newVideoIds: ["videoId1", "videoId2"]
 * }
 */
export const courseContentUpdatesRoot = "courseContentUpdates";

export const courseContentUpdatePath = (courseId) =>
  `courseContentUpdates/${courseId}`;


// ============================================================
// LEGACY PATHS
// ============================================================

/**
 * These helpers are retained only so old data can be migrated
 * or inspected.
 *
 * New code should not write video progress to these paths.
 */

// Old global video progress:
//
// progress/{uid}/{videoId}
export const legacyProgressPath = (uid) =>
  `progress/${uid}`;

export const legacyProgressVideoPath = (
  uid,
  videoId
) =>
  `progress/${uid}/${videoId}`;


// Old completed-course records:
//
// completedCourses/{uid}/{courseId}
export const legacyCompletedCoursesPath = (uid) =>
  `completedCourses/${uid}`;

export const legacyCompletedCoursePath = (
  uid,
  courseId
) =>
  `completedCourses/${uid}/${courseId}`;


// Old final test attempts:
//
// attempts/{uid}/{attemptId}
export const legacyAttemptsPath = (uid) =>
  `attempts/${uid}`;

export const legacyAttemptPath = (
  uid,
  attemptId
) =>
  `attempts/${uid}/${attemptId}`;


// Old result records:
//
// results/{uid}/{resultId}
export const legacyResultsPath = (uid) =>
  `results/${uid}`;

export const legacyResultPath = (
  uid,
  resultId
) =>
  `results/${uid}/${resultId}`;


// Old video practice quiz attempts:
//
// videoQuizAttempts/{uid}/{attemptId}
export const legacyVideoQuizAttemptsPath = (uid) =>
  `videoQuizAttempts/${uid}`;

export const legacyVideoQuizAttemptPath = (
  uid,
  attemptId
) =>
  `videoQuizAttempts/${uid}/${attemptId}`;