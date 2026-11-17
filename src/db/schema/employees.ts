import { check, date, index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, inList, tz, updatedAt } from "./_helpers";
import { user } from "./auth";
import { companies } from "./company";

export const EMPLOYMENT_STATUSES = ["Active", "Inactive", "Suspended"] as const;

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    employeeCode: text("employee_code").notNull(),
    fullName: text("full_name").notNull(),
    workEmail: text("work_email").notNull(),
    phone: text("phone"),
    designation: text("designation"),
    department: text("department"),
    joiningDate: date("joining_date"),
    profileImageFileId: uuid("profile_image_file_id"),
    employmentStatus: text("employment_status").notNull().default("Active"),
    userId: text("user_id")
      .unique()
      .references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: tz("archived_at"),
  },
  (t) => [
    unique().on(t.id, t.companyId),
    unique().on(t.companyId, t.employeeCode),
    unique().on(t.companyId, t.workEmail),
    check("employees_status_chk", inList("employment_status", EMPLOYMENT_STATUSES)),
    index("employees_company_status_idx").on(t.companyId, t.employmentStatus),
  ],
);
