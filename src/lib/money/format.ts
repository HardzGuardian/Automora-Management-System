import { fromMinor } from "./money";

/** Format minor units for display without converting the amount to a float. */
export function formatMoney(minor: number, currency: string): string {
  const [whole, fraction] = fromMinor(minor).split(".");
  const parts = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(BigInt(whole));

  return parts
    .map((part) => part.type === "fraction" ? fraction : part.value)
    .join("");
}
