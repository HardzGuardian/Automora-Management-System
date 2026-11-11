import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { account, session, user } from "@/db/schema";
import { createCompany, createUser } from "@/test/factories";
import { auth } from "./auth";

const PASSWORD = "correct-horse-battery-1";

async function makeLoginUser(o: { role?: string; banned?: boolean } = {}) {
  const company = await createCompany();
  const email = `${randomUUID()}@test.local`;
  const u = await createUser(company.id, { email, role: o.role ?? null, banned: o.banned ?? false });
  const ctx = await auth.$context;
  await db.insert(account).values({
    id: randomUUID(),
    accountId: u.id,
    providerId: "credential",
    userId: u.id,
    password: await ctx.password.hash(PASSWORD),
  });
  return { u, email };
}

const signIn = (email: string, password: string, ip = "10.0.0.1") =>
  auth.handler(
    new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip, origin: "http://localhost:3000" },
      body: JSON.stringify({ email, password }),
    }),
  );

describe("better auth", () => {
  it("signs in with valid credentials and creates a session", async () => {
    const { u, email } = await makeLoginUser();
    const res = await signIn(email, PASSWORD, "10.1.0.1");
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/session_token/);
    const rows = await db.select().from(session).where(eq(session.userId, u.id));
    expect(rows).toHaveLength(1);
    const [fresh] = await db.select().from(user).where(eq(user.id, u.id));
    expect(fresh.lastLoginAt).not.toBeNull();
  });

  it("rejects a wrong password", async () => {
    const { email } = await makeLoginUser();
    const res = await signIn(email, "wrong-password-123", "10.2.0.1");
    expect(res.status).toBe(401);
  });

  it("rejects public sign-up", async () => {
    const res = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.3.0.1", origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "x@test.local", password: PASSWORD, name: "X" }),
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    const rows = await db.select().from(user).where(eq(user.email, "x@test.local"));
    expect(rows).toHaveLength(0);
  });

  it("does not let a suspended (banned) user sign in", async () => {
    const { email } = await makeLoginUser({ banned: true });
    const res = await signIn(email, PASSWORD, "10.4.0.1");
    expect(res.status).toBe(403);
  });

  it("banning through the admin API revokes existing sessions", async () => {
    const admin = await makeLoginUser({ role: "admin" });
    const target = await makeLoginUser();
    const targetRes = await signIn(target.email, PASSWORD, "10.5.0.1");
    expect(targetRes.status).toBe(200);
    const adminRes = await signIn(admin.email, PASSWORD, "10.5.0.2");
    const cookie = adminRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    await auth.api.banUser({ body: { userId: target.u.id }, headers: new Headers({ cookie }) });
    const rows = await db.select().from(session).where(eq(session.userId, target.u.id));
    expect(rows).toHaveLength(0);
  });

  it("rate limits repeated failed logins from one IP", async () => {
    const { email } = await makeLoginUser();
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await signIn(email, "bad-password-123", "10.6.0.1")).status);
    expect(statuses).toContain(429);
    expect(statuses[0]).toBe(401);
  });
});
