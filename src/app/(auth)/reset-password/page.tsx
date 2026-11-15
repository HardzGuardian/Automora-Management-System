import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { AuthAlert } from "@/components/ui/auth-fields";
import { Icon } from "@/components/ui/icons";
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
      footer="This link works once and expires 1 hour after it was sent."
    >
      {token && !error ? (
        <ResetForm token={token} />
      ) : (
        <AuthAlert>
          <span>
            This reset link is invalid or has expired.{" "}
            <Link href="/forgot-password" className="font-semibold underline">
              Request a new one
            </Link>
            .
          </span>
        </AuthAlert>
      )}
      <Link href="/login" className="inline-flex items-center gap-1 self-start rounded font-medium text-primary-ink hover:underline">
        <Icon name="chevronLeft" size={18} strokeWidth={2.2} />
        Back to sign in
      </Link>
    </AuthShell>
  );
}
