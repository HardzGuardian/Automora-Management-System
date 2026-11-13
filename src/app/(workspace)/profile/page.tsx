import { requireActor } from "@/lib/auth/require-actor";
import { getSession } from "@/lib/auth/session";
import { listMySessions } from "@/modules/auth";
import { revokeSessionAction } from "./actions";
import { PasswordForm } from "./password-form";

export default async function ProfilePage() {
  const actor = await requireActor();
  const current = (await getSession())?.session.id;
  const sessions = await listMySessions(actor, current);

  return (
    <main className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">My account</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Change password</h2>
        <PasswordForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Active sessions</h2>
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 break-words rounded border border-border p-3 text-sm">
              <span className="min-w-0 break-all">
                {s.userAgent ?? "Unknown device"} · {s.ipAddress ?? "unknown IP"} · signed in {s.createdAt.toLocaleString()}
                {s.isCurrent ? " (this device)" : ""}
              </span>
              {s.isCurrent ? null : (
                <form action={revokeSessionAction}>
                  <input type="hidden" name="sessionId" value={s.id} />
                  <button type="submit" className="rounded border border-border px-2 py-1">
                    Sign out
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
