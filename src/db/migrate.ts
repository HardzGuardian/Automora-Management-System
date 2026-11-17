import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "node:path";

export async function runMigrations(url: string): Promise<void> {
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(__dirname, "migrations") });
  } finally {
    await pool.end();
  }
}
