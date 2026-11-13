import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  numeric,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, inList, tz, updatedAt } from "./_helpers";
import { clients } from "./clients";
import { companies } from "./company";
import { employees } from "./employees";

export const PROJECT_TYPES = ["Client", "Internal"] as const;
export const PROJECT_STATUSES = [
  "Planning",
  "Active",
  "On Hold",
  "Completed",
  "Cancelled",
  "Archived",
] as const;
export const MEMBERSHIP_ROLES = ["owner", "member", "viewer"] as const;
export const MILESTONE_STATUSES = ["Pending", "In Progress", "Completed"] as const;

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    projectCode: text("project_code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type").notNull(),
    clientId: uuid("client_id"),
    ownerEmployeeId: uuid("owner_employee_id").notNull(),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    status: text("status").notNull().default("Planning"),
    budgetAmount: numeric("budget_amount", { precision: 14, scale: 2 }),
    currency: text("currency").notNull().default("INR"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: tz("archived_at"),
  },
  (t) => [
    unique().on(t.id, t.companyId),
    unique().on(t.companyId, t.projectCode),
    foreignKey({
      columns: [t.clientId, t.companyId],
      foreignColumns: [clients.id, clients.companyId],
    }),
    foreignKey({
      columns: [t.ownerEmployeeId, t.companyId],
      foreignColumns: [employees.id, employees.companyId],
    }),
    check("projects_type_chk", inList("type", PROJECT_TYPES)),
    check("projects_status_chk", inList("status", PROJECT_STATUSES)),
    check("projects_client_required_chk", sql`type <> 'Client' OR client_id IS NOT NULL`),
    check(
      "projects_dates_chk",
      sql`start_date IS NULL OR due_date IS NULL OR start_date <= due_date`,
    ),
    check("projects_budget_chk", sql`budget_amount IS NULL OR budget_amount >= 0`),
    index("projects_company_status_idx").on(t.companyId, t.status),
    index("projects_company_due_idx").on(t.companyId, t.dueDate),
    index("projects_client_idx").on(t.clientId),
  ],
);

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id").notNull(),
    companyId: uuid("company_id").notNull(),
    employeeId: uuid("employee_id").notNull(),
    membershipRole: text("membership_role").notNull().default("member"),
    // Set when the person is a member only because their team was assigned to the project.
    viaTeamId: uuid("via_team_id"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.employeeId] }),
    foreignKey({
      columns: [t.projectId, t.companyId],
      foreignColumns: [projects.id, projects.companyId],
    }),
    foreignKey({
      columns: [t.employeeId, t.companyId],
      foreignColumns: [employees.id, employees.companyId],
    }),
    check("project_members_role_chk", inList("membership_role", MEMBERSHIP_ROLES)),
    index("project_members_employee_idx").on(t.employeeId),
  ],
);

export const projectMilestones = pgTable(
  "project_milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").notNull(),
    projectId: uuid("project_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    dueDate: date("due_date"),
    status: text("status").notNull().default("Pending"),
    completedAt: tz("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.projectId, t.companyId],
      foreignColumns: [projects.id, projects.companyId],
    }),
    check("milestones_status_chk", inList("status", MILESTONE_STATUSES)),
    index("milestones_project_idx").on(t.projectId),
  ],
);
