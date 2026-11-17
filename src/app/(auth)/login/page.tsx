import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/auth-shell";
import { AuthAlert } from "@/components/ui/auth-fields";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ activated?: string }>;
}) {
  const { activated } = await searchParams;
  if (await getSession()) redirect("/");
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in with the email your admin invited."
      footer="New here? There is no sign-up. Ask an admin to invite you, then use the link in your email."
    >
      {activated ? <AuthAlert tone="success">Account activated. You can sign in now.</AuthAlert> : null}
      <LoginForm />
    </AuthShell>
  );
}
