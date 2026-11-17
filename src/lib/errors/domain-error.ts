export type BaseErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "INTERNAL";

/** Modules may use entity-specific not-found codes (e.g. INVOICE_NOT_FOUND), per docs/02-contracts.md. */
export type ErrorCode = BaseErrorCode | `${Uppercase<string>}_NOT_FOUND`;

export function isNotFound(code: string): boolean {
  return code === "NOT_FOUND" || code.endsWith("_NOT_FOUND");
}

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}
