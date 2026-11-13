import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { Alert } from "@/components/ui/alert";
import { linkClass } from "@/components/ui/styles";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const valid = Boolean(token && !error);
  return (
    <AuthShell
      title="Choose a new password"
      description={valid ? "You will be signed out of other devices when you save." : undefined}
      footer={
        <Link href="/login" className={linkClass}>
          Back to sign in
        </Link>
      }
    >
      {token && !error ? (
        <ResetForm token={token} />
      ) : (
        <Alert tone="error">
          This reset link is invalid or has expired.{" "}
          <Link href="/forgot-password" className="font-medium underline">
            Request a new one
          </Link>
          .
        </Alert>
      )}
    </AuthShell>
  );
}
