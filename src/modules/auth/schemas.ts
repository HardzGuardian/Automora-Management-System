import { z } from "zod";

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  roleId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
});
export type CreateInvitationInput = z.input<typeof createInvitationSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(10).max(128),
});
export type AcceptInvitationInput = z.input<typeof acceptInvitationSchema>;
