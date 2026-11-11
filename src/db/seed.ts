import { config } from "dotenv";

config({ quiet: true });

// CLI entry: `pnpm db:seed`. Loaded dynamically so env is read after dotenv.
async function main() {
  const { env } = await import("@/lib/env");
  const { runSeed } = await import("./seed-core");
  const { sendEmail } = await import("@/lib/email/send");

  const adminEmail = env.SEED_ADMIN_EMAIL;
  if (!adminEmail) throw new Error("SEED_ADMIN_EMAIL is required to create the Super Admin invitation");

  const result = await runSeed({ demo: env.SEED_DEMO, adminEmail, appUrl: env.APP_URL });
  process.stdout.write(`Seeded company ${result.companyId}\n`);
  if (!result.acceptUrl) {
    process.stdout.write("No new invitation created (a Super Admin or a valid invitation already exists).\n");
    return;
  }
  process.stdout.write(`Super Admin invitation for ${adminEmail}:\n  ${result.acceptUrl}\n`);
  try {
    await sendEmail({
      to: adminEmail,
      subject: "Your Automora Super Admin invitation",
      text: `You have been invited as Super Admin. Set your password here (valid 7 days):\n${result.acceptUrl}\n`,
    });
    process.stdout.write("Invitation email sent.\n");
  } catch {
    process.stdout.write("Email not sent (SMTP unavailable). Use the link above.\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    process.stderr.write(`Seed failed: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
