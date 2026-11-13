import { z } from "zod";
import { EMPLOYMENT_STATUSES } from "@/db/schema";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const createEmployeeSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  workEmail: z.string().trim().toLowerCase().email().max(254),
  phone: optionalText(30),
  designation: optionalText(100),
  department: optionalText(100),
  joiningDate: isoDate.nullable().optional(),
});
export type CreateEmployeeInput = z.input<typeof createEmployeeSchema>;

export const updateEmployeeSchema = createEmployeeSchema.partial();
export type UpdateEmployeeInput = z.input<typeof updateEmployeeSchema>;

export const listEmployeesSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(EMPLOYMENT_STATUSES).optional(),
  department: z.string().trim().max(100).optional(),
  sort: z.enum(["name", "code", "joined"]).default("name"),
  dir: z.enum(["asc", "desc"]).default("asc"),
});
export type ListEmployeesInput = z.input<typeof listEmployeesSchema>;
