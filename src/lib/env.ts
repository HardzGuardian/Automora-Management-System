import { z } from "zod";

const bool = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => v === "true");

const schema = z.object({
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

let cached: Env | undefined;

export const env: Env = new Proxy({} as Env, {
  get(_t, key: string) {
    cached ??= parseEnv(process.env);
    return cached[key as keyof Env];
  },
});
