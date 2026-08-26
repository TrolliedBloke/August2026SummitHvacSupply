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
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      // Run the suite with NO Supabase credentials, deliberately.
      //
      // The live-inventory overlay degrades to "uncounted" without them, which
      // is the state these assertions were written against -- notably "landing
      // page never claims a stock count the catalog cannot verify". Once a
      // developer has a .env.local, Next would load it here and the homepage
      // would legitimately render a real count, failing that test for the wrong
      // reason. Next does not override variables already present in the
      // environment, so setting them empty pins the suite to the uncounted path
      // whether or not .env.local exists.
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    },
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
