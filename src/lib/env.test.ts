import { describe, expect, it } from "vitest";
import { assertProductionEnv, parseEnv } from "./env";

const valid = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  APP_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("throws listing missing DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
  it("SEED_DEMO defaults to false and parses 'true'", () => {
    expect(parseEnv(valid).SEED_DEMO).toBe(false);
    expect(parseEnv({ ...valid, SEED_DEMO: "true" }).SEED_DEMO).toBe(true);
  });
  it("UPLOAD_MAX_BYTES defaults to 10485760", () => {
    expect(parseEnv(valid).UPLOAD_MAX_BYTES).toBe(10485760);
  });
});

describe("assertProductionEnv", () => {
  const prod = {
    ...valid,
    NODE_ENV: "production",
    BETTER_AUTH_SECRET: "k9Fj2mQx8LpZr4TvB7nWc1YdHs6EaUo3",
    BETTER_AUTH_URL: "https://app.example.com",
    APP_URL: "https://app.example.com",
    CRON_SECRET: "a-long-cron-secret-123",
    STORAGE_DRIVER: "s3",
    S3_BUCKET: "bucket",
    S3_ACCESS_KEY_ID: "id",
    S3_SECRET_ACCESS_KEY: "secret",
  };
  const run = (over: Record<string, string | undefined> = {}) => assertProductionEnv(parseEnv({ ...prod, ...over }));

  it("accepts a valid production config", () => {
    expect(() => run()).not.toThrow();
  });
  it("does nothing outside production", () => {
    expect(() => assertProductionEnv(parseEnv({ ...valid, NODE_ENV: "development" }))).not.toThrow();
    expect(() => assertProductionEnv(parseEnv(valid))).not.toThrow();
  });
  it("rejects placeholder or short secrets", () => {
    expect(() => run({ BETTER_AUTH_SECRET: "change-me-to-a-random-string-of-32-chars-or-more" })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => run({ BETTER_AUTH_SECRET: "x".repeat(32) })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => run({ CRON_SECRET: "short" })).toThrow(/CRON_SECRET/);
  });
  it("requires https urls", () => {
    expect(() => run({ BETTER_AUTH_URL: "http://app.example.com" })).toThrow(/BETTER_AUTH_URL/);
    expect(() => run({ APP_URL: "http://app.example.com" })).toThrow(/APP_URL/);
  });
  it("requires s3 storage with credentials", () => {
    expect(() => run({ STORAGE_DRIVER: "local" })).toThrow(/STORAGE_DRIVER/);
    expect(() => run({ S3_ACCESS_KEY_ID: undefined })).toThrow(/S3_ACCESS_KEY_ID/);
    expect(() => run({ S3_SECRET_ACCESS_KEY: undefined })).toThrow(/S3_SECRET_ACCESS_KEY/);
  });
  it("forbids demo seeding", () => {
    expect(() => run({ SEED_DEMO: "true" })).toThrow(/SEED_DEMO/);
  });
  it("reports every problem at once", () => {
    expect(() => run({ CRON_SECRET: "", SEED_DEMO: "true" })).toThrow(/CRON_SECRET.*SEED_DEMO/s);
  });
});

describe("assertProductionEnv local opt-out", () => {
  const prodBase = { DATABASE_URL: "postgres://u:p@h/db", BETTER_AUTH_SECRET: "x".repeat(40), BETTER_AUTH_URL: "http://localhost:3100", APP_URL: "http://localhost:3100", NODE_ENV: "production" };
  it("allows a local production build only with the flag and only on localhost", async () => {
    const { assertProductionEnv, parseEnv } = await import("./env");
    expect(() => assertProductionEnv(parseEnv(prodBase))).toThrow();
    expect(() => assertProductionEnv(parseEnv({ ...prodBase, ALLOW_LOCAL_PRODUCTION: "true" }))).not.toThrow();
    expect(() =>
      assertProductionEnv(parseEnv({ ...prodBase, ALLOW_LOCAL_PRODUCTION: "true", APP_URL: "http://app.example.com", BETTER_AUTH_URL: "http://app.example.com" })),
    ).toThrow();
  });
});
