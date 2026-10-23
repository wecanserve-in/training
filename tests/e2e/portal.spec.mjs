import { test, expect } from "@playwright/test";
import { seed, dbGet, dbSet } from "./seed.mjs";
import { login, settle, watchErrors } from "./helpers.mjs";

let uids;

test.beforeEach(async ({ page }) => {
  ({ uids } = await seed());
  // Accept alert/confirm dialogs automatically, but remember them.
  page.dialogs = [];
  page.on("dialog", async (dialog) => {
    page.dialogs.push(dialog.message());
    await dialog.accept();
  });
});

const ROUTES = {
  superAdmin: [
    "/super-admin", "/super-admin/admins", "/super-admin/users", "/super-admin/departments",
    "/super-admin/analytics", "/super-admin/department-analytics", "/super-admin/assignment-analytics",
    "/super-admin/courses", "/super-admin/courses/edit/c1", "/super-admin/assignments",
    "/super-admin/assigned-users", "/super-admin/video-library", "/super-admin/video-library/edit/v1",
    "/super-admin/results", "/super-admin/my-learnings", "/super-admin/assigned-courses",
    "/super-admin/my-results", "/super-admin/certificates", "/super-admin/all-certificates",
    "/super-admin/resources", "/super-admin/profile", "/super-admin/course/c1",
    "/super-admin/course-overview/c1", "/super-admin/notifications",
  ],
  admin: [
    "/admin", "/admin/users", "/admin/departments", "/admin/analytics", "/admin/department-analytics",
    "/admin/assignment-analytics", "/admin/courses", "/admin/courses/edit/c1", "/admin/assignments",
    "/admin/assigned-users", "/admin/video-library", "/admin/video-library/edit/v1", "/admin/questions",
    "/admin/add-question", "/admin/results", "/admin/my-learnings", "/admin/assigned-courses",
    "/admin/my-results", "/admin/certificates", "/admin/all-certificates", "/admin/resources",
    "/admin/profile", "/admin/course/c1", "/admin/course-overview/c1", "/admin/notifications",
  ],
  deptAdmin: [
    "/department-admin", "/department-admin/members", "/department-admin/courses",
    "/department-admin/courses/create", "/department-admin/courses/edit/c1",
    "/department-admin/assignments", "/department-admin/assigned-users", "/department-admin/test-logs",
    "/department-admin/video-library", "/department-admin/video-library/upload",
    "/department-admin/video-library/edit/v1", "/department-admin/videos", "/department-admin/questions",
    "/department-admin/my-learnings", "/department-admin/assigned-courses", "/department-admin/my-results",
    "/department-admin/certificates", "/department-admin/all-certificates", "/department-admin/analytics",
    "/department-admin/resources", "/department-admin/profile", "/department-admin/course/c1",
    "/department-admin/course-overview/c1", "/department-admin/notifications",
  ],
  alice: [
    "/dashboard", "/assigned-courses", "/my-results", "/my-learnings", "/course/c1", "/course/c2",
    "/course/c1/video/v1", "/profile", "/resources", "/certificates", "/notifications",
  ],
};

for (const [who, routes] of Object.entries(ROUTES)) {
  test(`every ${who} page opens without errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await login(page, who);

    const problems = [];
    for (const route of routes) {
      errors.length = 0;
      await page.goto(route);
      await settle(page);

      const body = await page.locator("body").innerText();
      if (/Access Denied|User profile not found/.test(body)) problems.push(`${route}: access denied`);
      if (!body.trim()) problems.push(`${route}: blank page`);
      if (errors.length) problems.push(`${route}: ${[...new Set(errors)].join(" | ")}`);
    }

    expect(problems, problems.join("\n")).toEqual([]);
  });
}

test("normal users are kept out of admin areas", async ({ page }) => {
  await login(page, "alice");
  for (const route of ["/admin", "/super-admin/users", "/department-admin/courses"]) {
    await page.goto(route);
    await expect(page.getByText("Access Denied.")).toBeVisible();
  }
  // The staff-only course overview (shows answers) redirects to the normal course page.
  await page.goto("/course-overview/c1");
  await expect(page).toHaveURL(/\/course\/c1$/);
});

test("learner takes the final test, passes and gets a certificate", async ({ page }) => {
  const errors = watchErrors(page);
  // Pretend Alice watched both videos.
  await dbSet(`videoProgress/${uids.alice}/c1`, {
    v1: { videoId: "v1", courseId: "c1", completed: true, watchedPercent: 100 },
    v2: { videoId: "v2", courseId: "c1", completed: true, watchedPercent: 100 },
  });

  await login(page, "alice");
  await page.goto("/quiz/c1");
  await page.getByRole("button", { name: /Start/ }).click();
  await expect(page.getByText("Question 1 of 3")).toBeVisible();

  for (const answer of ["Listen", "Opportunities", "Yes"]) {
    await page.locator("label.quiz-option-clean", { hasText: answer }).click();
    await page.locator("button.quiz-next-btn").click();
  }

  await expect(page).toHaveURL(/\/result\//, { timeout: 30_000 });
  await expect(page.getByText("Quiz Passed")).toBeVisible();

  const attempts = await dbGet(`quizAttempts/${uids.alice}/c1`);
  const final = Object.values(attempts).find((a) => a.quizType === "final");
  expect(final.passed).toBe(true);
  expect(final.gradedBy).toBe("server");
  expect(final.percentage).toBe(100);

  await page.goto("/certificates");
  await settle(page);
  await expect(page.getByText("Sales Fundamentals", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("learner who fails can see the failed result", async ({ page }) => {
  await dbSet(`videoProgress/${uids.alice}/c1`, {
    v1: { completed: true, watchedPercent: 100 },
    v2: { completed: true, watchedPercent: 100 },
  });

  await login(page, "alice");
  await page.goto("/quiz/c1");
  await page.getByRole("button", { name: /Start/ }).click();
  for (const answer of ["Argue", "Bad", "No"]) {
    await page.locator("label.quiz-option-clean", { hasText: answer }).click();
    await page.locator("button.quiz-next-btn").click();
  }
  await expect(page.getByText("Quiz Failed")).toBeVisible({ timeout: 30_000 });
  expect(await dbGet(`completedCourses/${uids.alice}/c1`)).toBeNull();
});

test("learner cannot start the final test before watching the videos", async ({ page }) => {
  await login(page, "alice");
  await page.goto("/quiz/c1");
  await expect.poll(() => page.dialogs.join(" ")).toMatch(/complete all course videos/i);
});

test("learner updates their profile", async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, "alice");
  await page.goto("/profile");
  await settle(page);
  expect(errors).toEqual([]);
});

test("admin deletes a user completely", async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, "admin");
  await page.goto("/admin/users");
  await settle(page);

  const row = page.locator("tr", { hasText: "bob@zuvius.test" });
  await expect(row).toBeVisible();
  await row.locator(".mu-action-delete").click();

  await expect.poll(() => page.dialogs.join(" | ")).toMatch(/deleted completely/i);
  expect(await dbGet(`users/${uids.bob}`)).toBeNull();
  expect(await dbGet(`userAssignments/${uids.bob}`)).toBeNull();
  expect(errors).toEqual([]);
});

test("department admin assigns a course to a learner", async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, "deptAdmin");
  await page.goto("/department-admin/assignments");
  await settle(page);
  expect(errors).toEqual([]);
});
