import { add, fromMinor, sub, toMinor } from "../../../lib/money";

export type CashMovementRow = {
  date: string;
  currency: string;
  confirmedReceipts: string;
  confirmedExpensePayments: string;
  netCashMovement: string;
};

export type ProjectFinanceCurrencySummary = {
  currency: string;
  confirmedReceipts: string;
  confirmedExpensePayments: string;
  netCashMovement: string;
};

export function combineCashMovementRows(
  receipts: readonly { date: string; currency: string; amount: string }[],
  outflows: readonly { date: string; currency: string; amount: string }[],
): CashMovementRow[] {
  const groups = new Map<string, { date: string; currency: string; receipts: number; outflows: number }>();
  for (const [rows, field] of [[receipts, "receipts"], [outflows, "outflows"]] as const) {
    for (const row of rows) {
      const key = `${row.date}:${row.currency}`;
      const value = groups.get(key) ?? { date: row.date, currency: row.currency, receipts: 0, outflows: 0 };
      value[field] = add(value[field], toMinor(row.amount));
      groups.set(key, value);
    }
  }
  return [...groups.values()].sort((left, right) => left.date.localeCompare(right.date) || left.currency.localeCompare(right.currency)).map((row) => ({
    date: row.date,
    currency: row.currency,
    confirmedReceipts: fromMinor(row.receipts),
    confirmedExpensePayments: fromMinor(row.outflows),
    netCashMovement: fromMinor(sub(row.receipts, row.outflows)),
  }));
}

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
