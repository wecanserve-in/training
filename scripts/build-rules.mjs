/**
 * Generates database.rules.json.
 *
 *   node scripts/build-rules.mjs
 *
 * Firebase rules have no functions, so the role checks are written once here
 * and pasted into every rule. Edit this file, not database.rules.json.
 *
 * Roles are read from users/{uid}/role and compared case-insensitively,
 * so "superAdmin", "Super Admin" and "super_admin" all count.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const role = "root.child('users').child(auth.uid).child('role').val().toLowerCase()";

const SIGNED_IN = "auth != null";
const ADMIN = `(auth != null && ${role}.matches(/^ *(super[ _-]*admin|admin) *$/))`;
const STAFF = `(auth != null && ${role}.matches(/^ *(super[ _-]*admin|admin|dep(artmen)?t[ _-]*admin) *$/))`;
const SELF = (uidVar = "$uid") => `(auth != null && auth.uid === ${uidVar})`;

const or = (...parts) => parts.join(" || ");

/** Fields only staff (or the server) may change. Deleting is allowed so whole-node cleanups still work. */
const locked = (fields, allowed = STAFF) =>
  Object.fromEntries(
    fields.map((field) => [
      field,
      { ".validate": or(allowed, "newData.val() === data.val()") },
    ])
  );

/** Shared course content: everyone signed in reads, staff write. */
const content = (key = "$id") => ({
  ".read": SIGNED_IN,
  [key]: { ".write": STAFF },
});

/** Staff-only content (contains quiz answers). */
const staffOnly = () => ({
  ".read": STAFF,
  ".write": STAFF,
});

/** Per-user records that only staff or the server write (results, certificates). */
const resultsRoot = () => ({
  ".read": SIGNED_IN,
  $uid: { ".write": STAFF },
});

/** Per-user records the user writes about themselves (progress, activity). */
const selfWritable = (extra = {}) => ({
  ".read": SIGNED_IN,
  $uid: { ".write": or(STAFF, SELF()), ...extra },
});

const rules = {
  rules: {
    users: {
      ".read": SIGNED_IN,
      ".indexOn": ["email", "role", "departmentId"],
      $uid: {
        // Admins manage everyone. Users may edit their own profile but not delete it.
        ".write": or(ADMIN, `(${SELF()} && newData.exists())`),
        ...locked([
          "role",
          "status",
          "email",
          "uid",
          "department",
          "departmentId",
          "departmentType",
          "designation",
          "seniority",
          "zone",
          "state",
          "cityArea",
        ], ADMIN),
      },
    },

    departments: { ".read": SIGNED_IN, $deptId: { ".write": ADMIN } },
    master: { ".read": SIGNED_IN, ".write": ADMIN },

    courses: {
      ".read": SIGNED_IN,
      ".indexOn": ["status", "departmentId", "createdBy"],
      $courseId: { ".write": STAFF },
    },
    courseVideos: content("$courseId"),
    videos: content("$videoId"),
    videoLibrary: content("$videoId"),
    videoQuizzes: content("$id"),
    courseContentUpdates: content("$courseId"),
    resources: content("$resourceId"),

    // Final test questions hold the answers. Users get them through /api/quiz.php without answers.
    questions: staffOnly(),
    courseQuizzes: staffOnly(),
    courseQuiz: staffOnly(),
    quizzes: staffOnly(),
    courseTests: staffOnly(),

    userAssignments: { ".read": SIGNED_IN, $uid: { ".write": STAFF } },

    courseProgress: selfWritable({
      $courseId: locked([
        "courseTestPassed",
        "courseTestCompleted",
        "passed",
        "score",
        "percentage",
        "correct",
        "totalMarks",
        "finalQuizAttemptId",
        "legacyAttemptId",
        "attemptId",
      ]),
    }),
    videoProgress: selfWritable(),
    learningActivity: selfWritable(),

    quizAttempts: {
      ".read": SIGNED_IN,
      $uid: {
        ".write": STAFF,
        $courseId: {
          // Users save their own video practice quizzes. Final tests are graded by /api/submit-quiz.php.
          $attemptId: {
            ".write": `${SELF()} && $attemptId.beginsWith('practice_')`,
            ".validate": `!$attemptId.beginsWith('practice_') || newData.child('quizType').val() === 'practice'`,
          },
        },
      },
    },

    attempts: resultsRoot(),
    completedCourses: resultsRoot(),
    results: resultsRoot(),
    certificates: resultsRoot(),
    progress: resultsRoot(),
    videoQuizAttempts: resultsRoot(),

    notifications: {
      $uid: {
        ".read": SELF(),
        ".write": or(SELF(), STAFF),
        $notificationId: {
          // Anyone signed in can send a new notification (discussion replies, assignments).
          ".write": `${SIGNED_IN} && !data.exists() && newData.exists()`,
          ".validate": "newData.child('title').isString() && newData.child('message').isString()",
        },
      },
    },

    courseDiscussions: {
      ".read": SIGNED_IN,
      $courseId: {
        ".write": STAFF,
        channels: {
          $channelId: {
            messages: {
              $messageId: {
                // Post your own new messages only.
                ".write": `${SIGNED_IN} && !data.exists() && newData.child('senderId').val() === auth.uid`,
                ".validate": "newData.child('message').isString() && newData.child('message').val().length <= 5000",
              },
            },
            // Channel summary fields (lastMessage, updatedAt, ...) are plain values anyone signed in may update.
            $field: {
              ".write": `${SIGNED_IN} && $field !== 'messages'`,
              ".validate": "!newData.hasChildren()",
            },
          },
        },
      },
    },

    // Not used by the app any more.
    doubtThreads: staffOnly(),
    doubtMessages: staffOnly(),
  },
};

const output = fileURLToPath(new URL("../database.rules.json", import.meta.url));
writeFileSync(output, JSON.stringify(rules, null, 2) + "\n");
console.log(`Wrote ${output}`);
