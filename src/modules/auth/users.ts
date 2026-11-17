import "server-only";
import { and, asc, count, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { employees, roles, user, userRoles } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { requirePermission } from "@/lib/permissions";

export type UserDTO = {
  id: string;
  name: string;
  email: string;
  banned: boolean;
  lastLoginAt: Date | null;
  roles: { id: string; name: string }[];
  employeeId: string | null;
  employeeName: string | null;
};

export type UserList = { items: UserDTO[]; total: number; page: number; pageSize: number };

const MAX_PAGE_SIZE = 100;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listUsers(
  actor: Actor,
  input: { page?: number; pageSize?: number; search?: string },
): Promise<UserList> {
  requirePermission(actor, "users.read");
  const pageSize = Math.min(Math.max(Math.trunc(input.pageSize ?? 20) || 20, 1), MAX_PAGE_SIZE);
  const page = Math.max(Math.trunc(input.page ?? 1) || 1, 1);
  const term = input.search?.trim().slice(0, 100);

  const where = and(
    eq(user.companyId, actor.companyId),
    term ? or(ilike(user.name, `%${escapeLike(term)}%`), ilike(user.email, `%${escapeLike(term)}%`)) : undefined,
  );

  const [{ total }] = await db.select({ total: count() }).from(user).where(where);
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      banned: user.banned,
      lastLoginAt: user.lastLoginAt,
      employeeId: employees.id,
      employeeName: employees.fullName,
    })
    .from(user)
    .leftJoin(employees, and(eq(employees.userId, user.id), eq(employees.companyId, user.companyId)))
    .where(where)
    .orderBy(asc(user.name), asc(user.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const roleRows =
    rows.length === 0
      ? []
      : await db
          .select({ userId: userRoles.userId, id: roles.id, name: roles.name })
          .from(userRoles)
          .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.companyId, userRoles.companyId)))
          .where(
            and(
              eq(userRoles.companyId, actor.companyId),
              inArray(
                userRoles.userId,
                rows.map((r) => r.id),
              ),
            ),
          )
          .orderBy(asc(roles.name));

  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      banned: r.banned ?? false,
      lastLoginAt: r.lastLoginAt,
      roles: roleRows.filter((x) => x.userId === r.id).map((x) => ({ id: x.id, name: x.name })),
      employeeId: r.employeeId,
      employeeName: r.employeeName,
    })),
    total,
    page,
    pageSize,
  };
}
