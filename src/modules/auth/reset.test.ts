import { randomUUID } from "node:crypto";
import { eq, like } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { account, session, verification } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import { createCompany, createUser } from "@/test/factories";

const OLD = "old-password-123456";
const NEW = "brand-new-password-1";
let ipCounter = 0;
const nextIp = () => `10.80.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

const post = (path: string, body: unknown, ip = nextIp()) =>
  auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );

async function makeUser() {
  const c = await createCompany();
  const email = `${randomUUID()}@test.local`;
  const u = await createUser(c.id, { email });
  await db.insert(account).values({
    id: randomUUID(),
    accountId: u.id,
    providerId: "credential",
    userId: u.id,
    password: await (await auth.$context).password.hash(OLD),
  });
  return { u, email };
}

async function resetTokenFor(userId: string): Promise<string> {
  const rows = await db.select().from(verification).where(like(verification.identifier, "reset-password:%"));
  const row = rows.find((r) => r.value === userId);
  if (!row) throw new Error("no reset token issued");
  return row.identifier.replace("reset-password:", "");
}

const requestReset = (email: string, ip?: string) =>
  post("/request-password-reset", { email, redirectTo: "http://localhost:3000/reset-password" }, ip);

describe("forgot / reset password", () => {
  it("answers identically for known and unknown emails (no enumeration)", async () => {
    const { email } = await makeUser();
    const known = await requestReset(email);
    const unknown = await requestReset("nobody-here@test.local");
    expect(known.status).toBe(unknown.status);
    expect(await known.json()).toEqual(await unknown.json());
  });

  it("resets the password; the old one stops working and the new one works", async () => {
    const { u, email } = await makeUser();
    await requestReset(email);
    const token = await resetTokenFor(u.id);
    expect((await post("/reset-password", { newPassword: NEW, token })).status).toBe(200);
    expect((await post("/sign-in/email", { email, password: OLD })).status).toBe(401);
    expect((await post("/sign-in/email", { email, password: NEW })).status).toBe(200);
  });

  it("rejects a replayed reset token", async () => {
    const { u, email } = await makeUser();
    await requestReset(email);
    const token = await resetTokenFor(u.id);
    expect((await post("/reset-password", { newPassword: NEW, token })).status).toBe(200);
    const replay = await post("/reset-password", { newPassword: "another-password-99", token });
    expect(replay.status).toBeGreaterThanOrEqual(400);
    expect((await post("/sign-in/email", { email, password: "another-password-99" })).status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const { u, email } = await makeUser();
    await requestReset(email);
    const token = await resetTokenFor(u.id);
    await db.update(verification).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(verification.identifier, `reset-password:${token}`));
    expect((await post("/reset-password", { newPassword: NEW, token })).status).toBeGreaterThanOrEqual(400);
  });

  it("revokes existing sessions after a reset", async () => {
    const { u, email } = await makeUser();
    expect((await post("/sign-in/email", { email, password: OLD })).status).toBe(200);
    expect(await db.select().from(session).where(eq(session.userId, u.id))).toHaveLength(1);
    await requestReset(email);
    const token = await resetTokenFor(u.id);
    await post("/reset-password", { newPassword: NEW, token });
    expect(await db.select().from(session).where(eq(session.userId, u.id))).toHaveLength(0);
  });

  it("rejects a too-short new password", async () => {
    const { u, email } = await makeUser();
    await requestReset(email);
    const token = await resetTokenFor(u.id);
    expect((await post("/reset-password", { newPassword: "short", token })).status).toBeGreaterThanOrEqual(400);
  });

  it("rate limits reset requests from one IP", async () => {
    const { email } = await makeUser();
    const ip = "10.99.0.1";
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await requestReset(email, ip)).status);
    expect(statuses).toContain(429);
  });
});
