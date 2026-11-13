import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger";

function capture(fn: () => void): Record<string, unknown> {
  const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const errSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  try {
    fn();
    const calls = [...spy.mock.calls, ...errSpy.mock.calls];
    expect(calls).toHaveLength(1);
    return JSON.parse(String(calls[0][0]).trim()) as Record<string, unknown>;
  } finally {
    spy.mockRestore();
    errSpy.mockRestore();
  }
}

afterEach(() => vi.restoreAllMocks());

describe("logger", () => {
  it("writes one JSON line with level, message and timestamp", () => {
    const line = capture(() => logger.info("hello", { jobs: 3 }));
    expect(line).toMatchObject({ level: "info", message: "hello", jobs: 3 });
    expect(Number.isNaN(Date.parse(String(line.timestamp)))).toBe(false);
  });

  it("supports warn and error levels", () => {
    expect(capture(() => logger.warn("w")).level).toBe("warn");
    expect(capture(() => logger.error("e")).level).toBe("error");
  });

  it("redacts sensitive keys recursively", () => {
    const line = capture(() =>
      logger.info("x", {
        password: "p",
        nested: { apiToken: "t", list: [{ Authorization: "a" }], ok: 1 },
        cookie: "c",
        secretKey: "s",
        passwordHash: "h",
      }),
    );
    const text = JSON.stringify(line);
    for (const leaked of ['"p"', '"t"', '"a"', '"c"', '"s"', '"h"']) expect(text).not.toContain(leaked);
    expect((line.nested as { ok: number }).ok).toBe(1);
    expect(line.password).toBe("[redacted]");
  });

  it("serialises Error values without throwing", () => {
    const line = capture(() => logger.error("boom", { err: new Error("bad thing") }));
    expect((line.err as { message: string }).message).toBe("bad thing");
  });

  it("never throws on circular or unserialisable input", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => logger.error("c", { circular, big: 10n })).not.toThrow();
  });
});
