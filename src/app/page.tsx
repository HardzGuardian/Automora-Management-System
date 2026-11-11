import { redirect } from "next/navigation";
import { signOutAction } from "@/app/(auth)/login/actions";
import { getSession } from "@/lib/auth/session";

// Placeholder landing page until Shubhangi's workspace shell and dashboard land.
export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <main className="flex flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Automora Management System</h1>
      <p>Signed in as {session.user.email}</p>
      <form action={signOutAction}>
        <button type="submit" className="rounded border border-gray-300 px-3 py-2">
          Sign out
        </button>
      </form>
    </main>
  );
}
