import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { formatDateTime } from "@/components/ui/format";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { requireActor } from "@/lib/auth/require-actor";
import { getSession } from "@/lib/auth/session";
import { listMySessions } from "@/modules/auth";
import { revokeSessionAction } from "./actions";
import { PasswordForm } from "./password-form";

export const metadata = { title: "My account" };

export default async function ProfilePage() {
  const actor = await requireActor();
  const current = (await getSession())?.session.id;
  const sessions = await listMySessions(actor, current);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="My account" description="Change your password and see where you are signed in." />

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Change password">
          <PasswordForm />
        </SectionCard>

        <SectionCard title="Active sessions" count={sessions.length}>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium">
                    {s.userAgent ?? "Unknown device"}
                    {s.isCurrent ? <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">This device</span> : null}
                  </span>
                  <span className="block break-all text-xs text-muted">
                    {s.ipAddress ?? "unknown IP"} · signed in {formatDateTime(s.createdAt, actor.timezone)}
                  </span>
                </span>
                {s.isCurrent ? null : (
                  <ConfirmForm
                    action={revokeSessionAction}
                    label="Sign out"
                    title="Sign out this device?"
                    description="The device is signed out straight away and must sign in again."
                    confirmLabel="Sign out device"
                  >
                    <input type="hidden" name="sessionId" value={s.id} />
                  </ConfirmForm>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
