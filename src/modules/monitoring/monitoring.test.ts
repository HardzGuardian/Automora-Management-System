import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { securityEvents } from "@/db/schema";
import { buildActor, createCompany, createUser, grantPermissions } from "@/test/factories";
import { loadActor } from "@/lib/auth/load-actor";
import {
  getSecuritySummary,
  listSecurityEvents,
  recordJobFailure,
  recordLoginFailure,
  recordPermissionDenied,
  recordSecurityEvent,
  resetDenialThrottle,
  runMonitoredJob,
} from "./index";

async function admin() {
  const company = await createCompany();
  const u = await createUser(company.id);
  await grantPermissions(company.id, u.id, ["audit.read"], `Role ${randomUUID().slice(0, 6)}`);
  return { company, user: u, actor: await loadActor(u.id) };
}

/** Recording is fire-and-forget for denials, so give those inserts a moment to land. */
const settle = () => new Promise((r) => setTimeout(r, 150));
const rowsFor = (subject: string) => db.select().from(securityEvents).where(eq(securityEvents.subject, subject));

beforeEach(() => resetDenialThrottle());

describe("recording", () => {
  it("records a failed sign-in against a known user, attributed to their company", async () => {
    const a = await admin();
    await recordLoginFailure({ email: a.user.email.toUpperCase(), ip: "203.0.113.9", reason: "invalid" });
    const [row] = await rowsFor(a.user.email.toLowerCase());
    expect(row).toMatchObject({ type: "login_failed", companyId: a.company.id, actorId: a.user.id, ip: "203.0.113.9" });
    expect(row.detail).toEqual({ reason: "invalid" });
  });

  it("records an unknown email without a company, and a blocked attempt as login_blocked", async () => {
    const email = `nobody-${randomUUID()}@probe.test`;
    await recordLoginFailure({ email, ip: null, reason: "invalid" });
    await recordLoginFailure({ email, ip: null, reason: "too_many_attempts" });
    const rows = await rowsFor(email);
    expect(rows.map((r) => r.type).sort()).toEqual(["login_blocked", "login_failed"]);
    expect(rows.every((r) => r.companyId === null && r.actorId === null)).toBe(true);
  });

  it("records a failed job with its message and no company", async () => {
    const job = `job-${randomUUID()}`;
    await recordJobFailure(job, "x".repeat(900), { failures: 3 });
    const [row] = await rowsFor(job);
    expect(row.type).toBe("job_failed");
    expect(row.companyId).toBeNull();
    expect((row.detail as { message: string }).message).toHaveLength(500);
    expect((row.detail as { failures: number }).failures).toBe(3);
  });

  it("strips sensitive keys from the detail and truncates long text", async () => {
    const subject = `s-${randomUUID()}`;
    await recordSecurityEvent({
      type: "job_failed",
      subject: subject + "y".repeat(400),
      ip: "1".repeat(200),
      detail: { password: "hunter2", apiToken: "abc", nested: { secretKey: "z", ok: 1 }, note: "kept" },
    });
    const [row] = await db.select().from(securityEvents).where(eq(securityEvents.type, "job_failed")).orderBy(securityEvents.createdAt).limit(1000).then((r) => r.filter((x) => x.subject?.startsWith(subject)));
    expect(row.subject).toHaveLength(200);
    expect(row.ip).toHaveLength(64);
    expect(row.detail).toEqual({ nested: { ok: 1 }, note: "kept" });
  });

  it("never throws, even when the log rejects the row", async () => {
    await expect(recordSecurityEvent({ type: "bogus" as never })).resolves.toBeUndefined();
  });
});

describe("permission denials are throttled", () => {
  it("logs a repeated denial once per minute, but a different permission or person separately", async () => {
    const a = await admin();
    const perm = `tasks.update-${randomUUID().slice(0, 6)}`;
    const t0 = 1_000_000;
    recordPermissionDenied(a.actor, perm, t0);
    recordPermissionDenied(a.actor, perm, t0 + 5_000); // same person + permission within the window
    recordPermissionDenied(a.actor, `${perm}-other`, t0 + 6_000);
    const b = buildActor({ companyId: a.company.id, userId: (await createUser(a.company.id)).id });
    recordPermissionDenied(b, perm, t0 + 7_000);
    await settle();
    expect(await rowsFor(perm)).toHaveLength(2);
    expect(await rowsFor(`${perm}-other`)).toHaveLength(1);

    recordPermissionDenied(a.actor, perm, t0 + 61_000); // window passed
    await settle();
    expect(await rowsFor(perm)).toHaveLength(3);
    const [first] = await rowsFor(perm);
    expect(first).toMatchObject({ type: "permission_denied", companyId: a.company.id });
  });
});

describe("the append-only log", () => {
  it("cannot be edited or erased", async () => {
    const subject = `ao-${randomUUID()}`;
    await recordSecurityEvent({ type: "job_failed", subject });
    const [row] = await rowsFor(subject);
    await expect(db.update(securityEvents).set({ subject: "changed" }).where(eq(securityEvents.id, row.id))).rejects.toThrow();
    await expect(db.delete(securityEvents).where(eq(securityEvents.id, row.id))).rejects.toThrow();
    expect(await rowsFor(subject)).toHaveLength(1);
  });
});

describe("reading the log", () => {
  it("needs audit.read", async () => {
    const company = await createCompany();
    const u = await createUser(company.id);
    await grantPermissions(company.id, u.id, ["tasks.comment"], "Plain");
    const plain = await loadActor(u.id);
    await expect(listSecurityEvents(plain)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getSecuritySummary(plain)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("shows the admin's company and unattributed events, never another company's", async () => {
    const mine = await admin();
    const theirs = await admin();
    await recordSecurityEvent({ type: "permission_denied", companyId: mine.company.id, subject: "mine" });
    await recordSecurityEvent({ type: "permission_denied", companyId: theirs.company.id, subject: "theirs" });
    await recordSecurityEvent({ type: "login_failed", companyId: null, subject: "stranger@probe.test" });
    const subjects = (await listSecurityEvents(mine.actor, { pageSize: 100 })).rows.map((r) => r.subject);
    expect(subjects).toContain("mine");
    expect(subjects).toContain("stranger@probe.test");
    expect(subjects).not.toContain("theirs");
  });

  it("filters by type, orders newest first and pages", async () => {
    const a = await admin();
    for (let i = 0; i < 5; i++) await recordSecurityEvent({ type: "permission_denied", companyId: a.company.id, subject: `p${i}` });
    await recordSecurityEvent({ type: "login_failed", companyId: a.company.id, subject: "l0" });
    const denied = await listSecurityEvents(a.actor, { type: "permission_denied", pageSize: 3 });
    expect(denied.rows).toHaveLength(3);
    expect(denied.rows.every((r) => r.type === "permission_denied")).toBe(true);
    expect(denied.total).toBeGreaterThanOrEqual(5);
    const newest = denied.rows[0].createdAt.getTime();
    expect(denied.rows.every((r) => r.createdAt.getTime() <= newest)).toBe(true);
    const page2 = await listSecurityEvents(a.actor, { type: "permission_denied", pageSize: 3, page: 2 });
    expect(page2.rows.map((r) => r.id)).not.toEqual(expect.arrayContaining(denied.rows.map((r) => r.id)));
    // an unknown type is ignored, not an error
    expect((await listSecurityEvents(a.actor, { type: "nonsense", pageSize: 100 })).total).toBeGreaterThanOrEqual(6);
  });

  it("counts the last 24 hours per type, leaving out older events", async () => {
    const a = await admin();
    await recordSecurityEvent({ type: "login_failed", companyId: a.company.id });
    await recordSecurityEvent({ type: "login_failed", companyId: a.company.id });
    await recordSecurityEvent({ type: "permission_denied", companyId: a.company.id });
    await db.insert(securityEvents).values({ type: "job_failed", companyId: a.company.id, createdAt: new Date(Date.now() - 48 * 3_600_000) });
    const s = await getSecuritySummary(a.actor);
    expect(s.login_failed).toBeGreaterThanOrEqual(2);
    expect(s.permission_denied).toBeGreaterThanOrEqual(1);
    // the 48h-old job failure for this company is not counted (other tests may add recent null-company ones)
    const later = await getSecuritySummary(a.actor, new Date(Date.now() + 72 * 3_600_000));
    expect(later.login_failed).toBe(0);
  });
});

describe("runMonitoredJob", () => {
  it("passes a clean run through without recording anything", async () => {
    const job = `clean-${randomUUID()}`;
    const result = await runMonitoredJob(job, async () => ({ sent: 3, failures: [] as string[] }));
    expect(result).toEqual({ sent: 3, failures: [] });
    expect(await rowsFor(job)).toHaveLength(0);
  });

  it("records partial failures but returns the result so the route can answer 207", async () => {
    const job = `partial-${randomUUID()}`;
    const result = await runMonitoredJob(job, async () => ({ sent: 1, failures: ["a", "b"] }));
    expect(result.failures).toHaveLength(2);
    const [row] = await rowsFor(job);
    expect(row).toMatchObject({ type: "job_failed" });
    expect(row.detail).toMatchObject({ message: "2 item(s) failed", failures: 2 });
  });

  it("records a thrown error and rethrows it unchanged", async () => {
    const job = `boom-${randomUUID()}`;
    const boom = new Error("database went away");
    await expect(runMonitoredJob(job, async () => { throw boom; })).rejects.toBe(boom);
    const [row] = await rowsFor(job);
    expect(row.detail).toMatchObject({ message: "database went away" });
  });
});
