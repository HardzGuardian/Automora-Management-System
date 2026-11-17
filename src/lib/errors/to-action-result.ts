import { z } from "zod";
import { DomainError, type ErrorCode } from "./domain-error";

export type ActionError = {
  code: ErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export async function toActionResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof DomainError) {
      return { ok: false, error: { code: e.code, message: e.message } };
    }
    if (e instanceof z.ZodError) {
      const fieldErrors = z.flattenError(e).fieldErrors as Record<string, string[]>;
      return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors } };
    }
    return { ok: false, error: { code: "INTERNAL", message: "Something went wrong" } };
  }
}
