import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };
const pool = (globalForDb.pool ??= new Pool({ connectionString: env.DATABASE_URL }));

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}
