import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, withTransaction, type Tx } from "@/db";
import { employees } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { nextCode } from "@/lib/codes";
import { DomainError } from "@/lib/errors";
import { can, requirePermission } from "@/lib/permissions";
import { audit } from "@/modules/audit";
import { toEmployeeDTO, type EmployeeDTO } from "./dto";
import { queryEmployees } from "./queries";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  type CreateEmployeeInput,
  type ListEmployeesInput,
  type UpdateEmployeeInput,
} from "./schemas";

const EMAIL_TAKEN = "An employee with this work email already exists";

function isUniqueViolation(e: unknown): boolean {
  const cause = (e as { cause?: { code?: string } })?.cause;
  return (e as { code?: string })?.code === "23505" || cause?.code === "23505";
}

async function assertEmailFree(tx: Tx, companyId: string, email: string, exceptId?: string) {
  const [dup] = await tx
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.companyId, companyId), sql`lower(${employees.workEmail}) = ${email}`));
  if (dup && dup.id !== exceptId) throw new DomainError("CONFLICT", EMAIL_TAKEN);
}

export async function loadEmployee(tx: Pick<Tx, "select">, actor: Actor, id: string) {
  const [row] = await tx
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.companyId, actor.companyId)));
  if (!row) throw new DomainError("NOT_FOUND", "Employee not found");
  return row;
}

export async function createEmployee(actor: Actor, input: CreateEmployeeInput): Promise<EmployeeDTO> {
  requirePermission(actor, "employees.create");
  const data = createEmployeeSchema.parse(input);
  try {
    return await withTransaction(async (tx) => {
      await assertEmailFree(tx, actor.companyId, data.workEmail);
      const [row] = await tx
        .insert(employees)
        .values({
          companyId: actor.companyId,
          employeeCode: await nextCode(tx, actor.companyId, "EMP"),
          fullName: data.fullName,
          workEmail: data.workEmail,
          phone: data.phone ?? null,
          designation: data.designation ?? null,
          department: data.department ?? null,
          joiningDate: data.joiningDate ?? null,
        })
        .returning();
      const dto = toEmployeeDTO(row);
      await audit.record(tx, { actor, entity: "employee", entityId: row.id, action: "employee.created", after: dto });
      return dto;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError("CONFLICT", EMAIL_TAKEN);
    throw e;
  }
}

export async function updateEmployee(actor: Actor, id: string, input: UpdateEmployeeInput): Promise<EmployeeDTO> {
  requirePermission(actor, "employees.update");
  const patch = updateEmployeeSchema.parse(input);
  try {
    return await withTransaction(async (tx) => {
      const before = await loadEmployee(tx, actor, id);
      if (patch.workEmail) await assertEmailFree(tx, actor.companyId, patch.workEmail, id);
      const [row] = await tx
        .update(employees)
        .set(Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
        .where(and(eq(employees.id, id), eq(employees.companyId, actor.companyId)))
        .returning();
      const dto = toEmployeeDTO(row);
      await audit.record(tx, {
        actor,
        entity: "employee",
        entityId: id,
        action: "employee.updated",
        before: toEmployeeDTO(before),
        after: dto,
      });
      return dto;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError("CONFLICT", EMAIL_TAKEN);
    throw e;
  }
}

/** Anyone may read their own record; everyone else needs employees.read. */
export async function getEmployee(actor: Actor, id: string): Promise<EmployeeDTO> {
  if (actor.employeeId !== id && !can(actor, "employees.read")) {
    requirePermission(actor, "employees.read");
  }
  return toEmployeeDTO(await loadEmployee(db, actor, id));
}

export async function listEmployees(
  actor: Actor,
  input: ListEmployeesInput,
): Promise<{ rows: EmployeeDTO[]; total: number }> {
  requirePermission(actor, "employees.read");
  return queryEmployees(actor, input);
}
