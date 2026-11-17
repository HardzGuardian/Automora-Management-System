export type ExpensePaymentState = "pending" | "confirmed" | "reversed";

export class InvalidExpensePaymentTransitionError extends Error {
  constructor(from: ExpensePaymentState, to: ExpensePaymentState) {
    super(`Cannot transition expense payment from '${from}' to '${to}'.`);
    this.name = "InvalidExpensePaymentTransitionError";
  }
}

const allowedTransitions: Readonly<Record<ExpensePaymentState, readonly ExpensePaymentState[]>> = {
  pending: ["confirmed"],
  confirmed: ["reversed"],
  reversed: [],
};

export function transitionExpensePaymentState(
  current: ExpensePaymentState,
  next: ExpensePaymentState,
): ExpensePaymentState {
  if (!allowedTransitions[current].includes(next)) {
    throw new InvalidExpensePaymentTransitionError(current, next);
  }
  return next;
}
