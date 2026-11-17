import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { Icon } from "@/components/ui/icons";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot your password?" description="Enter your email and we will send you a reset link.">
      <ForgotForm />
      <Link href="/login" className="inline-flex items-center gap-1 self-start rounded font-medium text-primary-ink hover:underline">
        <Icon name="chevronLeft" size={18} strokeWidth={2.2} />
        Back to sign in
      </Link>
    </AuthShell>
  );
}
