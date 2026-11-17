import { createHash, randomBytes } from "node:crypto";

/** Single-use secret for invitations / resets. Only the SHA-256 hash is ever stored. */
export function generateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
