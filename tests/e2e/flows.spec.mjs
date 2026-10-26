/**
 * Content and certificate flows: certificate PDF download, the create-course
 * wizard and video upload. Storage uploads go to a stub (no real files).
 */

import { test, expect } from "@playwright/test";
import { seed, dbGet } from "./seed.mjs";
import { login, settle, watchErrors } from "./helpers.mjs";

// 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

let uids;
let uploads;

test.beforeEach(async ({ page }) => {
  ({ uids } = await seed());
  uploads = [];
  page.dialogs = [];
  page.on("dialog", async (dialog) => {
    page.dialogs.push(dialog.message());
    await dialog.accept();
  });

  // Signed R2 upload links (tests/fixtures/config.emulator.php) point here: accept the PUT.
  await page.route("https://testaccount.r2.cloudflarestorage.com/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "PUT",
          "Access-Control-Allow-Headers": "content-type",
        },
      });
    }
    uploads.push({ url: request.url(), type: request.headers()["content-type"] });
    return route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: "" });
  });
});

test("learner downloads a certificate as a PDF", async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, "alice");
  await page.goto("/certificates");
  await settle(page);

  await page.getByText("Download Certificate").first().click();
  await expect(page).toHaveURL(/\/certificate\//);
  await settle(page);

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("button", { name: /Download PDF/ }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  const path = await download.path();
  const { statSync } = await import("node:fs");
  expect(statSync(path).size).toBeGreaterThan(10_000);
  expect(errors).toEqual([]);
});

test("department admin creates a course with the wizard", async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, "deptAdmin");
  await page.goto("/department-admin/courses/create");
  await settle(page);

  // Step 1: details + optional thumbnail
  await page.getByPlaceholder("e.g., Breast Cancer Product Training").fill("Objection Handling 2.0");
  await page.locator("textarea.course-overview-textarea").fill("How to handle common objections.");
  await page.locator(".course-thumb-picker input[type=file]").setInputFiles({
    name: "thumb.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await page.locator(".btn-admin-submit-form").click();

  // Step 2: pick a video
  await page.locator(".course-video-select-card", { hasText: "Handling Objections" }).click();
  await page.locator(".btn-admin-submit-form").click();

  // Step 3: one quiz question
  await page.getByPlaceholder("Enter question...").fill("Best first response to an objection?");
  await page.getByPlaceholder("Option A").first().fill("Listen");
  await page.getByPlaceholder("Option B").first().fill("Argue");
  await page.getByPlaceholder("Option C").first().fill("Ignore");
  await page.getByPlaceholder("Option D").first().fill("Leave");
  await page.locator("select.admin-form-input").last().selectOption("Listen");
  await page.locator(".btn-add-inline").click();
  await page.locator(".btn-admin-submit-form").click();

  // Step 4: save
  await page.getByRole("button", { name: "Save Course" }).click();
  await expect(page).toHaveURL(/\/department-admin\/courses$/, { timeout: 30_000 });
  await expect(page.getByText("Objection Handling 2.0")).toBeVisible();

  const courses = await dbGet("courses");
  const [courseId, course] = Object.entries(courses).find(([, c]) => c.title === "Objection Handling 2.0");
  expect(course.departmentId).toBe("dSales");
  expect(course.courseThumbnail || course.thumbnailUrl).toMatch(/^https:\/\/files\.example\.com\/training-portal\/course-thumbnails\/sales\//);
  expect(Object.values(await dbGet(`courseVideos/${courseId}`)).map((v) => v.videoId || v.id)).toContain("v2");
  expect(Object.values(await dbGet(`questions/${courseId}`))[0].question).toBe("Best first response to an objection?");
  expect(uploads.length).toBe(1);
  expect(errors).toEqual([]);
});

test("department admin uploads a video to the library", async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, "deptAdmin");
  await page.goto("/department-admin/video-library/upload");
  await settle(page);

  await page.getByPlaceholder("e.g., Product Basics").fill("Closing the Sale");
  await page.getByPlaceholder("What will learners get from this video?").fill("Closing techniques.");
  await page.locator("input[type=file][accept='video/*']").setInputFiles({
    name: "closing.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.alloc(4096, 1),
  });

  await page.locator("button.final-save-btn").click();
  await expect.poll(async () => {
    const library = (await dbGet("videoLibrary")) || {};
    return Object.values(library).find((v) => v.title === "Closing the Sale") || null;
  }, { timeout: 60_000 }).not.toBeNull();

  const library = await dbGet("videoLibrary");
  const video = Object.values(library).find((v) => v.title === "Closing the Sale");
  expect(video.videoUrl).toMatch(/^https:\/\/files\.example\.com\/training-portal\/videos\/sales\/.+\.mp4$/);
  expect(uploads.some((u) => u.url.includes("/training-portal/videos/"))).toBe(true);
  expect(page.dialogs.join(" ")).toMatch(/No quiz questions/);
  expect(errors).toEqual([]);
});
