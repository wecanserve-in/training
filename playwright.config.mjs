import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

/**
 * End-to-end tests. Run with: npm run test:e2e
 * (starts the Firebase emulators, the PHP API and the app in "e2e" mode).
 */

const root = fileURLToPath(new URL(".", import.meta.url));
const APP_PORT = 5174;
const API_PORT = 8092;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "*.spec.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: "mobile.spec.mjs" },
  ],
  webServer: [
    {
      command: `${process.env.PHP_BIN || "php"} -S 127.0.0.1:${API_PORT} -t public`,
      url: `http://127.0.0.1:${API_PORT}/favicon.svg`,
      env: { LMS_CONFIG: `${root}tests/fixtures/config.emulator.php` },
      reuseExistingServer: false,
    },
    {
      command: `npx vite --mode e2e --port ${APP_PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${APP_PORT}`,
      env: { LMS_API_PROXY: `http://127.0.0.1:${API_PORT}` },
      reuseExistingServer: false,
    },
  ],
});
