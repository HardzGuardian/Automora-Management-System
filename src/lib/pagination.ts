/** Reads `?page=` safely: whole number between 1 and `max`; anything odd (1.5, 1e21, "abc", arrays) becomes a valid page. */
export function parsePage(raw: string | string[] | undefined, max = 10_000): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(max, Math.max(1, Math.trunc(n)));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a canonical UUID string. Use before passing a URL segment to a uuid column. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
