import { z } from "zod";
import { PROJECT_STATUSES, PROJECT_TYPES } from "@/db/schema";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const money = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Use a non-negative amount with up to 2 decimals");
const currency = z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const datesOk = (v: { startDate?: string | null; dueDate?: string | null }) =>
  !v.startDate || !v.dueDate || v.startDate <= v.dueDate;

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: optionalText(4000),
    type: z.enum(PROJECT_TYPES),
    clientId: z.string().uuid().nullable().optional(),
    ownerEmployeeId: z.string().uuid(),
    startDate: isoDate.nullable().optional(),
    dueDate: isoDate.nullable().optional(),
    budgetAmount: money.nullable().optional(),
    currency: currency.optional(),
  })
  .strict()
  .refine(datesOk, { path: ["dueDate"], message: "Due date cannot be before the start date" });
export type CreateProjectInput = z.input<typeof createProjectSchema>;

// type, client and owner are not editable here (owner has its own operation).
export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: optionalText(4000),
    startDate: isoDate.nullable(),
    dueDate: isoDate.nullable(),
    budgetAmount: money.nullable(),
    currency,
  })
  .partial()
  .strict();
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;

export const listProjectsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  type: z.enum(PROJECT_TYPES).optional(),
  clientId: z.string().uuid().optional(),
  includeArchived: z.boolean().default(false),
});
export type ListProjectsInput = z.input<typeof listProjectsSchema>;
