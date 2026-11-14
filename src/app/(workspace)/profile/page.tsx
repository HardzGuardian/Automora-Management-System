import { signOutAction } from "@/app/(auth)/login/actions";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { formatDateTime } from "@/components/ui/format";
import { requireActor } from "@/lib/auth/require-actor";
import { getSession } from "@/lib/auth/session";
import { describeDevice, describeIp } from "@/lib/device";
import { listMySessions } from "@/modules/auth";
import { getEmployee } from "@/modules/employees";
import { listTeamsForEmployee } from "@/modules/teams";
import { ProfilePhotoCard } from "../employees/_components/profile-photo-card";
import { revokeSessionAction } from "./actions";
import { PasswordForm } from "./password-form";

export const metadata = { title: "My account" };

function Card({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <h2 className="m-0 flex items-baseline gap-2 border-b border-border px-5 py-4 text-base font-semibold text-foreground">
        {title}
        {count !== undefined ? <span className="text-sm font-normal text-muted">({count})</span> : null}
      </h2>
      {children}
    </section>
  );
}

export default async function ProfilePage() {
  const actor = await requireActor();
  const session = await getSession();
  const sessions = await listMySessions(actor, session?.session.id);
  const me = actor.employeeId ? await getEmployee(actor, actor.employeeId) : null;
  const teams = actor.employeeId ? await listTeamsForEmployee(actor, actor.employeeId).catch(() => []) : [];
  const name = session?.user.name ?? me?.fullName ?? "You";

  return (
    <div className="flex max-w-[760px] flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">My account</h1>
          <p className="mt-1 text-muted">Your details and password.</p>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="inline-flex min-h-11 items-center rounded-lg border border-field bg-surface px-4 font-medium text-foreground hover:bg-primary-soft">
            Sign out
          </button>
        </form>
      </div>

      <Card title="Profile">
        <div className="flex flex-wrap items-center gap-5 p-5">
          <span aria-hidden="true" className="inline-flex size-16 items-center justify-center rounded-full bg-primary text-[26px] font-semibold text-white">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <dl className="m-0 grid min-w-0 flex-[1_1_320px] grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2.5">
            <dt className="text-muted">Name</dt>
            <dd className="m-0 font-medium">{name}</dd>
            <dt className="text-muted">Email</dt>
            <dd className="m-0 break-all">{session?.user.email ?? "—"}</dd>
            <dt className="text-muted">Role</dt>
            <dd className="m-0">{actor.roles.join(", ") || "No role"}</dd>
            <dt className="text-muted">Team</dt>
            <dd className="m-0">
              {teams.length ? teams.map((t) => `${t.departmentName}, ${t.name}${t.role === "lead" ? " (lead)" : ""}`).join(" · ") : "Not on a team yet"}
            </dd>
          </dl>
        </div>
        <p className="m-0 border-t border-border px-5 py-3 text-[13px] text-muted">Ask an admin to change your name, email or role.</p>
      </Card>

      <Card title="Change password">
        <div className="p-5">
          <PasswordForm />
        </div>
      </Card>

      {me ? <ProfilePhotoCard employeeId={me.id} name={me.fullName} fileId={me.profileImageFileId} canChange /> : null}

      <Card title="Signed-in devices" count={sessions.length}>
        <ul className="m-0 list-none p-0">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 first:border-t-0">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {describeDevice(s.userAgent)}
                  {s.isCurrent ? <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-ink">This device</span> : null}
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
      </Card>
    </div>
  );
}
