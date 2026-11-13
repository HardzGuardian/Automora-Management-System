import { config } from "dotenv";

config({ quiet: true });

// CLI entry: `pnpm db:admin-invite [--email=you@company.com]`.
// Issues a fresh first-admin invitation link when the original was lost or has expired.
async function main() {
  const { env } = await import("@/lib/env");
  const { reissueAdminInvitation } = await import("./seed-core");
  const { sendEmail } = await import("@/lib/email/send");

  const flag = process.argv.find((a) => a.startsWith("--email="))?.slice("--email=".length).trim();
  const adminEmail = flag || env.SEED_ADMIN_EMAIL;
  if (!adminEmail) throw new Error("Pass --email=you@company.com or set SEED_ADMIN_EMAIL");

  const result = await reissueAdminInvitation({ adminEmail, appUrl: env.APP_URL });
  if (result.status === "admin_exists") {
    process.stdout.write(
      "A Super Admin already exists, so no invitation was created.\n" +
        "Use \"Forgot password\" on the sign-in page, or ask the Super Admin to invite you from Settings > Users.\n",
    );
    process.exitCode = 1;
    return;
  }
  if (result.revoked > 0) process.stdout.write(`Revoked ${result.revoked} earlier invitation(s).\n`);
  process.stdout.write(`Super Admin invitation for ${adminEmail} (valid 7 days):\n  ${result.acceptUrl}\n`);
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
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e: unknown) => {
    process.stderr.write(`Failed: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
