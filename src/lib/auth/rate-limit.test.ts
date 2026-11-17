import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { consumeRateLimit, isRateLimited } from "./rate-limit";

const key = () => `test:${randomUUID()}`;

describe("consumeRateLimit", () => {
  it("allows up to the limit within the window, then refuses", async () => {
    const k = key();
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await consumeRateLimit(k, 3, 60_000));
    expect(results).toEqual([true, true, true, false, false]);
  });

  it("starts a fresh window once the old one has passed", async () => {
    const k = key();
    const t0 = 1_000_000;
    expect(await consumeRateLimit(k, 1, 60_000, t0)).toBe(true);
    expect(await consumeRateLimit(k, 1, 60_000, t0 + 1_000)).toBe(false);
    expect(await consumeRateLimit(k, 1, 60_000, t0 + 61_000)).toBe(true);
  });

  it("keeps separate counters per key", async () => {
    const a = key();
    const b = key();
    expect(await consumeRateLimit(a, 1, 60_000)).toBe(true);
    expect(await consumeRateLimit(a, 1, 60_000)).toBe(false);
    expect(await consumeRateLimit(b, 1, 60_000)).toBe(true);
  });

  it("counts concurrent requests exactly (atomic increments)", async () => {
    const k = key();
    const results = await Promise.all(Array.from({ length: 20 }, () => consumeRateLimit(k, 5, 60_000)));
    expect(results.filter(Boolean)).toHaveLength(5);
  });
});

describe("isRateLimited", () => {
  it("reports exhaustion without counting, and clears after the window", async () => {
    const k = key();
    const t0 = 5_000_000;
    expect(await isRateLimited(k, 2, 60_000, t0)).toBe(false);
    await consumeRateLimit(k, 2, 60_000, t0);
    expect(await isRateLimited(k, 2, 60_000, t0)).toBe(false);
    await consumeRateLimit(k, 2, 60_000, t0);
    expect(await isRateLimited(k, 2, 60_000, t0 + 10)).toBe(true);
    expect(await isRateLimited(k, 2, 60_000, t0 + 10)).toBe(true); // checking does not count
    expect(await isRateLimited(k, 2, 60_000, t0 + 61_000)).toBe(false);
  });
});
