import type { InvoiceLifecycleState } from "./balance";

export class InvalidInvoiceTransitionError extends Error {
  constructor(from: InvoiceLifecycleState, to: InvoiceLifecycleState) {
    super(`Cannot transition invoice from '${from}' to '${to}'.`);
    this.name = "InvalidInvoiceTransitionError";
  }
}

const allowedTransitions: Readonly<Record<InvoiceLifecycleState, readonly InvoiceLifecycleState[]>> = {
  draft: ["issued", "cancelled"],
  issued: ["cancelled"],
  cancelled: [],
};

/** Transition only persisted lifecycle state; payment-derived statuses are computed separately. */
export function transitionInvoiceState(
  current: InvoiceLifecycleState,
  next: InvoiceLifecycleState,
): InvoiceLifecycleState {
  if (!allowedTransitions[current].includes(next)) {
    throw new InvalidInvoiceTransitionError(current, next);
  }
  return next;
}
