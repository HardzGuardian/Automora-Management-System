export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Office Supplies", description: "Stationery and general office supplies." },
  { name: "Software & Subscriptions", description: "Software licenses and recurring subscriptions." },
  { name: "Travel & Transport", description: "Business travel and local transport." },
  { name: "Meals & Accommodation", description: "Business meals and lodging." },
  { name: "Professional Services", description: "Legal, accounting, and other professional services." },
  { name: "Marketing", description: "Advertising, promotion, and marketing services." },
  { name: "Utilities", description: "Internet, electricity, and other workspace utilities." },
  { name: "Equipment", description: "Business equipment and related purchases." },
  { name: "Bank & Payment Fees", description: "Bank charges and payment processing fees." },
  { name: "Other", description: "Expenses that do not fit another category." },
] as const;

/** Produce idempotent-ready seed rows; the root seed inserts with conflict-do-nothing. */
export function defaultExpenseCategoryRows(companyId: string) {
  return DEFAULT_EXPENSE_CATEGORIES.map((category) => ({
    companyId,
    ...category,
    active: true as const,
  }));
}
