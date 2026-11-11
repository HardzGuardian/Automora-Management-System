import "server-only";
import { and, asc, count, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { employees } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { toEmployeeDTO, type EmployeeDTO } from "./dto";
import { listEmployeesSchema, type ListEmployeesInput } from "./schemas";

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function queryEmployees(
  actor: Actor,
  input: ListEmployeesInput,
): Promise<{ rows: EmployeeDTO[]; total: number }> {
  const f = listEmployeesSchema.parse(input);
  const conds: SQL[] = [eq(employees.companyId, actor.companyId), isNull(employees.archivedAt)];
  if (f.status) conds.push(eq(employees.employmentStatus, f.status));
  if (f.department) conds.push(eq(employees.department, f.department));
  if (f.search) {
    const pattern = `%${escapeLike(f.search)}%`;
    conds.push(
      or(
        ilike(employees.fullName, pattern),
        ilike(employees.workEmail, pattern),
        ilike(employees.employeeCode, pattern),
      )!,
    );
  }
  const where = and(...conds);
  const order =
    f.sort === "code" ? asc(employees.employeeCode) : f.sort === "joined" ? asc(employees.joiningDate) : asc(employees.fullName);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(employees)
      .where(where)
      .orderBy(order, asc(employees.id))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ total: count() }).from(employees).where(where),
  ]);
  return { rows: rows.map(toEmployeeDTO), total };
}
