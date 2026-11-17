import { config } from "dotenv";
import { runMigrations } from "./migrate";

config({ quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  process.stderr.write("DATABASE_URL is required\n");
  process.exit(1);
}
runMigrations(url)
  .then(() => {
    process.stdout.write("Migrations applied.\n");
    process.exit(0);
  })
  .catch((e: unknown) => {
    process.stderr.write(`Migration failed: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
