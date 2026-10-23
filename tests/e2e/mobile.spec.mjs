import { test, expect } from "@playwright/test";
import { seed } from "./seed.mjs";
import { login, settle, watchErrors } from "./helpers.mjs";

// Most learners use phones: key pages must fit the screen without sideways scrolling.
test.beforeEach(async ({ page }) => {
  await seed();
  page.on("dialog", (dialog) => dialog.accept());
});

const pages = {
  alice: ["/dashboard", "/assigned-courses", "/course/c1", "/course/c1/video/v1", "/my-results", "/certificates", "/profile", "/notifications"],
  deptAdmin: ["/department-admin", "/department-admin/courses", "/department-admin/members"],
};

for (const [who, routes] of Object.entries(pages)) {
  test(`${who} pages fit a phone screen`, async ({ page }) => {
    const errors = watchErrors(page);
    await login(page, who);

    const problems = [];
    for (const route of routes) {
      await page.goto(route);
      await settle(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      if (overflow > 2) problems.push(`${route}: ${overflow}px wider than the screen`);
    }

    expect(problems, problems.join("\n")).toEqual([]);
    expect(errors).toEqual([]);
  });
}
