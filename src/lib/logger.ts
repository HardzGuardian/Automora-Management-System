type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const SENSITIVE = /pass|token|secret|hash|credential|authorization|cookie/i;
const MAX_DEPTH = 6;

function sanitize(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return "[circular]";
  if (depth >= MAX_DEPTH) return "[truncated]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1, seen));
  const out: Fields = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE.test(k) ? "[redacted]" : sanitize(v, depth + 1, seen);
  }
  return out;
}

function write(level: Level, message: string, fields?: Fields): void {
  try {
    const body = fields ? (sanitize(fields, 0, new WeakSet()) as Fields) : {};
    const line = JSON.stringify({ ...body, timestamp: new Date().toISOString(), level, message });
    (level === "error" ? process.stderr : process.stdout).write(`${line}\n`);
  } catch {
    // logging must never break the caller
  }
}

/** Structured JSON-line logger. Sensitive keys are redacted; never throws. */
export const logger = {
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};
