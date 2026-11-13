import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { activityLogs, companies } from "@/db/schema";
import { loadActor } from "@/lib/auth/load-actor";
import { addDays, todayInTz } from "@/lib/dates";
import { createTask } from "@/modules/tasks";
import { getDashboard } from "@/modules/reports";
import { buildActor, createCompany, createUser, grantPermissions } from "@/test/factories";
import { MANAGER_KEYS, workWorld } from "@/test/work";
import { getCompanyProfile, getNumbering, getPreferences, updateCompanyProfile, updatePreferences } from "./service";

async function admin(keys = ["settings.read", "settings.manage"] as never[]) {
  const company = await createCompany({ legalName: "Old Legal", displayName: "Old" });
  const u = await createUser(company.id);
  await grantPermissions(company.id, u.id, keys, "Admin");
  return { company, actor: await loadActor(u.id) };
}

const valid = { legalName: "Automora Tech Solutions LLP", displayName: "Automora", email: "Hello@Automora.example", phone: "+91 20 5555 0100", address: "Pune, India", currency: "INR", timezone: "Asia/Kolkata" };

describe("company profile", () => {
  it("reads with settings.read and updates with settings.manage, auditing before/after", async () => {
    const a = await admin();
    expect((await getCompanyProfile(a.actor)).legalName).toBe("Old Legal");
    const updated = await updateCompanyProfile(a.actor, valid);
    expect(updated).toMatchObject({ legalName: "Automora Tech Solutions LLP", email: "hello@automora.example", timezone: "Asia/Kolkata" });
    const logs = await db.select().from(activityLogs).where(eq(activityLogs.companyId, a.company.id));
    const log = logs.find((l) => l.action === "settings.company_updated")!;
    expect(log.before).toMatchObject({ legalName: "Old Legal" });
    expect(log.after).toMatchObject({ legalName: "Automora Tech Solutions LLP" });
  });

  it("is denied without the right permissions", async () => {
    const reader = await admin(["settings.read"] as never[]);
    await expect(updateCompanyProfile(reader.actor, valid)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const none = buildActor({ companyId: reader.company.id });
    await expect(getCompanyProfile(none)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updatePreferences(none, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("validates names, email, currency and timezone", async () => {
    const a = await admin();
    await expect(updateCompanyProfile(a.actor, { ...valid, legalName: "" })).rejects.toThrow();
    await expect(updateCompanyProfile(a.actor, { ...valid, email: "nope" })).rejects.toThrow();
    await expect(updateCompanyProfile(a.actor, { ...valid, currency: "rupees" })).rejects.toThrow();
    await expect(updateCompanyProfile(a.actor, { ...valid, timezone: "Mars/Olympus" })).rejects.toThrow();
  });

  it("only changes the actor's own company", async () => {
    const a = await admin();
    const other = await createCompany({ legalName: "Untouched" });
    await updateCompanyProfile(a.actor, valid);
    const [row] = await db.select().from(companies).where(eq(companies.id, other.id));
    expect(row.legalName).toBe("Untouched");
  });
});

describe("timezone drives 'today' (AC-07)", () => {
  it("changing the company timezone changes the dashboard's overdue count", async () => {
    const w = await workWorld([...MANAGER_KEYS, "dashboard.company.read", "settings.read", "settings.manage"] as never[]);
    const pago = todayInTz("Pacific/Pago_Pago");
    expect(addDays(pago, 0)).toBe(pago);
    await createTask(w.manager, { title: "due today in Pago Pago", dueDate: pago });

    await updateCompanyProfile(w.manager, { ...valid, timezone: "Pacific/Pago_Pago" });
    const west = await getDashboard(await loadActor(w.managerUserId), { preset: "today" });
    await updateCompanyProfile(await loadActor(w.managerUserId), { ...valid, timezone: "Pacific/Kiritimati" });
    const east = await getDashboard(await loadActor(w.managerUserId), { preset: "today" });
    expect(west.counts.overdueTasks).toBe(0);
    expect(east.counts.overdueTasks).toBe(1);
  });
});

describe("preferences", () => {
  it("returns defaults, saves valid values and audits", async () => {
    const a = await admin();
    expect(await getPreferences(a.actor)).toEqual({ "tasks.defaultPriority": "Medium", "invoices.defaultDueDays": 30, "finance.requireSecondConfirmer": false });
    const saved = await updatePreferences(a.actor, { "tasks.defaultPriority": "High", "invoices.defaultDueDays": 15 });
    expect(saved).toEqual({ "tasks.defaultPriority": "High", "invoices.defaultDueDays": 15, "finance.requireSecondConfirmer": false });
    expect(await getPreferences(a.actor)).toEqual(saved);
    // partial update keeps the rest
    expect(await updatePreferences(a.actor, { "invoices.defaultDueDays": 45 })).toEqual({ "tasks.defaultPriority": "High", "invoices.defaultDueDays": 45, "finance.requireSecondConfirmer": false });
    const logs = await db.select().from(activityLogs).where(eq(activityLogs.companyId, a.company.id));
    expect(logs.filter((l) => l.action === "settings.preferences_updated")).toHaveLength(2);
  });

  it("rejects unknown keys and invalid values", async () => {
    const a = await admin();
    await expect(updatePreferences(a.actor, { "tasks.defaultPriority": "Critical" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updatePreferences(a.actor, { "invoices.defaultDueDays": -1 })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updatePreferences(a.actor, { "invoices.defaultDueDays": 1.5 })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updatePreferences(a.actor, { "evil.key": "x" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("keeps each company's preferences separate", async () => {
    const a = await admin();
    const b = await admin();
    await updatePreferences(a.actor, { "tasks.defaultPriority": "Urgent" });
    expect((await getPreferences(b.actor))["tasks.defaultPriority"]).toBe("Medium");
  });
});

describe("numbering (read-only)", () => {
  it("shows the next number for each code kind", async () => {
    const w = await workWorld([...MANAGER_KEYS, "settings.read"] as never[]);
    await createTask(w.manager, { title: "first" });
    await createTask(w.manager, { title: "second" });
    const rows = await getNumbering(w.manager);
    expect(rows.find((r) => r.kind === "TSK")).toMatchObject({ label: "Tasks", next: "TSK-000003" });
    expect(rows.find((r) => r.kind === "PRJ")!.next).toBe("PRJ-000001");
    expect(rows.map((r) => r.kind)).toEqual(["TSK", "PRJ", "CLI", "EMP", "INV", "EXP"]);
  });
});

describe("currency lock", () => {
  it("allows changing currency while there are no financial records", async () => {
    const a = await admin();
    const updated = await updateCompanyProfile(a.actor, { ...valid, currency: "USD" });
    expect(updated.currency).toBe("USD");
  });

  it("refuses to change currency once an invoice exists, but still allows other edits", async () => {
    const a = await admin();
    const { db: database } = await import("@/db");
    const { clients, invoices } = await import("@/db/schema");
    const [client] = await database.insert(clients).values({ companyId: a.company.id, clientCode: "CLI-X", name: "Billed" }).returning();
    await database.insert(invoices).values({ companyId: a.company.id, clientId: client.id, currency: "INR", status: "draft", subtotal: "0", discountTotal: "0", taxTotal: "0", total: "0" } as never);
    await expect(updateCompanyProfile(a.actor, { ...valid, currency: "USD" })).rejects.toMatchObject({ code: "CONFLICT" });
    const kept = await updateCompanyProfile(a.actor, { ...valid, currency: "INR", displayName: "Renamed" });
    expect(kept).toMatchObject({ currency: "INR", displayName: "Renamed" });
  });
});
