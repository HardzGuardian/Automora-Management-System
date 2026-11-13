import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { linkClass } from "@/components/ui/styles";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      description="Enter your work email and we will send a link to choose a new password."
      footer={
        <Link href="/login" className={linkClass}>
          Back to sign in
        </Link>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}
