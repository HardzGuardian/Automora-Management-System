import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { formatDateTime } from "@/components/ui/format";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { requireActor } from "@/lib/auth/require-actor";
import { getSession } from "@/lib/auth/session";
import { describeDevice, describeIp } from "@/lib/device";
import { listMySessions } from "@/modules/auth";
import { getEmployee } from "@/modules/employees";
import { ProfilePhotoCard } from "../employees/_components/profile-photo-card";
import { revokeSessionAction } from "./actions";
import { PasswordForm } from "./password-form";

export const metadata = { title: "My account" };

export default async function ProfilePage() {
  const actor = await requireActor();
  const current = (await getSession())?.session.id;
  const sessions = await listMySessions(actor, current);
  const me = actor.employeeId ? await getEmployee(actor, actor.employeeId) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="My account" description="Your photo, your password and the devices you are signed in on." />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          {me ? <ProfilePhotoCard employeeId={me.id} name={me.fullName} fileId={me.profileImageFileId} canChange /> : null}

          <SectionCard title="Signed-in devices" count={sessions.length}>
            <ul className="flex flex-col divide-y divide-border text-sm">
              {sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {describeDevice(s.userAgent)}
                      {s.isCurrent ? <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">This device</span> : null}
                    </span>
                    <span className="block text-xs text-muted">
                      {describeIp(s.ipAddress)} · signed in {formatDateTime(s.createdAt, actor.timezone)}
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

        <SectionCard title="Change password">
          <PasswordForm />
        </SectionCard>
      </div>
    </div>
  );
}
