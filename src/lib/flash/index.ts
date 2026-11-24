import "server-only";
import { cookies } from "next/headers";
import { toActionResult, type ActionResult } from "@/lib/errors";

export const FLASH_COOKIE = "automora_flash";
export type Flash = { message: string; tone: "success" | "error" };

/** Queue a one-shot message that the workspace layout shows as a toast on the next render. */
export async function setFlash(message: string, tone: Flash["tone"] = "error"): Promise<void> {
  const jar = await cookies();
  jar.set(FLASH_COOKIE, encodeURIComponent(JSON.stringify({ message, tone })), { path: "/", maxAge: 60, httpOnly: false, sameSite: "lax" });
}

export async function readFlash(): Promise<Flash | null> {
  const jar = await cookies();
  const raw = jar.get(FLASH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Flash;
    return typeof v.message === "string" && (v.tone === "error" || v.tone === "success") ? v : null;
  } catch {
    return null;
  }
}

/** Like toActionResult, but a failure is also shown to the user as a toast instead of being swallowed. */
export async function flashed<T>(fn: () => Promise<T>, successMessage?: string): Promise<ActionResult<T>> {
  const r = await toActionResult(fn);
  if (!r.ok) await setFlash(r.error.fieldErrors ? Object.values(r.error.fieldErrors).flat()[0] ?? r.error.message : r.error.message, "error");
  else if (successMessage) await setFlash(successMessage, "success");
  return r;
}
