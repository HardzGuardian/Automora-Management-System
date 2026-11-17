import { fromMinor, toMinor } from "@/lib/money";

/**
 * Normalises what a person types into a canonical amount string ("1234.50"), or null if it is
 * not a valid non-negative amount with at most 2 decimals. Goes through lib/money so rounding
 * rules live in one place. Accepts spaces and thousands commas.
 */
export function parseMoneyInput(raw: string): string | null {
  const cleaned = raw.trim().replace(/[\s,]/g, "");
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(cleaned)) return null;
  try {
    return fromMinor(toMinor(cleaned));
  } catch {
    return null;
  }
}
