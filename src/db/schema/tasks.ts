import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, inList, tz, updatedAt } from "./_helpers";
import { user } from "./auth";
import { clients } from "./clients";
import { companies } from "./company";
import { employees } from "./employees";
import { files } from "./files";
import { projects } from "./projects";

export const TASK_STATUSES = ["Pending", "In Progress", "In Review", "Completed"] as const;
export const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    taskCode: text("task_code").notNull(),
    projectId: uuid("project_id"),
    clientId: uuid("client_id"),
    title: text("title").notNull(),
    description: text("description"),
    priority: text("priority").notNull().default("Medium"),
    status: text("status").notNull().default("Pending"),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    estimatedHours: numeric("estimated_hours", { precision: 7, scale: 2 }),
    actualHours: numeric("actual_hours", { precision: 7, scale: 2 }),
    completedAt: tz("completed_at"),
    completedBy: text("completed_by").references(() => user.id),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: tz("archived_at"),
  },
  (t) => [
    unique().on(t.id, t.companyId),
    unique().on(t.companyId, t.taskCode),
    foreignKey({
      columns: [t.projectId, t.companyId],
      foreignColumns: [projects.id, projects.companyId],
    }),
    foreignKey({
      columns: [t.clientId, t.companyId],
      foreignColumns: [clients.id, clients.companyId],
    }),
    check("tasks_status_chk", inList("status", TASK_STATUSES)),
    check("tasks_priority_chk", inList("priority", TASK_PRIORITIES)),
    check("tasks_dates_chk", sql`start_date IS NULL OR due_date IS NULL OR start_date <= due_date`),
    check(
      "tasks_hours_chk",
      sql`(estimated_hours IS NULL OR estimated_hours >= 0) AND (actual_hours IS NULL OR actual_hours >= 0)`,
    ),
    index("tasks_company_status_idx").on(t.companyId, t.status),
    index("tasks_company_due_idx").on(t.companyId, t.dueDate),
    index("tasks_project_idx").on(t.projectId),
    index("tasks_client_idx").on(t.clientId),
  ],
);

export const taskAssignees = pgTable(
  "task_assignees",
  {
    taskId: uuid("task_id").notNull(),
    companyId: uuid("company_id").notNull(),
    employeeId: uuid("employee_id").notNull(),
    assignedBy: text("assigned_by").references(() => user.id),
    assignedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.taskId, t.employeeId] }),
    foreignKey({ columns: [t.taskId, t.companyId], foreignColumns: [tasks.id, tasks.companyId] }),
    foreignKey({
      columns: [t.employeeId, t.companyId],
      foreignColumns: [employees.id, employees.companyId],
    }),
    index("task_assignees_employee_idx").on(t.employeeId),
  ],
);

export const taskComments = pgTable(
  "task_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull(),
    taskId: uuid("task_id").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: tz("deleted_at"),
  },
  (t) => [
    foreignKey({ columns: [t.taskId, t.companyId], foreignColumns: [tasks.id, tasks.companyId] }),
    index("task_comments_task_idx").on(t.taskId),
  ],
);

export const taskAttachments = pgTable(
  "task_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull(),
    taskId: uuid("task_id").notNull(),
    fileId: uuid("file_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.taskId, t.companyId], foreignColumns: [tasks.id, tasks.companyId] }),
    foreignKey({ columns: [t.fileId, t.companyId], foreignColumns: [files.id, files.companyId] }),
    index("task_attachments_task_idx").on(t.taskId),
  ],
);

export const taskActivityLogs = pgTable(
  "task_activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull(),
    taskId: uuid("task_id").notNull(),
    actorId: text("actor_id").references(() => user.id),
    action: text("action").notNull(),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.taskId, t.companyId], foreignColumns: [tasks.id, tasks.companyId] }),
    index("task_activity_task_idx").on(t.taskId, t.createdAt),
  ],
);
