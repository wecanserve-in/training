import { expect } from "@playwright/test";
import { ACCOUNTS, PASSWORD } from "./seed.mjs";

/** Collects browser errors that point at a broken page. */
export const watchErrors = (page) => {
  const errors = [];

  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    const text = message.text();
    if (/permission_denied|PERMISSION_DENIED|Permission denied|Uncaught|is not defined|Cannot read prop/i.test(text)) {
      errors.push(`${message.type()}: ${text}`);
    }
  });

  return errors;
};

export const login = async (page, who) => {
  const account = ACCOUNTS[who];
  await page.goto("/");
  await page.getByPlaceholder("you@company.com").fill(account.email);
  await page.getByPlaceholder("Enter your password").fill(PASSWORD);
  await page.locator("button.login-btn").click();
  await page.waitForURL((url) => url.pathname !== "/", { timeout: 30_000 });
};

/** Waits for loaders to go and the page to settle. */
export const settle = async (page) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.locator(".page-loading")).toHaveCount(0);
  await page.waitForTimeout(400);
};
