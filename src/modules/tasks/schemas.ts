import { z } from "zod";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/db/schema";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const hours = z.string().regex(/^\d{1,5}(\.\d{1,2})?$/, "Use hours with up to 2 decimals");
const uuid = z.string().uuid();

const fields = {
  title: z.string().trim().min(1, "Enter a title").max(200),
  // Plain text only; rendered escaped. No HTML is stored or interpreted.
  description: z.string().trim().max(10000).nullable(),
  priority: z.enum(TASK_PRIORITIES),
  projectId: uuid.nullable(),
  clientId: uuid.nullable(),
  startDate: isoDate.nullable(),
  dueDate: isoDate.nullable(),
  estimatedHours: hours.nullable(),
  actualHours: hours.nullable(),
};

const datesOk = (v: { startDate?: string | null; dueDate?: string | null }) =>
  !v.startDate || !v.dueDate || v.startDate <= v.dueDate;
const datesMsg = { path: ["dueDate"], message: "Due date cannot be before the start date" };

export const createTaskSchema = z
  .object({
    title: fields.title,
    description: fields.description.optional(),
    priority: fields.priority.optional(),
    projectId: fields.projectId.optional(),
    clientId: fields.clientId.optional(),
    startDate: fields.startDate.optional(),
    dueDate: fields.dueDate.optional(),
    estimatedHours: fields.estimatedHours.optional(),
    actualHours: fields.actualHours.optional(),
    assigneeIds: z.array(uuid).max(50).optional(),
  })
  .strict()
  .refine(datesOk, datesMsg);
export type CreateTaskInput = z.input<typeof createTaskSchema>;

export const updateTaskSchema = z.object(fields).partial().strict();
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;

export const statusSchema = z.enum(TASK_STATUSES);
export const assigneeIdsSchema = z.array(uuid).min(1).max(50);
