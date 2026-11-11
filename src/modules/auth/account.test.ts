import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { account, activityLogs, session } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import { loadActor } from "@/lib/auth/load-actor";
import { createCompany, createUser } from "@/test/factories";
import { changePassword, listMySessions, revokeSession } from "./account";

const PASSWORD = "current-password-12";
const NEXT = "another-password-34";
let ip = 0;
const post = (path: string, body: unknown) =>
  auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": `10.90.${Math.floor(ip / 250)}.${(ip++ % 250) + 1}` },
      body: JSON.stringify(body),
    }),
  );

async function makeUser(companyId?: string) {
  const cid = companyId ?? (await createCompany()).id;
  const email = `${randomUUID()}@test.local`;
  const u = await createUser(cid, { email });
  await db.insert(account).values({
    id: randomUUID(),
    accountId: u.id,
    providerId: "credential",
    userId: u.id,
    password: await (await auth.$context).password.hash(PASSWORD),
  });
  return { u, email };
}

async function login(email: string, password = PASSWORD) {
  const res = await post("/sign-in/email", { email, password });
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return { status: res.status, headers: new Headers({ cookie }) };
}

describe("changePassword", () => {
  it("rejects a wrong current password", async () => {
    const { u } = await makeUser();
    const actor = await loadActor(u.id);
    await expect(changePassword(actor, { current: "wrong-password-00", next: NEXT })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects a weak new password", async () => {
    const { u } = await makeUser();
    await expect(changePassword(await loadActor(u.id), { current: PASSWORD, next: "short" })).rejects.toThrow();
  });

  it("changes the password, keeps the current session and revokes the others", async () => {
    const { u, email } = await makeUser();
    const a = await login(email);
    await login(email);
    await login(email);
    const rows = await db.select().from(session).where(eq(session.userId, u.id));
    expect(rows).toHaveLength(3);
    const keep = rows[0];
    await changePassword(await loadActor(u.id), { current: PASSWORD, next: NEXT, keepSessionId: keep.id });
    expect(await db.select().from(session).where(eq(session.userId, u.id))).toHaveLength(1);
    expect((await login(email, PASSWORD)).status).toBe(401);
    expect((await login(email, NEXT)).status).toBe(200);
    void a;
    const logs = await db.select().from(activityLogs).where(eq(activityLogs.entityId, u.id));
    expect(logs.map((l) => l.action)).toContain("user.password_changed");
    expect(JSON.stringify(logs)).not.toContain(NEXT);
  });
});

describe("sessions", () => {
  it("lists only my own sessions and flags the current one", async () => {
    const mine = await makeUser();
    const other = await makeUser();
    await login(mine.email);
    await login(mine.email);
    await login(other.email);
    const rows = await db.select().from(session).where(eq(session.userId, mine.u.id));
    const list = await listMySessions(await loadActor(mine.u.id), rows[0].id);
    expect(list).toHaveLength(2);
    expect(list.filter((s) => s.isCurrent)).toHaveLength(1);
    expect(list.every((s) => !("token" in s))).toBe(true);
  });

  it("revoking a session makes it unusable on the next request", async () => {
    const { u, email } = await makeUser();
    const s = await login(email);
    expect(await auth.api.getSession({ headers: s.headers })).not.toBeNull();
    const [row] = await db.select().from(session).where(eq(session.userId, u.id));
    await revokeSession(await loadActor(u.id), row.id);
    expect(await auth.api.getSession({ headers: s.headers })).toBeNull();
  });

  it("cannot revoke someone else's session (NOT_FOUND)", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await login(b.email);
    const [theirs] = await db.select().from(session).where(eq(session.userId, b.u.id));
    await expect(revokeSession(await loadActor(a.u.id), theirs.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await db.select().from(session).where(eq(session.id, theirs.id))).toHaveLength(1);
  });
});
