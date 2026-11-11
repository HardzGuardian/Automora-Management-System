import { sql } from "drizzle-orm";
import type { Tx } from "@/db";
import type { CodeKind } from "@/db/schema";

/**
 * Atomically allocates the next human-readable code, e.g. TSK-000123.
 * Must run inside the creating transaction. Never use MAX(code)+1.
 */
export async function nextCode(tx: Tx, companyId: string, kind: CodeKind): Promise<string> {
  const result = await tx.execute<{ n: number }>(sql`
    INSERT INTO code_sequences (company_id, kind, next_value)
    VALUES (${companyId}, ${kind}, 2)
    ON CONFLICT (company_id, kind)
    DO UPDATE SET next_value = code_sequences.next_value + 1
    RETURNING next_value - 1 AS n
  `);
  const n = Number(result.rows[0].n);
  return `${kind}-${String(n).padStart(6, "0")}`;
}
