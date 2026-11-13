import { execSync } from "node:child_process";

// Resets and seeds the test database before the suite (deterministic users and data).
export default function globalSetup(): void {
  execSync("pnpm e2e:seed", { stdio: "inherit" });
}
