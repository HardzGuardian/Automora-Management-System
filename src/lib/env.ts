import { z } from "zod";

const bool = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => v === "true");

const schema = z.object({
  NODE_ENV: z.string().optional(),
  /** Lets a production build run on localhost with test settings (E2E only). Ignored for any non-local URL. */
  ALLOW_LOCAL_PRODUCTION: bool,
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  APP_URL: z.string().url(),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("automora"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Automora <no-reply@automora.local>"),
  SMTP_URL: z.string().default("smtp://localhost:1025"),
  CRON_SECRET: z.string().default(""),
  SEED_DEMO: bool,
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".data/uploads"),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(10485760),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const names = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment variables: ${names}`);
  }
  return result.data;
}

const PLACEHOLDER = /change-?me|placeholder|example|secret-secret/i;

/**
 * Pure production-config guard. Throws one Error listing every problem; no-op outside production.
 * Call at runtime start only (not during `next build`, which uses placeholder values).
 */
export function assertProductionEnv(e: Env): void {
  if (e.NODE_ENV !== "production") return;
  const isLocal = (u: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(u);
  if (e.ALLOW_LOCAL_PRODUCTION && isLocal(e.APP_URL) && isLocal(e.BETTER_AUTH_URL)) return;
  const problems: string[] = [];
  if (e.BETTER_AUTH_SECRET.length < 32 || PLACEHOLDER.test(e.BETTER_AUTH_SECRET) || new Set(e.BETTER_AUTH_SECRET).size < 8) {
    problems.push("BETTER_AUTH_SECRET must be a random value of at least 32 characters (not a placeholder)");
  }
  if (!e.BETTER_AUTH_URL.startsWith("https://")) problems.push("BETTER_AUTH_URL must use https");
  if (!e.APP_URL.startsWith("https://")) problems.push("APP_URL must use https");
  if (e.CRON_SECRET.length < 16) problems.push("CRON_SECRET must be at least 16 characters");
  if (e.STORAGE_DRIVER !== "s3") problems.push("STORAGE_DRIVER must be s3");
  if (!e.S3_BUCKET) problems.push("S3_BUCKET must be set");
  if (!e.S3_ACCESS_KEY_ID) problems.push("S3_ACCESS_KEY_ID must be set");
  if (!e.S3_SECRET_ACCESS_KEY) problems.push("S3_SECRET_ACCESS_KEY must be set");
  if (e.SEED_DEMO) problems.push("SEED_DEMO must be false");
  if (problems.length > 0) throw new Error(`Invalid production configuration: ${problems.join("; ")}`);
}

let cached: Env | undefined;

export const env: Env = new Proxy({} as Env, {
  get(_t, key: string) {
    cached ??= parseEnv(process.env);
    return cached[key as keyof Env];
  },
});
