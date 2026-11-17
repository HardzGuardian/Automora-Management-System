export type PaymentState = "pending" | "confirmed" | "reversed";

export class InvalidPaymentTransitionError extends Error {
  constructor(from: PaymentState, to: PaymentState) {
    super(`Cannot transition payment from '${from}' to '${to}'.`);
    this.name = "InvalidPaymentTransitionError";
  }
}

const allowedTransitions: Readonly<Record<PaymentState, readonly PaymentState[]>> = {
  pending: ["confirmed"],
  confirmed: ["reversed"],
  reversed: [],
};

export function transitionPaymentState(current: PaymentState, next: PaymentState): PaymentState {
  if (!allowedTransitions[current].includes(next)) {
    throw new InvalidPaymentTransitionError(current, next);
  }
  return next;
}
