import { defineConfig, devices } from "@playwright/test";

const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://automora:automora@localhost:5433/automora_test";
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  globalSetup: "./e2e/global-setup.ts",
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      DATABASE_URL: TEST_DB,
      BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e-secret",
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      APP_URL: `http://localhost:${PORT}`,
      CRON_SECRET: "e2e-cron-secret-0123456789",
      ALLOW_LOCAL_PRODUCTION: "true",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
