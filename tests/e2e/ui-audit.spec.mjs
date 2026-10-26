/**
 * Layout audit (not part of the normal test run).
 *
 *   UI_AUDIT_DIR=some/folder npm run test:e2e -- ui-audit.spec.mjs --project=desktop
 *
 * Opens every page as each role at phone, tablet and desktop widths, saves a
 * screenshot and writes report.json listing layout problems:
 * sideways scrolling, elements sticking out of the screen, small tap targets,
 * and fixed elements covering content.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import { seed } from "./seed.mjs";
import { login, settle } from "./helpers.mjs";

const OUT = process.env.UI_AUDIT_DIR;
test.skip(!OUT, "Set UI_AUDIT_DIR to run the layout audit");

const VIEWPORTS = {
  phone: { width: 390, height: 844, isMobile: true, hasTouch: true },
  tablet: { width: 820, height: 1180, isMobile: true, hasTouch: true },
  "laptop-1280": { width: 1280, height: 650 },
  "laptop-1366-rail": { width: 1366, height: 657, collapsed: true },
  desktop: { width: 1440, height: 900 },
};

// Optional: only some sizes, e.g. UI_AUDIT_SIZES=phone,laptop-1280
const ONLY = (process.env.UI_AUDIT_SIZES || "").split(",").filter(Boolean);

export const AUDIT_ROUTES = {
  alice: [
    "/dashboard", "/assigned-courses", "/my-learnings", "/course/c1", "/course/c1/video/v1",
    "/quiz/c2", "/my-results", "/certificates", "/resources", "/notifications", "/profile",
  ],
  deptAdmin: [
    "/department-admin", "/department-admin/members", "/department-admin/courses",
    "/department-admin/courses/create", "/department-admin/courses/edit/c1",
    "/department-admin/course-overview/c1", "/department-admin/assignments",
    "/department-admin/assigned-users", "/department-admin/test-logs",
    "/department-admin/video-library", "/department-admin/video-library/upload",
    "/department-admin/video-library/edit/v1", "/department-admin/videos",
    "/department-admin/questions", "/department-admin/analytics", "/department-admin/all-certificates",
  ],
  admin: [
    "/admin", "/admin/users", "/admin/departments", "/admin/analytics", "/admin/department-analytics",
    "/admin/assignment-analytics", "/admin/questions", "/admin/add-question", "/admin/results",
  ],
  superAdmin: [
    "/super-admin", "/super-admin/admins", "/super-admin/users", "/super-admin/departments",
    "/super-admin/analytics", "/super-admin/all-certificates",
  ],
};

const slug = (route) => route.replace(/^\//, "").replace(/[/:]/g, "_") || "home";

// Runs in the page: finds layout problems.
const inspect = () => {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const problems = [];
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
    const text = (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().slice(0, 30);
    return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ""}`;
  };
  const visible = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0 && r.width > 0 && r.height > 0;
  };
  const insideScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll|hidden)/.test(s.overflowX)) return true;
    }
    return false;
  };

  const pageOverflow = document.documentElement.scrollWidth - vw;
  if (pageOverflow > 2) problems.push({ type: "page-scrolls-sideways", detail: `${pageOverflow}px` });

  const all = [...document.querySelectorAll("body *")].filter(visible);

  // Elements poking out past the right edge (not inside a scroll container).
  const overflowing = all
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.right > vw + 2 && !insideScroller(el) && getComputedStyle(el).position !== "fixed";
    })
    .filter((el, _, list) => !list.some((other) => other !== el && other.contains(el)))
    .slice(0, 6);
  overflowing.forEach((el) =>
    problems.push({ type: "sticks-out-right", detail: `${describe(el)} right=${Math.round(el.getBoundingClientRect().right)}` })
  );

  // Text cut off inside its box.
  all
    .filter((el) => el.children.length === 0 && el.innerText?.trim() && el.scrollWidth > el.clientWidth + 2)
    .filter((el) => getComputedStyle(el).textOverflow !== "ellipsis" && /(hidden|clip)/.test(getComputedStyle(el).overflowX))
    .slice(0, 4)
    .forEach((el) => problems.push({ type: "text-clipped", detail: describe(el) }));

  // Small tap targets on touch screens.
  if (matchMedia("(pointer: coarse)").matches || vw < 900) {
    const small = all
      .filter((el) => el.matches("button, a[href], input:not([type=hidden]), select, [role=button]"))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (r.height < 32 || r.width < 32) && !el.matches("input[type=checkbox], input[type=radio]");
      });
    if (small.length) problems.push({ type: "small-tap-targets", detail: `${small.length}: ${small.slice(0, 4).map(describe).join(", ")}` });
  }

  // Fixed/sticky elements covering interactive content in the first screen.
  // Floating helpers (profile reminder, Discussion button) overlap content by design;
  // pages leave room to scroll past them, so they are not reported.
  const fixed = all.filter((el) =>
    ["fixed", "sticky"].includes(getComputedStyle(el).position) &&
    el.getBoundingClientRect().height < vh * 0.9 &&
    !el.closest(".pcb-floating, .vp-discuss-fab"));
  for (const f of fixed) {
    const fr = f.getBoundingClientRect();
    const covered = all.find((el) => {
      if (f.contains(el) || el.contains(f) || !el.matches("button, a[href], input, h1, h2")) return false;
      if (["fixed", "sticky"].includes(getComputedStyle(el).position)) return false;
      const r = el.getBoundingClientRect();
      const overlapX = Math.min(r.right, fr.right) - Math.max(r.left, fr.left);
      const overlapY = Math.min(r.bottom, fr.bottom) - Math.max(r.top, fr.top);
      return overlapX > 8 && overlapY > 8 && r.top < vh;
    });
    if (covered) problems.push({ type: "fixed-covers-content", detail: `${describe(f)} covers ${describe(covered)}` });
  }

  return problems;
};

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  test.describe(name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, isMobile: !!viewport.isMobile, hasTouch: !!viewport.hasTouch });

    for (const [who, routes] of Object.entries(AUDIT_ROUTES)) {
      test(`${name} ${who}`, async ({ page }) => {
        test.setTimeout(240_000);
        await seed();
        page.on("dialog", (dialog) => dialog.accept());
        if (viewport.collapsed) {
          await page.addInitScript(() => localStorage.setItem("app-sidebar-collapsed", "1"));
        }
        await login(page, who);

        const dir = join(OUT, name);
        mkdirSync(dir, { recursive: true });
        const report = {};

        for (const route of routes) {
          await page.goto(route);
          await settle(page);
          await page.waitForTimeout(300);
          report[route] = await page.evaluate(inspect);
          await page.screenshot({ path: join(dir, `${who}--${slug(route)}.png`), fullPage: true });
        }

        // Menus and popovers.
        await page.goto(routes[0]);
        await settle(page);
        const menuButton = page.getByRole("button", { name: "Open menu" });
        if (await menuButton.isVisible().catch(() => false)) {
          await menuButton.click();
          await page.waitForTimeout(400);
          await page.screenshot({ path: join(dir, `${who}--menu-open.png`) });
          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
        }
        if (viewport.collapsed && (await page.locator(".shell-group-toggle").count())) {
          await page.locator(".shell-group-toggle").first().hover();
          await page.waitForTimeout(300);
          await page.screenshot({ path: join(dir, `${who}--rail-flyout.png`) });
        }
        await page.getByRole("button", { name: /^Notifications/ }).click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: join(dir, `${who}--notifications-open.png`) });
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: "Account menu" }).click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: join(dir, `${who}--account-open.png`) });

        writeFileSync(join(dir, `${who}.json`), JSON.stringify(report, null, 2));
      });
    }
  });
}
