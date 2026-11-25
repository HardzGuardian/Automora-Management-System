import Link from "next/link";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { listPendingInvitations, listRoles, listUsers } from "@/modules/auth";
import { addRoleAction, inviteUserAction, reactivateUserAction, removeRoleAction, suspendUserAction } from "./actions";
import { PendingInvitations } from "./pending-invitations";
import { parsePage } from "@/lib/pagination";
import { LiveSearch } from "@/components/ui/live-search";

export const metadata = { title: "Users" };

const PAGE_SIZE = 20;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; error?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = parsePage(sp.page);
  const canManage = can(actor, "roles.manage") && can(actor, "roles.read");

  const canInvite = can(actor, "users.invite") && can(actor, "roles.read");
  const canSuspend = can(actor, "users.suspend");
  const [pending, list, allRoles] = await Promise.all([
    canInvite ? listPendingInvitations(actor).catch(() => []) : Promise.resolve([]),
    listUsers(actor, { page, pageSize: PAGE_SIZE, search: q || undefined }),
    canManage || canInvite ? listRoles(actor) : Promise.resolve([]),
  ]);
  const pages = Math.max(Math.ceil(list.total / list.pageSize), 1);
  const query = (p: number) => new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString();
  const returnTo = `/settings/users${query(page) ? `?${query(page)}` : ""}`;
  const href = (p: number) => `/settings/users${query(p) ? `?${query(p)}` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm text-muted">
        People who can sign in. Roles decide what each user can see and do; changes are recorded in the audit log. At least one Super Admin must always remain.
      </p>

      {sp.error ? (
        <p role="alert" className="rounded-md border border-danger bg-surface p-3 text-sm text-danger">
          {sp.error}
        </p>
      ) : null}

      {canInvite ? (
        <section aria-label="Invite a user" className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
          <h2 className="m-0 text-base font-semibold">Invite a user</h2>
          <form action={inviteUserAction} className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs text-muted">
              Email
              <input name="email" type="email" required maxLength={254} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Role
              <select name="roleId" required defaultValue="" className={inputClass}>
                <option value="" disabled>Choose a role</option>
                {allRoles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            <button type="submit" className={buttonClass("primary")}>Send invitation</button>
          </form>
          <h3 className="m-0 text-sm font-semibold">Pending invitations ({pending.length})</h3>
          <PendingInvitations rows={pending} returnTo="/settings/users" />
        </section>
      ) : null}

      <form method="get" className="flex max-w-xl gap-2" role="search">
        <label className="sr-only" htmlFor="user-search">
          Search users
        </label>
        <LiveSearch id="user-search" defaultValue={q} placeholder="Search by name or email" maxLength={100} className={inputClass} />
        <button type="submit" className={buttonClass("secondary")}>
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">Users and their roles</caption>
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">User</th>
              <th scope="col" className="px-3 py-2">Status</th>
              <th scope="col" className="px-3 py-2">Last sign-in</th>
              <th scope="col" className="px-3 py-2">Roles</th>
            </tr>
          </thead>
          <tbody>
            {list.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted">
                  No users found.
                </td>
              </tr>
            ) : null}
            {list.items.map((u) => {
              const assigned = new Set(u.roles.map((r) => r.id));
              const available = allRoles.filter((r) => !assigned.has(r.id));
              return (
                <tr key={u.id} className="border-b border-border align-top last:border-0">
                  <td className="px-3 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="break-all text-xs text-muted">{u.email}</div>
                    {u.employeeName ? <div className="text-xs text-muted">Employee: {u.employeeName}</div> : null}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={u.banned ? "Suspended" : "Active"} />
                    {canSuspend && u.employeeId ? (
                      u.banned ? (
                        <form action={reactivateUserAction} className="mt-2">
                          <input type="hidden" name="employeeId" value={u.employeeId} />
                          <button type="submit" className={buttonClass("secondary", "min-h-9! px-3!")}>Reactivate</button>
                        </form>
                      ) : (
                        <div className="mt-2">
                          <ConfirmForm
                            action={suspendUserAction}
                            label="Suspend"
                            triggerClassName="min-h-9! px-3!"
                            title={`Suspend ${u.name}?`}
                            description="Their account is blocked and all their sessions end immediately. Their history is kept."
                            confirmLabel="Suspend"
                            formClassName="flex flex-col gap-2"
                          >
                            <input type="hidden" name="employeeId" value={u.employeeId} />
                            <label className="sr-only" htmlFor={`reason-${u.id}`}>Reason</label>
                            <input id={`reason-${u.id}`} name="reason" maxLength={300} placeholder="Reason (optional)" className={inputClass} />
                          </ConfirmForm>
                        </div>
                      )
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-muted">
                    {u.lastLoginAt ? `${u.lastLoginAt.toISOString().slice(0, 16).replace("T", " ")} UTC` : "Never"}
                  </td>
                  <td className="px-3 py-3">
                    <ul className="flex flex-col gap-2">
                      {u.roles.length === 0 ? <li className="text-muted">No roles</li> : null}
                      {u.roles.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-background px-2 py-0.5 text-xs">{r.name}</span>
                          {canManage ? (
                            <ConfirmForm
                              action={removeRoleAction}
                              label="Remove"
                              triggerClassName="min-h-9! px-3!"
                              title={`Remove ${r.name} from ${u.name}?`}
                              description="The user loses the permissions of this role the next time they load a page. This is recorded in the audit log."
                              confirmLabel="Remove role"
                            >
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="roleId" value={r.id} />
                              <input type="hidden" name="returnTo" value={returnTo} />
                            </ConfirmForm>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {canManage && available.length > 0 ? (
                      <form action={addRoleAction} className="mt-3 flex flex-nowrap items-center gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <label className="sr-only" htmlFor={`role-${u.id}`}>
                          Role to add for {u.name}
                        </label>
                        <select id={`role-${u.id}`} name="roleId" required defaultValue="" className={`${inputClass} min-h-9! max-w-48 py-1!`}>
                          <option value="" disabled>
                            Add role…
                          </option>
                          {available.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className={buttonClass("secondary", "min-h-9! px-3!")}>
                          Add
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={href(page - 1)} className={buttonClass("secondary")}>
              Previous
            </Link>
          ) : null}
          <span className="text-muted">
            Page {Math.min(page, pages)} of {pages} ({list.total} users)
          </span>
          {page < pages ? (
            <Link href={href(page + 1)} className={buttonClass("secondary")}>
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
