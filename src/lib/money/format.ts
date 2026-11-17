import { fromMinor } from "./money";

const FORMATTER_CACHE_LIMIT = 32;
const formatterCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: string): Intl.NumberFormat {
  const cached = formatterCache.get(currency);
  if (cached) {
    formatterCache.delete(currency);
    formatterCache.set(currency, cached);
    return cached;
  }

  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  formatterCache.set(currency, formatter);
  if (formatterCache.size > FORMATTER_CACHE_LIMIT) {
    const oldestCurrency = formatterCache.keys().next().value;
    if (oldestCurrency !== undefined) formatterCache.delete(oldestCurrency);
  }
  return formatter;
}

/** Format minor units for display without converting the amount to a float. */
export function formatMoney(minor: number, currency: string): string {
  const decimal = fromMinor(minor);
  const separator = decimal.indexOf(".");
  const whole = decimal.slice(0, separator);
  const fraction = decimal.slice(separator + 1);
  const parts = getCurrencyFormatter(currency).formatToParts(BigInt(whole));

  return parts
    .map((part) => part.type === "fraction" ? fraction : part.value)
    .join("");
}
