import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 1,
  timeout: 45_000,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    // The dist dir is passed via `env`, not a "VAR=value cmd" prefix. That
    // prefix is POSIX shell syntax; Playwright spawns this through the platform
    // shell, so on Windows cmd.exe read "NEXT_DIST_DIR" as a command name and
    // the whole suite failed to start. `env` applies on every platform.
    command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3100",
    env: { NEXT_DIST_DIR: ".next-e2e" },
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
