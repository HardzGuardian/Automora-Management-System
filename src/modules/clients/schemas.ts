import { z } from "zod";
import { CLIENT_STATUSES } from "@/db/schema";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const createClientSchema = z.object({
  name: z.string().trim().min(1).max(160),
  contactPerson: optionalText(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .refine((v) => v == null || z.string().email().safeParse(v).success, "Invalid email"),
  phone: optionalText(30),
  address: optionalText(400),
  serviceType: optionalText(100),
});
export type CreateClientInput = z.input<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial().extend({
  status: z.enum(CLIENT_STATUSES).optional(),
});
export type UpdateClientInput = z.input<typeof updateClientSchema>;

export const listClientsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(CLIENT_STATUSES).optional(),
  includeArchived: z.boolean().default(false),
});
export type ListClientsInput = z.input<typeof listClientsSchema>;

export const noteSchema = z.string().trim().min(1, "Write a note").max(4000);
