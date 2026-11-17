const EXPENSE_NUMBER_SEQUENCE_MAX = 999_999;

export function formatExpenseCode(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > EXPENSE_NUMBER_SEQUENCE_MAX) {
    throw new RangeError("Expense sequence must be between 1 and 999999.");
  }
  return `EXP-${sequence.toString().padStart(6, "0")}`;
}
