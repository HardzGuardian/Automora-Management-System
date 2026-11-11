import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

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
