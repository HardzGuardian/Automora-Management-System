import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, withTransaction } from "@/db";
import { CODE_KINDS, codeSequences, companies, companySettings, expenses, invoices, payments } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { DomainError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { audit } from "@/modules/audit";

export type CompanyProfile = {
  legalName: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  timezone: string;
};

const isTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};
const optional = (max: number) =>
  z.string().trim().max(max).transform((v) => (v === "" ? null : v)).nullable().optional().transform((v) => v ?? null);

const profileSchema = z.object({
  legalName: z.string().trim().min(1, "Enter the legal name").max(200),
  displayName: z.string().trim().min(1, "Enter the display name").max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .refine((v) => v == null || z.string().email().safeParse(v).success, "Enter a valid email")
    .transform((v) => v ?? null),
  phone: optional(40),
  address: optional(500),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. INR"),
  timezone: z.string().trim().refine(isTimezone, "Choose a valid timezone, e.g. Asia/Kolkata"),
});
export type CompanyProfileInput = z.input<typeof profileSchema>;

export async function getCompanyProfile(actor: Actor): Promise<CompanyProfile> {
  requirePermission(actor, "settings.read");
  const [c] = await db.select().from(companies).where(eq(companies.id, actor.companyId));
  if (!c) throw new DomainError("NOT_FOUND", "Company not found");
  return { legalName: c.legalName, displayName: c.displayName, email: c.email, phone: c.phone, address: c.address, currency: c.currency, timezone: c.timezone };
}

export async function updateCompanyProfile(actor: Actor, input: CompanyProfileInput): Promise<CompanyProfile> {
  requirePermission(actor, "settings.manage");
  const data = profileSchema.parse(input);
  return withTransaction(async (tx) => {
    const [before] = await tx.select().from(companies).where(eq(companies.id, actor.companyId));
    if (!before) throw new DomainError("NOT_FOUND", "Company not found");
    if (data.currency !== before.currency) {
      // Expense money has no currency of its own (it follows the company's), so changing it would
      // silently relabel history. Block it once any financial record exists.
      const [inv] = await tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.companyId, actor.companyId)).limit(1);
      const [exp] = await tx.select({ id: expenses.id }).from(expenses).where(eq(expenses.companyId, actor.companyId)).limit(1);
      const [pay] = await tx.select({ id: payments.id }).from(payments).where(eq(payments.companyId, actor.companyId)).limit(1);
      if (inv || exp || pay) throw new DomainError("CONFLICT", "The currency cannot be changed after invoices, payments or expenses exist.");
    }
    const [after] = await tx.update(companies).set(data).where(eq(companies.id, actor.companyId)).returning();
    const pick = (c: typeof before): CompanyProfile => ({ legalName: c.legalName, displayName: c.displayName, email: c.email, phone: c.phone, address: c.address, currency: c.currency, timezone: c.timezone });
    await audit.record(tx, { actor, entity: "company", entityId: actor.companyId, action: "settings.company_updated", before: pick(before), after: pick(after) });
    return pick(after);
  });
}

// ---- Preferences: a small, typed set. Unknown keys are rejected, never stored. ----
const PREFS = {
  "tasks.defaultPriority": { schema: z.enum(["Low", "Medium", "High", "Urgent"]), fallback: "Medium" as string | number },
  "invoices.defaultDueDays": { schema: z.number().int().min(0).max(365), fallback: 30 as string | number },
} as const;
export type PreferenceKey = keyof typeof PREFS;
export type Preferences = { "tasks.defaultPriority": string; "invoices.defaultDueDays": number };

const PREFIX = "pref:";

export async function getPreferences(actor: Actor): Promise<Preferences> {
  requirePermission(actor, "settings.read");
  const rows = await db.select().from(companySettings).where(eq(companySettings.companyId, actor.companyId));
  const stored = new Map(rows.map((r) => [r.settingKey, r.settingValueJson]));
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(PREFS)) {
    const v = stored.get(PREFIX + key);
    const parsed = v === undefined ? undefined : def.schema.safeParse(v);
    out[key] = parsed?.success ? parsed.data : def.fallback;
  }
  return out as Preferences;
}

export async function updatePreferences(actor: Actor, input: Record<string, unknown>): Promise<Preferences> {
  requirePermission(actor, "settings.manage");
  const entries = Object.entries(input);
  for (const [key, value] of entries) {
    const def = PREFS[key as PreferenceKey];
    if (!def) throw new DomainError("VALIDATION", `Unknown setting: ${key}`);
    if (!def.schema.safeParse(value).success) throw new DomainError("VALIDATION", `Invalid value for ${key}`);
  }
  const before = await getPreferences(actor);
  await withTransaction(async (tx) => {
    for (const [key, value] of entries) {
      await tx
        .insert(companySettings)
        .values({ companyId: actor.companyId, settingKey: PREFIX + key, settingValueJson: value })
        .onConflictDoUpdate({ target: [companySettings.companyId, companySettings.settingKey], set: { settingValueJson: value } });
    }
    await audit.record(tx, { actor, entity: "company", entityId: actor.companyId, action: "settings.preferences_updated", before, after: input });
  });
  return getPreferences(actor);
}

// ---- Numbering (display only; sequences are allocated atomically by lib/codes) ----
const LABELS: Record<(typeof CODE_KINDS)[number], string> = { TSK: "Tasks", PRJ: "Projects", CLI: "Clients", EMP: "Employees", INV: "Invoices", EXP: "Expenses" };

export async function getNumbering(actor: Actor): Promise<{ kind: string; label: string; next: string }[]> {
  requirePermission(actor, "settings.read");
  const rows = await db.select().from(codeSequences).where(and(eq(codeSequences.companyId, actor.companyId)));
  const next = new Map(rows.map((r) => [r.kind, r.nextValue]));
  return CODE_KINDS.map((kind) => ({ kind, label: LABELS[kind], next: `${kind}-${String(next.get(kind) ?? 1).padStart(6, "0")}` }));
}
