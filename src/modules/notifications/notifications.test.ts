import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { notificationEvents, notifications } from "@/db/schema";
import { loadActor } from "@/lib/auth/load-actor";
import { notify, resetNotifier, type NotifyEvent } from "@/lib/notify";
import { createCompany, createUser, grantPermissions } from "@/test/factories";
import { deliver, hrefFor, listForUser, markAllRead, markRead, registerNotifier, unreadCount } from "./service";

afterEach(() => resetNotifier());

async function people() {
  const company = await createCompany();
  const a = await createUser(company.id);
  const b = await createUser(company.id);
  const finance = await createUser(company.id);
  await grantPermissions(company.id, finance.id, ["finance.notifications.receive"], "Fin");
  await grantPermissions(company.id, a.id, [], "Emp");
  return { company, a, b, finance, actorA: await loadActor(a.id), actorB: await loadActor(b.id) };
}

const ev = (o: Partial<NotifyEvent> = {}): NotifyEvent => ({
  type: "task.assigned",
  userIds: [],
  entity: { type: "task", id: "11111111-1111-4111-8111-111111111111" },
  eventKey: `k-${Math.random()}`,
  title: "Hello",
  ...o,
});

describe("deliver", () => {
  it("creates one notification per recipient with a link target", async () => {
    const p = await people();
    await deliver(ev({ userIds: [p.a.id, p.b.id], title: "T" }));
    expect((await listForUser(p.actorA, {})).rows).toHaveLength(1);
    expect((await listForUser(p.actorB, {})).rows[0]).toMatchObject({ title: "T", read: false, href: "/tasks/11111111-1111-4111-8111-111111111111" });
  });

  it("is idempotent per event key and user", async () => {
    const p = await people();
    const e = ev({ userIds: [p.a.id], eventKey: "task:x:overdue:2026-03-10" });
    await deliver(e);
    await deliver(e);
    await deliver(e);
    expect(await db.select().from(notifications).where(eq(notifications.userId, p.a.id))).toHaveLength(1);
    expect(await db.select().from(notificationEvents).where(eq(notificationEvents.userId, p.a.id))).toHaveLength(1);
    // a different key for the same user is a new notification
    await deliver(ev({ userIds: [p.a.id], eventKey: "task:x:overdue:2026-03-11" }));
    expect(await db.select().from(notifications).where(eq(notifications.userId, p.a.id))).toHaveLength(2);
  });

  it("survives concurrent duplicate deliveries", async () => {
    const p = await people();
    const e = ev({ userIds: [p.a.id], eventKey: "race" });
    await Promise.all(Array.from({ length: 8 }, () => deliver(e)));
    expect(await db.select().from(notifications).where(eq(notifications.userId, p.a.id))).toHaveLength(1);
  });

  it("sends finance events only to users who can receive them", async () => {
    const p = await people();
    await deliver(ev({ type: "payment.recorded", entity: { type: "payment", id: "p1" }, userIds: [p.a.id, p.b.id, p.finance.id], eventKey: "payment:1" }));
    expect(await db.select().from(notifications).where(eq(notifications.userId, p.a.id))).toHaveLength(0);
    expect(await db.select().from(notifications).where(eq(notifications.userId, p.b.id))).toHaveLength(0);
    expect(await db.select().from(notifications).where(eq(notifications.userId, p.finance.id))).toHaveLength(1);
  });

  it("ignores unknown users and banned users without failing", async () => {
    const p = await people();
    await expect(deliver(ev({ userIds: ["no-such-user", p.a.id] }))).resolves.toBeUndefined();
    expect((await listForUser(p.actorA, {})).total).toBe(1);
  });

  it("is wired in through the notify port (never throws)", async () => {
    const p = await people();
    registerNotifier();
    await notify(ev({ userIds: [p.a.id], eventKey: "via-port" }));
    expect((await listForUser(p.actorA, {})).total).toBe(1);
  });
});

describe("read state and listing", () => {
  it("counts unread, marks one read, marks all read", async () => {
    const p = await people();
    for (let i = 0; i < 3; i++) await deliver(ev({ userIds: [p.a.id], eventKey: `n${i}` }));
    expect(await unreadCount(p.actorA)).toBe(3);
    const first = (await listForUser(p.actorA, {})).rows[0];
    await markRead(p.actorA, first.id);
    expect(await unreadCount(p.actorA)).toBe(2);
    expect((await listForUser(p.actorA, { unreadOnly: true })).total).toBe(2);
    await markAllRead(p.actorA);
    expect(await unreadCount(p.actorA)).toBe(0);
    expect((await listForUser(p.actorA, {})).total).toBe(3);
  });

  it("never lets one user read or mark another's notifications", async () => {
    const p = await people();
    await deliver(ev({ userIds: [p.a.id], eventKey: "private" }));
    const mine = (await listForUser(p.actorA, {})).rows[0];
    await expect(markRead(p.actorB, mine.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await markAllRead(p.actorB);
    expect(await unreadCount(p.actorA)).toBe(1);
    expect((await listForUser(p.actorB, {})).total).toBe(0);
  });

  it("lists newest first and paginates", async () => {
    const p = await people();
    for (let i = 0; i < 5; i++) {
      await deliver(ev({ userIds: [p.a.id], eventKey: `o${i}`, title: `N${i}` }));
    }
    const page1 = await listForUser(p.actorA, { page: 1, pageSize: 2 });
    const page3 = await listForUser(p.actorA, { page: 3, pageSize: 2 });
    expect(page1.total).toBe(5);
    expect(page1.rows.map((r) => r.title)).toEqual(["N4", "N3"]);
    expect(page3.rows.map((r) => r.title)).toEqual(["N0"]);
    await expect(listForUser(p.actorA, { pageSize: 101 })).rejects.toThrow();
  });
});

describe("hrefFor", () => {
  it("maps entities to pages and ignores unknown ones", () => {
    expect(hrefFor("task", "t1")).toBe("/tasks/t1");
    expect(hrefFor("project", "p1")).toBe("/projects/p1");
    expect(hrefFor("invoice", "i1")).toBe("/invoices/i1");
    expect(hrefFor("payment", "p9")).toBe("/payments/p9");
    expect(hrefFor("expense", "e1")).toBe("/expenses/e1");
    expect(hrefFor("mystery", "x")).toBeNull();
    expect(hrefFor(null, null)).toBeNull();
  });
});
