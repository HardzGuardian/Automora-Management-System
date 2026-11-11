import { Pool } from "pg";
import { runMigrations } from "../db/migrate";

// Resets the test database and applies all committed migrations before any test runs.
export default async function setup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return; // pure unit tests only (e.g. env.test.ts) when no test DB is configured
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await pool.query("CREATE SCHEMA public");
  } finally {
    await pool.end();
  }
  await runMigrations(url);
}
