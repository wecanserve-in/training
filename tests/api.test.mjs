/**
 * Tests for the PHP API in public/api against the Firebase emulators.
 * Run with: npm run test:api   (needs PHP on PATH, or PHP_BIN set)
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

const PROJECT = "lms-portal-final";
const DB_NS = "lms-portal-final-default-rtdb";
const DB = "http://127.0.0.1:9000";
const AUTH = "http://127.0.0.1:9099";
const API_PORT = 8091;
const API = `http://127.0.0.1:${API_PORT}/api`;

const root = fileURLToPath(new URL("..", import.meta.url));
let php;

// ---------- helpers ----------

const dbRequest = async (method, path, body) => {
  const response = await fetch(`${DB}/${path}.json?ns=${DB_NS}`, {
    method,
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  assert.ok(response.ok, `DB ${method} ${path} failed: ${text}`);
  return JSON.parse(text);
};

const dbGet = (path) => dbRequest("GET", path);
const dbSet = (path, value) => dbRequest("PUT", path, value);

const signUp = async (email) => {
  const response = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "secret123", returnSecureToken: true }),
    }
  );
  const data = await response.json();
  assert.ok(data.idToken, JSON.stringify(data));
  return { uid: data.localId, token: data.idToken };
};

const api = async (endpoint, { token, method = "GET", body, query } = {}) => {
  const qs = query ? `?${new URLSearchParams(query)}` : "";
  const response = await fetch(`${API}/${endpoint}${qs}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON from ${endpoint} (${response.status}): ${text.slice(0, 500)}`);
  }
  return { status: response.status, ...json };
};

const clearAuth = () =>
  fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });

const waitForServer = async () => {
  for (let i = 0; i < 50; i += 1) {
    try {
      await fetch(`${API}/quiz.php`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("PHP server did not start");
};

// ---------- setup ----------

let people;

before(async () => {
  php = spawn(process.env.PHP_BIN || "php", ["-S", `127.0.0.1:${API_PORT}`, "-t", "public"], {
    cwd: root,
    env: { ...process.env, LMS_CONFIG: `${root}tests/fixtures/config.emulator.php` },
    stdio: ["ignore", "ignore", "pipe"],
  });
  php.stderr.on("data", (chunk) => {
    const line = String(chunk);
    if (/PHP (Fatal|Warning|Parse|Deprecated|Notice)/.test(line)) process.stderr.write(line);
  });
  await waitForServer();
});

after(() => php?.kill());

beforeEach(async () => {
  await clearAuth();
  await dbSet("", null);

  people = {
    superAdmin: await signUp("super@test.in"),
    admin: await signUp("admin@test.in"),
    admin2: await signUp("admin2@test.in"),
    deptAdmin: await signUp("dept@test.in"),
    alice: await signUp("alice@test.in"),
    bob: await signUp("bob@test.in"),
  };

  const p = people;
  await dbSet("", {
    users: {
      [p.superAdmin.uid]: { role: "superAdmin", name: "Super" },
      [p.admin.uid]: { role: "admin", name: "Admin" },
      [p.admin2.uid]: { role: "admin", name: "Admin Two" },
      [p.deptAdmin.uid]: { role: "departmentAdmin", name: "Dept", department: "Sales & Marketing" },
      [p.alice.uid]: { role: "user", name: "Alice" },
      [p.bob.uid]: { role: "user", name: "Bob" },
    },
    courses: { c1: { title: "Safety Basics", passingScore: 70 } },
    courseVideos: { c1: { m1: { videoId: "v1", order: 1 }, m2: { videoId: "v2", order: 2 } } },
    videoLibrary: { v1: { title: "Intro" }, v2: { title: "Gloves" } },
    questions: {
      c1: {
        q1: { question: "2+2?", options: ["3", "4", "5"], correctOptionIndex: 1, order: 1, explanation: "math" },
        q2: { question: "Sky colour?", options: ["Blue", "Green"], correctAnswer: "Blue", order: 2 },
        q3: { question: "Pick B", optionA: "a", optionB: "b", correctOption: "B", order: 3 },
      },
    },
    userAssignments: { [p.alice.uid]: { c1: { assigned: true } } },
    notifications: { [p.alice.uid]: { keep: { title: "x", message: "y" } } },
  });
});

const completeVideos = (uid) =>
  dbSet(`videoProgress/${uid}/c1`, {
    v1: { completed: true, watchedPercent: 100 },
    v2: { completed: true, watchedPercent: 100 },
  });

// ---------- tests ----------

describe("authentication", () => {
  it("rejects requests without a valid token", async () => {
    assert.equal((await api("quiz.php", { query: { courseId: "c1" } })).status, 401);
    assert.equal((await api("quiz.php", { token: "abc.def.ghi", query: { courseId: "c1" } })).status, 401);
  });

  it("rejects the wrong HTTP method", async () => {
    assert.equal((await api("submit-quiz.php", { token: people.alice.token })).status, 405);
  });
});

describe("upload-url.php", () => {
  it("lets any user upload their own profile photo", async () => {
    const result = await api("upload-url.php", {
      token: people.alice.token,
      method: "POST",
      body: { folder: "profile-photos", fileName: "me.JPG" },
    });
    assert.equal(result.status, 200, result.message);
    assert.match(result.key, new RegExp(`^profile-photos/${people.alice.uid}-\\d+\\.jpg$`));
    assert.equal(result.publicUrl, `https://files.example.com/${result.key}`);
    const url = new URL(result.uploadUrl);
    assert.equal(url.host, "testaccount.r2.cloudflarestorage.com");
    assert.equal(url.pathname, `/test-bucket/${result.key}`);
    assert.ok(url.searchParams.get("X-Amz-Signature")?.match(/^[0-9a-f]{64}$/));
    assert.equal(url.searchParams.get("X-Amz-SignedHeaders"), "host");
  });

  it("refuses non-image profile photos", async () => {
    const result = await api("upload-url.php", {
      token: people.alice.token,
      method: "POST",
      body: { folder: "profile-photos", fileName: "evil.html" },
    });
    assert.equal(result.status, 400);
  });

  it("blocks normal users from uploading course content", async () => {
    for (const folder of ["training-portal/videos", "resources", "lms/thumbnails"]) {
      const result = await api("upload-url.php", {
        token: people.alice.token,
        method: "POST",
        body: { folder, fileName: "x.mp4" },
      });
      assert.equal(result.status, 403, folder);
    }
  });

  it("lets staff upload into department folders", async () => {
    const result = await api("upload-url.php", {
      token: people.deptAdmin.token,
      method: "POST",
      body: { folder: "training-portal/videos", fileName: "lesson.mp4", department: "Sales & Marketing" },
    });
    assert.equal(result.status, 200, result.message);
    assert.match(result.key, /^training-portal\/videos\/sales-and-marketing\/\d+-[0-9a-f]{7}\.mp4$/);
  });

  it("refuses unknown folders and path tricks", async () => {
    for (const folder of ["../../etc", "training-portal", "profile-photos/../resources"]) {
      const result = await api("upload-url.php", {
        token: people.admin.token,
        method: "POST",
        body: { folder, fileName: "x.png" },
      });
      assert.equal(result.status, 400, folder);
    }
  });
});

describe("quiz.php", () => {
  it("returns questions without any answers", async () => {
    const result = await api("quiz.php", { token: people.alice.token, query: { courseId: "c1" } });
    assert.equal(result.status, 200, result.message);
    assert.equal(result.questions.length, 3);
    assert.deepEqual(result.questions.map((q) => q.id), ["q1", "q2", "q3"]);
    assert.deepEqual(result.questions[2].options, ["a", "b"]);
    const text = JSON.stringify(result);
    for (const leaked of ["correctOptionIndex", "correctAnswer", "correctOption", "explanation"]) {
      assert.ok(!text.includes(leaked), `leaked ${leaked}`);
    }
  });

  it("only serves assigned courses to normal users", async () => {
    const result = await api("quiz.php", { token: people.bob.token, query: { courseId: "c1" } });
    assert.equal(result.status, 403);
  });

  it("serves any course to staff and 404s unknown ones", async () => {
    assert.equal((await api("quiz.php", { token: people.deptAdmin.token, query: { courseId: "c1" } })).status, 200);
    assert.equal((await api("quiz.php", { token: people.admin.token, query: { courseId: "nope" } })).status, 404);
  });
});

describe("submit-quiz.php", () => {
  const submit = (answers, token = people.alice.token) =>
    api("submit-quiz.php", { token, method: "POST", body: { courseId: "c1", answers, warningCount: 1 } });

  it("requires all videos to be watched first", async () => {
    const result = await submit({ q1: "4", q2: "Blue", q3: "b" });
    assert.equal(result.status, 409);
    assert.match(result.message, /complete all course videos/);
    assert.equal(await dbGet(`completedCourses/${people.alice.uid}`), null);
  });

  it("requires passing video revision quizzes first", async () => {
    await completeVideos(people.alice.uid);
    await dbSet("videoQuizzes/v2/r1", { question: "Revise?", options: ["y", "n"], correctOptionIndex: 0 });
    const blocked = await submit({ q1: "4", q2: "Blue", q3: "b" });
    assert.equal(blocked.status, 409);
    assert.match(blocked.message, /revision quiz/);

    await dbSet(`quizAttempts/${people.alice.uid}/c1/practice_v2_1`, {
      quizType: "practice", videoId: "v2", score: 1, totalMarks: 1, passed: true,
    });
    assert.equal((await submit({ q1: "4", q2: "Blue", q3: "b" })).status, 200);
  });

  it("grades a failing attempt without marking the course complete", async () => {
    await completeVideos(people.alice.uid);
    const result = await submit({ q1: "4", q2: "Green", q3: "a" });
    assert.equal(result.status, 200, result.message);
    assert.equal(result.passed, false);
    assert.equal(result.correct, 1);
    assert.equal(result.percentage, 33);

    const attempt = await dbGet(`quizAttempts/${people.alice.uid}/c1/${result.quizId}`);
    assert.equal(attempt.passed, false);
    assert.equal(attempt.gradedBy, "server");
    assert.equal(attempt.warningCount, 1);
    assert.ok(await dbGet(`attempts/${people.alice.uid}/${result.legacyAttemptId}`));
    assert.equal(await dbGet(`completedCourses/${people.alice.uid}/c1`), null);
  });

  it("grades a passing attempt and saves completion, progress and notifications", async () => {
    await completeVideos(people.alice.uid);
    await dbSet(`courseProgress/${people.alice.uid}/c1`, { completedVideos: 2, totalVideos: 2 });

    const result = await submit({ q1: "4", q2: "Blue", q3: "b" });
    assert.equal(result.status, 200, result.message);
    assert.equal(result.passed, true);
    assert.equal(result.percentage, 100);

    const progress = await dbGet(`courseProgress/${people.alice.uid}/c1`);
    assert.equal(progress.courseTestPassed, true);
    assert.equal(progress.completedVideos, 2, "kept existing video fields");
    assert.equal((await dbGet(`completedCourses/${people.alice.uid}/c1`)).passed, true);

    const notifications = Object.values(await dbGet(`notifications/${people.alice.uid}`));
    assert.deepEqual(
      notifications.map((n) => n.type).filter(Boolean).sort(),
      ["certificate_ready", "course_completed"]
    );
    assert.equal(notifications.length, 3, "kept old notification");
  });

  it("does not let a user re-take a passed test", async () => {
    await completeVideos(people.alice.uid);
    const first = await submit({ q1: "4", q2: "Blue", q3: "b" });
    const second = await submit({ q1: "3" });
    assert.equal(second.alreadyPassed, true);
    assert.equal(second.percentage, 100);
    assert.equal(second.quizId, first.quizId);
  });

  it("ignores answers to questions that do not exist", async () => {
    await completeVideos(people.alice.uid);
    const result = await submit({ fake1: "x", fake2: "y", q1: "4" });
    assert.equal(result.correct, 1);
    assert.equal(result.total, 3);
  });

  it("refuses unassigned users", async () => {
    await completeVideos(people.bob.uid);
    assert.equal((await submit({ q1: "4" }, people.bob.token)).status, 403);
  });
});

describe("delete-user.php", () => {
  const remove = (uid, token) => api("delete-user.php", { token, method: "POST", body: { uid } });

  it("only admins can delete users", async () => {
    assert.equal((await remove(people.bob.uid, people.alice.token)).status, 403);
    assert.equal((await remove(people.bob.uid, people.deptAdmin.token)).status, 403);
  });

  it("admins cannot delete other admins, super admins can", async () => {
    assert.equal((await remove(people.admin2.uid, people.admin.token)).status, 403);
    assert.equal((await remove(people.admin2.uid, people.superAdmin.token)).status, 200);
  });

  it("nobody can delete themselves", async () => {
    assert.equal((await remove(people.superAdmin.uid, people.superAdmin.token)).status, 400);
  });

  it("removes the login account and all of the user's data", async () => {
    const uid = people.alice.uid;
    await completeVideos(uid);
    await dbSet(`courseDiscussions/c1/channels/_general/messages`, {
      mine: { senderId: uid, message: "hi" },
      other: { senderId: people.bob.uid, message: "yo" },
    });

    const result = await remove(uid, people.admin.token);
    assert.equal(result.status, 200, result.message);

    for (const path of ["users", "userAssignments", "videoProgress", "notifications"]) {
      assert.equal(await dbGet(`${path}/${uid}`), null, path);
    }
    const messages = await dbGet("courseDiscussions/c1/channels/_general/messages");
    assert.deepEqual(Object.keys(messages), ["other"]);

    const login = await fetch(
      `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@test.in", password: "secret123" }),
      }
    );
    assert.equal(login.status, 400, "login account is gone");
  });
});
