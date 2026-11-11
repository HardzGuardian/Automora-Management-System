import { DomainError } from "@/lib/errors";

export type FinanceActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export function financeActionFailure(error: unknown): FinanceActionResult<never> {
  if (error instanceof DomainError) return { ok: false, error: { code: error.code, message: error.message } };
  return { ok: false, error: { code: "INTERNAL_ERROR", message: "The finance action could not be completed." } };
}
