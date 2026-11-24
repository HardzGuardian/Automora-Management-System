import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { db as Db } from "@/db";
import { companySettings, type CodeKind } from "@/db/schema";

/** Per-company numbering: the letters in front and how many digits the running number is padded to. */
export type NumberingConfig = { prefix: string; padding: number };

export const DEFAULT_NUMBERING: Record<CodeKind, NumberingConfig> = {
  TSK: { prefix: "TSK", padding: 6 },
  PRJ: { prefix: "PRJ", padding: 6 },
  CLI: { prefix: "CLI", padding: 6 },
  EMP: { prefix: "EMP", padding: 6 },
  INV: { prefix: "INV", padding: 6 },
  EXP: { prefix: "EXP", padding: 6 },
};

export const numberingSchema = z.object({
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,8}$/, "Use 1 to 8 letters or digits"),
  padding: z.number().int().min(3, "Use at least 3 digits").max(9, "Use at most 9 digits"),
});

export const numberingKey = (kind: CodeKind) => `numbering.${kind}`;

type Reader = Pick<typeof Db, "select">;

/** The company's saved format for a kind, falling back to the default when none (or an invalid one) is stored. */
export async function loadNumberingConfig(tx: Reader, companyId: string, kind: CodeKind): Promise<NumberingConfig> {
  const [row] = await tx
    .select({ value: companySettings.settingValueJson })
    .from(companySettings)
    .where(and(eq(companySettings.companyId, companyId), eq(companySettings.settingKey, numberingKey(kind))));
  const parsed = numberingSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : DEFAULT_NUMBERING[kind];
}

export function formatSequence(cfg: NumberingConfig, n: number): string {
  return `${cfg.prefix}-${String(n).padStart(cfg.padding, "0")}`;
}
