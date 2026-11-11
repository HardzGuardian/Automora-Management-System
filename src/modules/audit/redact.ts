const DENY = /pass(word)?|token|secret|hash|credential/i;

/** Recursively removes sensitive keys before anything is written to audit JSON. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !DENY.test(k))
        .map(([k, v]) => [k, redact(v)]),
    );
  }
  return value;
}
