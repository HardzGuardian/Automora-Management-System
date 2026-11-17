import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, employees, permissions, projects, rolePermissions, taskAssignees, tasks, user, userRoles } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { loadActor } from "@/lib/auth/load-actor";
import { addDays, overdueCondition, todayInTz, upcomingCondition } from "@/lib/dates";
import { listInvoices } from "@/modules/finance";
import { deliver } from "./service";

export type ReminderFailure = { companyId: string; section: string; message: string };
export type ReminderResult = { companies: number; failures: ReminderFailure[] };
export type ReminderSection = "tasks" | "projects" | "invoices";

const DUE_SOON_DAYS = 2;
const PROJECT_DUE_DAYS = 3;
const INVOICE_DUE_DAYS = 3;

async function taskReminders(companyId: string, today: string): Promise<void> {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      userId: employees.userId,
      overdue: sql<boolean>`${overdueCondition(today)}`,
    })
    .from(tasks)
    .innerJoin(taskAssignees, and(eq(taskAssignees.taskId, tasks.id), eq(taskAssignees.companyId, tasks.companyId)))
    .innerJoin(employees, and(eq(employees.id, taskAssignees.employeeId), eq(employees.companyId, tasks.companyId)))
    .where(
      and(
        eq(tasks.companyId, companyId),
        isNull(tasks.archivedAt),
        sql`${employees.userId} IS NOT NULL`,
        sql`(${overdueCondition(today)} OR ${upcomingCondition(today, DUE_SOON_DAYS)})`,
      ),
    );
  for (const r of rows) {
    if (!r.userId || !r.dueDate) continue;
    if (r.overdue) {
      await deliver({
        type: "task.overdue",
        userIds: [r.userId],
        entity: { type: "task", id: r.id },
        eventKey: `task:${r.id}:overdue:${today}`, // a daily nudge while the task stays overdue
        title: `Overdue: ${r.title}`,
        body: `Was due ${r.dueDate}.`,
      });
    } else {
      await deliver({
        type: "task.due_soon",
        userIds: [r.userId],
        entity: { type: "task", id: r.id },
        eventKey: `task:${r.id}:duesoon:${r.dueDate}`, // once per due date
        title: `Due soon: ${r.title}`,
        body: `Due ${r.dueDate}.`,
      });
    }
  }
}

async function projectReminders(companyId: string, today: string): Promise<void> {
  const horizon = addDays(today, PROJECT_DUE_DAYS);
  const rows = await db
    .select({ id: projects.id, name: projects.name, dueDate: projects.dueDate, userId: employees.userId })
    .from(projects)
    .innerJoin(employees, and(eq(employees.id, projects.ownerEmployeeId), eq(employees.companyId, projects.companyId)))
    .where(
      and(
        eq(projects.companyId, companyId),
        isNull(projects.archivedAt),
        inArray(projects.status, ["Planning", "Active", "On Hold"]),
        sql`${projects.dueDate} IS NOT NULL AND ${projects.dueDate} <= ${horizon}::date`,
        sql`${employees.userId} IS NOT NULL`,
      ),
    );
  for (const r of rows) {
    if (!r.userId || !r.dueDate) continue;
    const late = r.dueDate < today;
    await deliver({
      type: late ? "project.overdue" : "project.due_soon",
      userIds: [r.userId],
      entity: { type: "project", id: r.id },
      eventKey: late ? `project:${r.id}:overdue:${today}` : `project:${r.id}:due:${r.dueDate}`,
      title: late ? `Project past its due date: ${r.name}` : `Project due soon: ${r.name}`,
      body: `Due ${r.dueDate}.`,
    });
  }
}

async function invoiceReminders(companyId: string, today: string): Promise<void> {
  // Recipients are users who can receive finance notifications AND read invoices.
  const holders = await db
    .select({ userId: userRoles.userId, key: permissions.key })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .innerJoin(user, eq(user.id, userRoles.userId))
    .where(and(eq(userRoles.companyId, companyId), eq(user.banned, false), inArray(permissions.key, ["finance.notifications.receive", "finance.invoices.read"])));
  const byUser = new Map<string, Set<string>>();
  for (const h of holders) byUser.set(h.userId, (byUser.get(h.userId) ?? new Set()).add(h.key));
  const eligible = [...byUser].filter(([, k]) => k.size === 2).map(([id]) => id);
  if (eligible.length === 0) return;

  // Reads invoices through the finance module's own rules, as the first recipient who can still load.
  let actor: Actor | null = null;
  for (const id of eligible) {
    try {
      actor = await loadActor(id);
      break;
    } catch {
      // Suspended or removed since the query; try the next recipient.
    }
  }
  if (!actor) return;
  const horizon = addDays(today, INVOICE_DUE_DAYS);
  for (const status of ["overdue", "issued", "partially_paid"] as const) {
    for (let page = 1; page <= 20; page++) {
      const res = await listInvoices(actor, { status, page, pageSize: 100 });
      for (const inv of res.rows) {
        if (!inv.dueDate) continue;
        const overdue = status === "overdue";
        if (!overdue && inv.dueDate > horizon) continue;
        await deliver({
          type: overdue ? "invoice.overdue" : "invoice.due",
          userIds: eligible,
          entity: { type: "invoice", id: inv.id },
          eventKey: overdue ? `invoice:${inv.id}:overdue:${today}` : `invoice:${inv.id}:due:${inv.dueDate}`,
          title: overdue ? `Invoice overdue: ${inv.invoiceNumber ?? inv.id}` : `Invoice due soon: ${inv.invoiceNumber ?? inv.id}`,
          body: `${inv.clientName} · outstanding ${inv.currency} ${inv.outstanding} · due ${inv.dueDate}.`,
        });
      }
      if (res.rows.length < 100) break;
    }
  }
}

const SECTIONS: Record<ReminderSection, (companyId: string, today: string) => Promise<void>> = {
  tasks: taskReminders,
  projects: projectReminders,
  invoices: invoiceReminders,
};

/**
 * Runs the reminder jobs for every company (or one). Each company and each section runs on its
 * own: a failure is recorded and the rest continue. Event keys are stable, so a retry or a
 * second run never duplicates anything.
 */
export async function runReminders(
  opts: { companyId?: string; now?: Date; sections?: ReminderSection[]; onCompany?: (companyId: string) => Promise<void> } = {},
): Promise<ReminderResult> {
  const list = await db
    .select({ id: companies.id, timezone: companies.timezone })
    .from(companies)
    .where(opts.companyId ? eq(companies.id, opts.companyId) : undefined);
  const failures: ReminderFailure[] = [];
  for (const c of list) {
    const today = todayInTz(c.timezone, opts.now);
    for (const section of opts.sections ?? (["tasks", "projects", "invoices"] as ReminderSection[])) {
      try {
        await opts.onCompany?.(c.id);
        await SECTIONS[section](c.id, today);
      } catch (e) {
        failures.push({ companyId: c.id, section, message: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return { companies: list.length, failures };
}
