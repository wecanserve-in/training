/**
 * Database security rules tests.
 * Run with: npm run test:rules   (starts the Firebase emulator)
 */

import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { get, ref, remove, runTransaction, set, update } from "firebase/database";

let env;

const USERS = {
  superAdmin: { role: "superAdmin", name: "Super" },
  superAdminSpaced: { role: "Super Admin", name: "Super 2" },
  admin: { role: "admin", name: "Admin" },
  deptAdmin: { role: "departmentAdmin", name: "Dept", departmentId: "d1", department: "Sales" },
  alice: { role: "user", name: "Alice", department: "Sales", departmentId: "d1" },
  bob: { role: "user", name: "Bob", department: "Sales" },
};

const db = (uid) => env.authenticatedContext(uid).database();
const anon = () => env.unauthenticatedContext().database();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "lms-portal-final",
    database: {
      rules: readFileSync(new URL("../database.rules.json", import.meta.url), "utf8"),
      host: "127.0.0.1",
      port: 9000,
    },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (context) => {
    const admin = context.database();
    await set(ref(admin), {
      users: USERS,
      courses: { c1: { title: "Safety", passingScore: 70 } },
      questions: { c1: { q1: { question: "2+2?", options: ["3", "4"], correctOptionIndex: 1 } } },
      courseProgress: { alice: { c1: { progressPercentage: 50, courseTestPassed: false } } },
      notifications: { bob: { n1: { title: "Hi", message: "Old", read: false } } },
      courseDiscussions: {
        c1: { channels: { _general: { messages: { m1: { senderId: "bob", message: "hello" } } } } },
      },
    });
  });
});

describe("users", () => {
  it("signed-out visitors cannot read anything", async () => {
    await assertFails(get(ref(anon(), "users")));
    await assertFails(get(ref(anon(), "courses")));
  });

  it("a user can edit their own profile details", async () => {
    await assertSucceeds(
      update(ref(db("alice"), "users/alice"), { name: "Alice B", phone: "123", photoURL: "x" })
    );
  });

  it("a user cannot make themselves an admin", async () => {
    await assertFails(update(ref(db("alice"), "users/alice"), { role: "superAdmin" }));
    await assertFails(set(ref(db("alice"), "users/alice/role"), "admin"));
  });

  it("a user cannot move themselves to another department", async () => {
    await assertFails(update(ref(db("alice"), "users/alice"), { departmentId: "d9" }));
  });

  it("a user cannot delete their own profile or edit someone else's", async () => {
    await assertFails(remove(ref(db("alice"), "users/alice")));
    await assertFails(update(ref(db("alice"), "users/bob"), { name: "x" }));
  });

  it("a brand-new sign-up cannot give itself a role", async () => {
    await assertFails(set(ref(db("stranger"), "users/stranger"), { name: "S", role: "admin" }));
  });

  it("a department admin cannot promote themselves", async () => {
    await assertFails(update(ref(db("deptAdmin"), "users/deptAdmin"), { role: "superAdmin" }));
    await assertFails(update(ref(db("deptAdmin"), "users/alice"), { role: "admin" }));
  });

  it("admins manage users, including roles", async () => {
    await assertSucceeds(update(ref(db("admin"), "users/bob"), { role: "departmentAdmin", departmentId: "d1" }));
    await assertSucceeds(set(ref(db("superAdmin"), "users/newUser"), { name: "N", role: "user", email: "n@x.in" }));
    await assertSucceeds(update(ref(db("superAdminSpaced"), "users/bob"), { name: "Bobby" }));
    await assertSucceeds(remove(ref(db("superAdmin"), "users/bob")));
  });
});

describe("course content", () => {
  it("everyone signed in can read courses", async () => {
    await assertSucceeds(get(ref(db("alice"), "courses/c1")));
  });

  it("users cannot create, edit or delete courses", async () => {
    await assertFails(update(ref(db("alice"), "courses/c1"), { title: "Hacked" }));
    await assertFails(remove(ref(db("alice"), "courses/c1")));
    await assertFails(set(ref(db("alice"), "videoLibrary/v1"), { title: "x" }));
  });

  it("department admins and admins manage courses", async () => {
    await assertSucceeds(set(ref(db("deptAdmin"), "courses/c2"), { title: "New" }));
    await assertSucceeds(update(ref(db("admin"), "courses/c1"), { title: "Safety 2" }));
    await assertSucceeds(set(ref(db("deptAdmin"), "courseVideos/c1/v1"), { videoId: "v1", order: 1 }));
  });

  it("quiz answers are hidden from users", async () => {
    await assertFails(get(ref(db("alice"), "questions/c1")));
    await assertFails(get(ref(db("alice"), "questions")));
    await assertFails(get(ref(db("alice"), "courseQuizzes/c1")));
  });

  it("staff can read and write quiz questions", async () => {
    await assertSucceeds(get(ref(db("deptAdmin"), "questions/c1")));
    await assertSucceeds(set(ref(db("deptAdmin"), "courseQuizzes/c1"), { questions: {} }));
    await assertSucceeds(get(ref(db("admin"), "courseQuizzes/c1")));
  });

  it("only admins manage departments", async () => {
    await assertFails(set(ref(db("deptAdmin"), "departments/d2"), { departmentName: "X" }));
    await assertSucceeds(set(ref(db("admin"), "departments/d2"), { departmentName: "X" }));
  });
});

describe("assignments and progress", () => {
  it("users cannot assign courses to themselves", async () => {
    await assertFails(set(ref(db("alice"), "userAssignments/alice/c2"), { assigned: true }));
  });

  it("staff can assign and remove courses", async () => {
    await assertSucceeds(set(ref(db("deptAdmin"), "userAssignments/alice/c1"), { assigned: true }));
    await assertSucceeds(remove(ref(db("admin"), "userAssignments/alice/c1")));
  });

  it("users save their own video progress the way VideoPage does", async () => {
    const base = "courseProgress/alice/c1";
    await assertSucceeds(
      update(ref(db("alice")), {
        "videoProgress/alice/c1/v1": { completed: true, watchedPercent: 100 },
        [`${base}/progressPercentage`]: 100,
        [`${base}/completed`]: true,
        [`${base}/completedVideos`]: 1,
      })
    );
    await assertSucceeds(
      runTransaction(ref(db("alice"), "learningActivity/alice/2026-10-23/c1/v1/seconds"), (n) => (n || 0) + 5)
    );
  });

  it("users cannot fake passing the final test", async () => {
    await assertFails(update(ref(db("alice"), "courseProgress/alice/c1"), { courseTestPassed: true }));
    await assertFails(update(ref(db("alice"), "courseProgress/alice/c1"), { passed: true, score: 100 }));
    await assertFails(set(ref(db("alice"), "completedCourses/alice/c1"), { passed: true }));
    await assertFails(set(ref(db("alice"), "attempts/alice/a1"), { passed: true, courseId: "c1" }));
    await assertFails(set(ref(db("alice"), "certificates/alice/c1"), { url: "x" }));
    await assertFails(
      set(ref(db("alice"), "quizAttempts/alice/c1/final_c1_1"), { quizType: "final", passed: true })
    );
  });

  it("users cannot touch other users' progress", async () => {
    await assertFails(update(ref(db("bob"), "courseProgress/alice/c1"), { progressPercentage: 0 }));
    await assertFails(set(ref(db("bob"), "videoProgress/alice/c1/v1"), { completed: true }));
  });

  it("users save their own practice quiz attempts", async () => {
    await assertSucceeds(
      update(ref(db("alice"), "quizAttempts/alice/c1/practice_v1_123"), { quizType: "practice", score: 2 })
    );
    await assertFails(
      set(ref(db("alice"), "quizAttempts/alice/c1/practice_v1_124"), { quizType: "final", passed: true })
    );
    await assertFails(set(ref(db("bob"), "quizAttempts/alice/c1/practice_v1_125"), { quizType: "practice" }));
  });

  it("staff can reset learners' progress when a course changes", async () => {
    await assertSucceeds(
      update(ref(db("deptAdmin")), {
        "courseProgress/alice/c1/completed": false,
        "courseProgress/alice/c1/courseTestPassed": null,
        "quizAttempts/alice/c1/final_c1_1": null,
      })
    );
  });
});

describe("notifications", () => {
  it("users only read their own notifications", async () => {
    await assertSucceeds(get(ref(db("bob"), "notifications/bob")));
    await assertFails(get(ref(db("alice"), "notifications/bob")));
  });

  it("anyone signed in can send a new notification", async () => {
    await assertSucceeds(
      set(ref(db("alice"), "notifications/bob/n2"), { title: "Reply", message: "New reply", read: false })
    );
  });

  it("users cannot change or delete someone else's notifications", async () => {
    await assertFails(update(ref(db("alice"), "notifications/bob/n1"), { message: "Changed" }));
    await assertFails(remove(ref(db("alice"), "notifications/bob/n1")));
  });

  it("users mark their own notifications read and clear them", async () => {
    await assertSucceeds(update(ref(db("bob")), { "notifications/bob/n1/read": true }));
    await assertSucceeds(remove(ref(db("bob"), "notifications/bob/n1")));
  });
});

describe("course discussions", () => {
  const channel = "courseDiscussions/c1/channels/_general";

  it("users post messages as themselves", async () => {
    await assertSucceeds(
      set(ref(db("alice"), `${channel}/messages/m2`), { senderId: "alice", message: "Question?" })
    );
    await assertSucceeds(
      update(ref(db("alice"), channel), { lastMessage: "Question?", lastMessageBy: "Alice", updatedAt: "now" })
    );
  });

  it("users cannot pretend to be someone else or edit others' messages", async () => {
    await assertFails(set(ref(db("alice"), `${channel}/messages/m3`), { senderId: "bob", message: "fake" }));
    await assertFails(update(ref(db("alice"), `${channel}/messages/m1`), { message: "edited" }));
    await assertFails(remove(ref(db("alice"), channel)));
  });

  it("staff can moderate discussions", async () => {
    await assertSucceeds(remove(ref(db("deptAdmin"), `${channel}/messages/m1`)));
  });
});
