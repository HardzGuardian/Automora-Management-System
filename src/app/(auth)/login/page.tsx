import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ activated?: string }>;
}) {
  const { activated } = await searchParams;
  if (await getSession()) redirect("/");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Sign in to Automora</h1>
      {activated ? <p className="text-sm text-green-700">Account activated. You can sign in now.</p> : null}
      <LoginForm />
    </main>
  );
}
