import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function checkDatabase(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
