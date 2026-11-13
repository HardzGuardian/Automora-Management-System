import Link from "next/link";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { listRoles, listUsers } from "@/modules/auth";
import { addRoleAction, removeRoleAction } from "./actions";

export const metadata = { title: "Users" };

const PAGE_SIZE = 20;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; error?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(Number.parseInt(sp.page ?? "1", 10) || 1, 1);
  const canManage = can(actor, "roles.manage") && can(actor, "roles.read");

  const [list, allRoles] = await Promise.all([
    listUsers(actor, { page, pageSize: PAGE_SIZE, search: q || undefined }),
    canManage ? listRoles(actor) : Promise.resolve([]),
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

      <form method="get" className="flex max-w-xl gap-2" role="search">
        <label className="sr-only" htmlFor="user-search">
          Search users
        </label>
        <input id="user-search" name="q" defaultValue={q} placeholder="Search by name or email" maxLength={100} className={inputClass} />
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
                      <form action={addRoleAction} className="mt-3 flex flex-wrap gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <label className="sr-only" htmlFor={`role-${u.id}`}>
                          Role to add for {u.name}
                        </label>
                        <select id={`role-${u.id}`} name="roleId" required defaultValue="" className={`${inputClass} max-w-48`}>
                          <option value="" disabled>
                            Add role…
                          </option>
                          {available.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className={buttonClass("secondary")}>
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
