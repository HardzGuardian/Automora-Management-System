import { sql } from "drizzle-orm";
import type { Tx } from "@/db";
import type { CodeKind } from "@/db/schema";

/**
 * Atomically allocates the next number in a company's sequence (1, 2, 3 ...).
 * Must run inside the creating transaction. Never use MAX(code)+1.
 * Use this when the caller formats its own number (e.g. INV-2026-000001).
 */
export async function nextSequence(tx: Tx, companyId: string, kind: CodeKind): Promise<number> {
  const result = await tx.execute<{ n: number }>(sql`
    INSERT INTO code_sequences (company_id, kind, next_value)
    VALUES (${companyId}, ${kind}, 2)
    ON CONFLICT (company_id, kind)
    DO UPDATE SET next_value = code_sequences.next_value + 1
    RETURNING next_value - 1 AS n
  `);
  return Number(result.rows[0].n);
}

/** Allocates the next human-readable code, e.g. TSK-000123. */
export async function nextCode(tx: Tx, companyId: string, kind: CodeKind): Promise<string> {
  const n = await nextSequence(tx, companyId, kind);
  return `${kind}-${String(n).padStart(6, "0")}`;
}
