import "server-only";
import { z } from "zod";
import { withTransaction } from "@/db";
import type { Actor } from "@/lib/auth/actor";
import { DomainError, type ErrorCode } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { audit } from "@/modules/audit";
import { reassignTask } from "./assignees";
import { statusSchema } from "./schemas";
import { archiveTask } from "./service";
import { changeTaskStatus } from "./status";

export type BulkItemResult =
  | { taskId: string; ok: true }
  | { taskId: string; ok: false; error: { code: ErrorCode; message: string } };

export type BulkResult = { results: BulkItemResult[]; succeeded: number; failed: number };

const idsSchema = z.array(z.string().uuid()).min(1, "Select at least one task").max(100, "At most 100 tasks at a time");

/**
 * Applies `op` to each task independently, with that task's own permission and scope checks
 * (the single-record services). One record failing never blocks or rolls back the others.
 */
async function runEach(actor: Actor, taskIds: string[], op: (taskId: string) => Promise<unknown>): Promise<BulkResult> {
  const ids = [...new Set(idsSchema.parse(taskIds))];
  const results: BulkItemResult[] = [];
  for (const taskId of ids) {
    try {
      await op(taskId);
      results.push({ taskId, ok: true });
    } catch (e) {
      const error =
        e instanceof DomainError
          ? { code: e.code, message: e.message }
          : { code: "INTERNAL" as const, message: "Something went wrong" };
      results.push({ taskId, ok: false, error });
    }
  }
  const succeeded = results.filter((r) => r.ok).length;
  return { results, succeeded, failed: results.length - succeeded };
}

async function auditBulk(actor: Actor, action: string, detail: Record<string, unknown>, r: BulkResult): Promise<void> {
  await withTransaction((tx) =>
    audit.record(tx, {
      actor,
      entity: "task",
      entityId: "bulk",
      action,
      after: { ...detail, taskIds: r.results.map((x) => x.taskId), succeeded: r.succeeded, failed: r.failed },
    }),
  );
}

export async function bulkChangeStatus(actor: Actor, taskIds: string[], toRaw: string): Promise<BulkResult> {
  requirePermission(actor, "tasks.bulk");
  const to = statusSchema.parse(toRaw);
  const r = await runEach(actor, taskIds, (id) => changeTaskStatus(actor, id, to));
  await auditBulk(actor, "tasks.bulk_status", { to }, r);
  return r;
}

export async function bulkReassign(
  actor: Actor,
  taskIds: string[],
  fromEmployeeId: string,
  toEmployeeId: string,
): Promise<BulkResult> {
  requirePermission(actor, "tasks.bulk");
  const from = z.string().uuid().parse(fromEmployeeId);
  const to = z.string().uuid().parse(toEmployeeId);
  const r = await runEach(actor, taskIds, (id) => reassignTask(actor, id, from, to));
  await auditBulk(actor, "tasks.bulk_reassign", { fromEmployeeId: from, toEmployeeId: to }, r);
  return r;
}

export async function bulkArchive(actor: Actor, taskIds: string[]): Promise<BulkResult> {
  requirePermission(actor, "tasks.bulk");
  const r = await runEach(actor, taskIds, (id) => archiveTask(actor, id));
  await auditBulk(actor, "tasks.bulk_archive", {}, r);
  return r;
}
