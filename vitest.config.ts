import { config } from "dotenv";
import { defineConfig } from "vitest/config";
import path from "node:path";

config({ quiet: true });

const testDb = process.env.TEST_DATABASE_URL ?? "";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    globalSetup: ["src/test/global-setup.ts"],
    env: {
      DATABASE_URL: testDb,
      STORAGE_DRIVER: "local",
      CRON_SECRET: "test-cron-secret-0123456789",
      STORAGE_LOCAL_DIR: ".data/test-uploads",
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "test-secret-test-secret-test-secret-123",
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
      APP_URL: process.env.APP_URL ?? "http://localhost:3000",
    },
  },
});
