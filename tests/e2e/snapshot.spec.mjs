/**
 * Optional: replays a copy of real data under the current rules.
 *
 *   SNAPSHOT_FILE=path/to/export.json npm run test:e2e -- snapshot.spec.mjs
 *
 * Loads the export into the emulators, gives every account a test password,
 * then opens every page as one real account per role. Skipped when no file is given.
 */

import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { dbSet } from "./seed.mjs";
import { settle, watchErrors } from "./helpers.mjs";

const FILE = process.env.SNAPSHOT_FILE;
const PASSWORD = "Snapshot@12345";
const PROJECT = "lms-portal-final";
const AUTH = "http://127.0.0.1:9099";

test.skip(!FILE, "Set SNAPSHOT_FILE to run");

const data = FILE ? JSON.parse(readFileSync(FILE, "utf8")) : {};
const users = Object.entries(data.users || {});
const normalize = (role) => String(role || "user").toLowerCase().replace(/[\s_-]/g, "");
const firstOf = (role) => users.find(([, u]) => normalize(u.role) === role);

const firstKey = (object) => Object.keys(object || {})[0];
const courseId = firstKey(data.courses);
const mapping = data.courseVideos?.[courseId] || {};
const videoId = mapping[firstKey(mapping)]?.videoId || firstKey(mapping);
const libraryId = firstKey(data.videoLibrary);

const pagesFor = (base) => {
  const p = (path) => `${base}${path}`;
  const common = [
    "", "/my-learnings", "/assigned-courses", "/my-results", "/certificates", "/all-certificates",
    "/resources", "/profile", "/notifications", "/courses", "/assignments", "/assigned-users",
    "/video-library", "/results", "/analytics",
    courseId && `/course/${courseId}`,
    courseId && `/course-overview/${courseId}`,
    courseId && `/courses/edit/${courseId}`,
    courseId && videoId && `/course/${courseId}/video/${videoId}`,
    libraryId && `/video-library/edit/${libraryId}`,
  ].filter((x) => x !== undefined && x !== false);
  const extra = {
    "/super-admin": ["/admins", "/users", "/departments", "/department-analytics", "/assignment-analytics"],
    "/admin": ["/users", "/departments", "/questions", "/department-analytics"],
    "/department-admin": ["/members", "/test-logs", "/questions", "/videos", "/courses/create", "/video-library/upload"],
  }[base] || [];
  return [...common, ...extra].map(p).filter((route) => !route.endsWith("/results") || base !== "/department-admin");
};

const userPages = [
  "/dashboard", "/assigned-courses", "/my-results", "/my-learnings", "/profile", "/resources",
  "/certificates", "/notifications",
];

test.beforeAll(async () => {
  if (!FILE) return;
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
  await dbSet("", data);

  for (const [uid, user] of users) {
    const response = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts`, {
      method: "POST",
      headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
      body: JSON.stringify({ localId: uid, email: user.email, password: PASSWORD }),
    });
    if (!response.ok) throw new Error(`Account ${uid}: ${await response.text()}`);
  }
});

const runAs = (label, role, routesFor) => {
  test(`real data: every page works for a real ${label}`, async ({ page }) => {
    const entry = firstOf(role);
    test.skip(!entry, `No ${label} in the snapshot`);
    const [, user] = entry;

    page.on("dialog", (dialog) => dialog.accept());
    const errors = watchErrors(page);

    await page.goto("/");
    await page.getByPlaceholder("you@company.com").fill(user.email);
    await page.getByPlaceholder("Enter your password").fill(PASSWORD);
    await page.locator("button.login-btn").click();
    await page.waitForURL((url) => url.pathname !== "/", { timeout: 30_000 });

    const problems = [];
    for (const route of routesFor()) {
      errors.length = 0;
      await page.goto(route);
      await settle(page);
      const body = await page.locator("body").innerText();
      if (/Access Denied|User profile not found/.test(body)) problems.push(`${route}: access denied`);
      if (errors.length) problems.push(`${route}: ${[...new Set(errors)].join(" | ")}`);
    }

    expect(problems, problems.join("\n")).toEqual([]);
  });
};

runAs("super admin", "superadmin", () => pagesFor("/super-admin"));
runAs("admin", "admin", () => pagesFor("/admin"));
runAs("department admin", "departmentadmin", () => pagesFor("/department-admin"));
runAs("user", "user", () => [
  ...userPages,
  ...Object.keys(data.userAssignments?.[firstOf("user")?.[0]] || {}).map((id) => `/course/${id}`),
]);
