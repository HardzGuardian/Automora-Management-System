import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Forgot your password?</h1>
      <ForgotForm />
      <Link href="/login" className="text-sm underline">
        Back to sign in
      </Link>
    </main>
  );
}
