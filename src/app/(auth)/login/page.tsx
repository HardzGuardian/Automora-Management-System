import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { AuthShell } from "@/components/layout/auth-shell";
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
    <AuthShell title="Sign in to Automora" description="Use the work email your administrator invited.">
      {activated ? <Alert tone="success">Account activated. You can sign in now.</Alert> : null}
      <LoginForm />
    </AuthShell>
  );
}
