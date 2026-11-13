import { check, foreignKey, index, pgTable, primaryKey, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, inList, tz, updatedAt } from "./_helpers";
import { user } from "./auth";
import { companies } from "./company";
import { employees } from "./employees";
import { projects } from "./projects";
import { tasks } from "./tasks";

export const TEAM_ROLES = ["lead", "member"] as const;

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: tz("archived_at"),
  },
  (t) => [unique().on(t.id, t.companyId), unique().on(t.companyId, t.name)],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    departmentId: uuid("department_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: tz("archived_at"),
  },
  (t) => [
    unique().on(t.id, t.companyId),
    unique().on(t.departmentId, t.name),
    foreignKey({ columns: [t.departmentId, t.companyId], foreignColumns: [departments.id, departments.companyId] }),
    index("teams_department_idx").on(t.departmentId),
  ],
);

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id").notNull(),
    companyId: uuid("company_id").notNull(),
    employeeId: uuid("employee_id").notNull(),
    role: text("role").notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.employeeId] }),
    foreignKey({ columns: [t.teamId, t.companyId], foreignColumns: [teams.id, teams.companyId] }),
    foreignKey({ columns: [t.employeeId, t.companyId], foreignColumns: [employees.id, employees.companyId] }),
    check("team_members_role_chk", inList("role", TEAM_ROLES)),
    index("team_members_employee_idx").on(t.employeeId),
  ],
);

/** A task handed to a whole team. Members are kept in task_assignees (via_team_id) by the teams module. */
export const taskTeams = pgTable(
  "task_teams",
  {
    taskId: uuid("task_id").notNull(),
    teamId: uuid("team_id").notNull(),
    companyId: uuid("company_id").notNull(),
    assignedBy: text("assigned_by").references(() => user.id),
    assignedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.taskId, t.teamId] }),
    foreignKey({ columns: [t.taskId, t.companyId], foreignColumns: [tasks.id, tasks.companyId] }),
    foreignKey({ columns: [t.teamId, t.companyId], foreignColumns: [teams.id, teams.companyId] }),
    index("task_teams_team_idx").on(t.teamId),
  ],
);

/** A project handed to a whole team. Members are kept in project_members (via_team_id). */
export const projectTeams = pgTable(
  "project_teams",
  {
    projectId: uuid("project_id").notNull(),
    teamId: uuid("team_id").notNull(),
    companyId: uuid("company_id").notNull(),
    assignedBy: text("assigned_by").references(() => user.id),
    assignedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.teamId] }),
    foreignKey({ columns: [t.projectId, t.companyId], foreignColumns: [projects.id, projects.companyId] }),
    foreignKey({ columns: [t.teamId, t.companyId], foreignColumns: [teams.id, teams.companyId] }),
    index("project_teams_team_idx").on(t.teamId),
  ],
);
