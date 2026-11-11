import { add, fromMinor, sub, toMinor } from "../../../lib/money";
export type ProjectFinanceCurrencySummary = {
  currency: string;
  confirmedReceipts: string;
  confirmedExpensePayments: string;
  netCashMovement: string;
};

export function calculateProjectCashNet(
  receipts: readonly { currency: string; amount: string }[],
  expensesPaid: readonly { currency: string; amount: string }[],
): ProjectFinanceCurrencySummary[] {
  const currencies = new Map<string, { receipts: number; outflow: number }>();
  for (const row of receipts) {
    const values = currencies.get(row.currency) ?? { receipts: 0, outflow: 0 };
    values.receipts = add(values.receipts, toMinor(row.amount));
    currencies.set(row.currency, values);
  }
  for (const row of expensesPaid) {
    const values = currencies.get(row.currency) ?? { receipts: 0, outflow: 0 };
    values.outflow = add(values.outflow, toMinor(row.amount));
    currencies.set(row.currency, values);
  }
  return [...currencies.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([currency, values]) => ({
    currency,
    confirmedReceipts: fromMinor(values.receipts),
    confirmedExpensePayments: fromMinor(values.outflow),
    netCashMovement: fromMinor(sub(values.receipts, values.outflow)),
  }));
}
