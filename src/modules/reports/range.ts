import { addDays, todayInTz } from "@/lib/dates";

export const RANGE_PRESETS = ["today", "week", "month", "quarter", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
export type ResolvedRange = { preset: RangePreset; from: string; to: string; today: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CUSTOM_DAYS = 366 * 5;

const isRealDate = (s: string) => DATE_RE.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const monthEnd = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Resolves a dashboard/report period in COMPANY-LOCAL dates (ADR-06): "today" is never UTC today.
 * Weeks run Monday to Sunday.
 */
export function resolveRange(
  preset: RangePreset,
  timezone: string,
  now: Date = new Date(),
  custom?: { from?: string; to?: string },
): ResolvedRange {
  const today = todayInTz(timezone, now);
  const [y, m] = today.split("-").map(Number);
  switch (preset) {
    case "today":
      return { preset, from: today, to: today, today };
    case "week": {
      const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
      const from = addDays(today, -dow);
      return { preset, from, to: addDays(from, 6), today };
    }
    case "month":
      return { preset, from: `${y}-${pad(m)}-01`, to: monthEnd(y, m), today };
    case "quarter": {
      const startMonth = Math.floor((m - 1) / 3) * 3 + 1;
      return { preset, from: `${y}-${pad(startMonth)}-01`, to: monthEnd(y, startMonth + 2), today };
    }
    case "custom": {
      const { from, to } = custom ?? {};
      if (!from || !to || !isRealDate(from) || !isRealDate(to)) throw new RangeError("Enter a valid start and end date");
      if (from > to) throw new RangeError("Start date must be on or before the end date");
      const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
      if (days > MAX_CUSTOM_DAYS) throw new RangeError("Choose a range of at most 5 years");
      return { preset, from, to, today };
    }
    default:
      throw new RangeError("Unknown range");
  }
}
