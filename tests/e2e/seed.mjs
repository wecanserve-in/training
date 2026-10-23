/**
 * Sample data for the end-to-end tests, loaded into the Firebase emulators.
 */

const PROJECT = "lms-portal-final";
const DB_NS = "lms-portal-final-default-rtdb";
const DB = "http://127.0.0.1:9000";
const AUTH = "http://127.0.0.1:9099";

export const PASSWORD = "Test@12345";

export const ACCOUNTS = {
  superAdmin: { email: "super@zuvius.test", name: "Sunita Super", role: "superAdmin" },
  admin: { email: "admin@zuvius.test", name: "Arjun Admin", role: "admin" },
  deptAdmin: {
    email: "dept@zuvius.test",
    name: "Deepa Dept",
    role: "departmentAdmin",
    department: "Sales",
    departmentId: "dSales",
    departmentType: "Field",
  },
  alice: {
    email: "alice@zuvius.test",
    name: "Alice Learner",
    role: "user",
    department: "Sales",
    departmentId: "dSales",
    designation: "Medical Representative",
    zone: "West",
    state: "Gujarat",
  },
  bob: {
    email: "bob@zuvius.test",
    name: "Bob Learner",
    role: "user",
    department: "Sales",
    designation: "Medical Representative",
    zone: "North",
    state: "Delhi",
  },
};

const dbPut = async (path, value) => {
  const response = await fetch(`${DB}/${path}.json?ns=${DB_NS}`, {
    method: "PUT",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error(`Seeding ${path} failed: ${await response.text()}`);
};

export const dbGet = async (path) => {
  const response = await fetch(`${DB}/${path}.json?ns=${DB_NS}`, {
    headers: { Authorization: "Bearer owner" },
  });
  return response.json();
};

export const dbSet = dbPut;

const createAccount = async (email) => {
  const response = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
    }
  );
  const data = await response.json();
  if (!data.localId) throw new Error(`Could not create ${email}: ${JSON.stringify(data)}`);
  return data.localId;
};

/** Wipes the emulators and loads a small, realistic portal. Returns { uids }. */
export const seed = async () => {
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
  await dbPut("", null);

  const uids = {};
  for (const [key, account] of Object.entries(ACCOUNTS)) {
    uids[key] = await createAccount(account.email);
  }

  const now = new Date().toISOString();
  const users = Object.fromEntries(
    Object.entries(ACCOUNTS).map(([key, account]) => [
      uids[key],
      { uid: uids[key], status: "active", createdAt: now, ...account },
    ])
  );

  const video = (id, title) => ({
    title,
    description: `${title} lesson`,
    department: "Sales",
    departmentId: "dSales",
    videoUrl: `https://files.example.com/${id}.mp4`,
    thumbnailUrl: "",
    durationSeconds: 60,
    createdBy: uids.deptAdmin,
    status: "active",
    createdAt: now,
  });

  await dbPut("", {
    users,
    departments: {
      dSales: {
        departmentName: "Sales",
        departmentType: "Field",
        departmentAdminId: uids.deptAdmin,
        departmentAdminName: ACCOUNTS.deptAdmin.name,
        createdAt: now,
      },
    },
    master: { designations: { d1: { name: "Medical Representative", createdAt: now } } },
    videoLibrary: {
      v1: video("v1", "Product Basics"),
      v2: video("v2", "Handling Objections"),
      v3: video("v3", "Compliance 101"),
    },
    courses: {
      c1: {
        title: "Sales Fundamentals",
        description: "Core skills for new representatives",
        department: "Sales",
        departmentId: "dSales",
        passingScore: 70,
        testDuration: 300,
        totalVideos: 2,
        totalQuestions: 3,
        status: "active",
        createdBy: uids.deptAdmin,
        createdAt: now,
      },
      c2: {
        title: "Compliance Essentials",
        description: "Rules every employee must know",
        department: "Sales",
        departmentId: "dSales",
        passingScore: 60,
        testDuration: 300,
        totalVideos: 1,
        status: "active",
        createdBy: uids.deptAdmin,
        createdAt: now,
      },
    },
    courseVideos: {
      c1: {
        v1: { videoId: "v1", title: "Product Basics", order: 1, courseId: "c1" },
        v2: { videoId: "v2", title: "Handling Objections", order: 2, courseId: "c1" },
      },
      c2: { v3: { videoId: "v3", title: "Compliance 101", order: 1, courseId: "c2" } },
    },
    questions: {
      c1: {
        q1: { id: "q1", question: "What should you do first in a sales call?", options: ["Listen", "Leave", "Argue", "Sleep"], correctOptionIndex: 0, order: 1 },
        q2: { id: "q2", question: "Objections are...", options: ["Bad", "Opportunities", "Ignored", "Rare"], correctOptionIndex: 1, order: 2 },
        q3: { id: "q3", question: "Product knowledge matters?", options: ["Yes", "No"], correctOptionIndex: 0, order: 3 },
      },
    },
    userAssignments: {
      [uids.alice]: {
        c1: { courseId: "c1", assigned: true, courseTitle: "Sales Fundamentals", assignedBy: uids.deptAdmin, assignedAt: now, status: "assigned" },
        c2: { courseId: "c2", assigned: true, courseTitle: "Compliance Essentials", assignedBy: uids.deptAdmin, assignedAt: now, status: "assigned" },
      },
      [uids.bob]: {
        c1: { courseId: "c1", assigned: true, courseTitle: "Sales Fundamentals", assignedBy: uids.admin, assignedAt: now, status: "assigned" },
      },
    },
    // Alice already finished Compliance Essentials (has a certificate).
    videoProgress: {
      [uids.alice]: { c2: { v3: { videoId: "v3", courseId: "c2", completed: true, watchedPercent: 100, updatedAt: now } } },
    },
    courseProgress: {
      [uids.alice]: {
        c2: {
          courseId: "c2", progressPercentage: 100, completed: true, completedAt: now,
          courseTestCompleted: true, courseTestPassed: true, score: 100, percentage: 100,
          finalQuizAttemptId: "final_c2_1", legacyAttemptId: `${uids.alice}_c2_1`,
        },
      },
    },
    completedCourses: {
      [uids.alice]: {
        c2: { courseId: "c2", courseTitle: "Compliance Essentials", passed: true, score: 100, percentage: 100, correct: 0, total: 0, attemptId: `${uids.alice}_c2_1`, quizId: "final_c2_1", completedAt: now },
      },
    },
    quizAttempts: {
      [uids.alice]: {
        c2: { final_c2_1: { quizId: "final_c2_1", quizType: "final", userId: uids.alice, courseId: "c2", courseTitle: "Compliance Essentials", score: 100, percentage: 100, passed: true, totalMarks: 0, correct: 0, legacyAttemptId: `${uids.alice}_c2_1`, attemptedAt: now } },
      },
    },
    attempts: {
      [uids.alice]: {
        [`${uids.alice}_c2_1`]: { userId: uids.alice, courseId: "c2", courseTitle: "Compliance Essentials", score: 100, percentage: 100, total: 0, correct: 0, passed: true, quizId: "final_c2_1", submittedAt: now },
      },
    },
    notifications: {
      [uids.alice]: {
        n1: { notificationId: "n1", type: "course_assigned", courseId: "c1", courseTitle: "Sales Fundamentals", title: "New course", message: "Sales Fundamentals was assigned to you", read: false, createdAt: now },
      },
    },
    resources: {
      r1: { title: "Product brochure", description: "PDF", fileUrl: "https://files.example.com/brochure.pdf", fileName: "brochure.pdf", fileType: "pdf", fileSize: 1024, uploadedBy: uids.admin, uploadedByName: "Arjun Admin", uploadedByRole: "admin", createdAt: now },
    },
    courseDiscussions: {
      c1: {
        channels: {
          _general: {
            channelId: "_general", courseId: "c1", lastMessage: "Welcome!", updatedAt: now,
            messages: { m1: { messageId: "m1", courseId: "c1", channelId: "_general", senderId: uids.deptAdmin, senderName: "Deepa Dept", senderRole: "departmentAdmin", message: "Welcome!", createdAt: now } },
          },
        },
      },
    },
  });

  return { uids };
};
