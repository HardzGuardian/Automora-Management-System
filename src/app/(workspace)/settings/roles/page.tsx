import Link from "next/link";
import type { ReactNode } from "react";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { buttonClass, cardClass, inputClass, linkClass } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import { requireActor } from "@/lib/auth/require-actor";
import { ALL_PERMISSION_KEYS, PERMISSION_GROUPS, can } from "@/lib/permissions";
import { AREA_TITLES, PERMISSION_LABELS, permissionArea } from "@/lib/permissions/labels";
import { listRoles } from "@/modules/auth";
import { createRoleAction, savePermissionsAction } from "../actions";

export const metadata = { title: "Roles & permissions" };

const GROUP_TITLE: Record<string, string> = { system: "System", work: "Work", finance: "Finance" };

/** Keys of one group bucketed by area, in catalogue order. */
function byArea(keys: readonly string[]): Array<[string, string[]]> {
  const map = new Map<string, string[]>();
  for (const k of keys) {
    const area = permissionArea(k);
    map.set(area, [...(map.get(area) ?? []), k]);
  }
  return [...map.entries()];
}

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ role?: string; keys?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const roles = await listRoles(actor);
  const canManage = can(actor, "roles.manage");
  const role = roles.find((r) => r.id === sp.role) ?? roles[0];
  const showKeys = sp.keys === "1";
  const href = (id: string, keys = showKeys) => `/settings/roles?role=${id}${keys ? "&keys=1" : ""}`;

  const locked = role ? role.isSystem && role.name === "Super Admin" : false;
  const granted = new Set<string>(role?.permissions ?? []);

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm text-muted">
        A role is a set of things people are allowed to do. Changes apply the next time they load a page. Every action is also checked on the server.
      </p>

      <div className="grid items-start gap-5 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="Roles" className="flex flex-col gap-2">
          <ul className="flex flex-col gap-1">
            {roles.map((r) => {
              const active = r.id === role?.id;
              return (
                <li key={r.id}>
                  <Link
                    href={href(r.id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 flex-col justify-center rounded-md border px-3 py-2 text-sm",
                      active ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-background",
                    )}
                  >
                    <span className={cn("font-medium", active && "text-primary")}>{r.name}</span>
                    <span className="text-xs text-muted">
                      {r.isSystem && r.name === "Super Admin" ? "Everything" : `${r.permissions.length} of ${ALL_PERMISSION_KEYS.length} permissions`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {canManage ? (
            <details className={`${cardClass} p-3`}>
              <summary className="cursor-pointer text-sm font-medium">New role</summary>
              <form action={createRoleAction} className="mt-3 flex flex-col gap-3">
                <Field id="new-role-name" label="Name" required hint="Starts with no permissions. Add them after creating it.">
                  <input id="new-role-name" name="name" required minLength={2} maxLength={60} aria-describedby="new-role-name-hint" className={inputClass} />
                </Field>
                <Field id="new-role-description" label="Description (optional)">
                  <input id="new-role-description" name="description" maxLength={300} className={inputClass} />
                </Field>
                <div>
                  <button type="submit" className={buttonClass("primary")}>
                    Create role
                  </button>
                </div>
              </form>
            </details>
          ) : null}
        </nav>

        {role ? (
          <section aria-label={role.name} className={`${cardClass} flex flex-col gap-4`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="m-0 flex flex-wrap items-center gap-2 text-lg font-semibold">
                  {role.name}
                  {role.isSystem ? <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs font-normal text-muted">System role</span> : null}
                </h2>
                {role.description ? <p className="mt-1 text-sm text-muted">{role.description}</p> : null}
                {locked ? <p className="mt-1 text-sm text-muted">Always has full access and cannot be edited.</p> : null}
              </div>
              <Link href={href(role.id, !showKeys)} className={cn(linkClass, "text-sm")}>
                {showKeys ? "Hide technical names" : "Show technical names"}
              </Link>
            </div>

            <ConfirmFormOrView canEdit={canManage && !locked} roleId={role.id} roleName={role.name}>
              <div className="flex flex-col gap-6">
                {Object.entries(PERMISSION_GROUPS).map(([group, keys]) => (
                  <div key={group} className="flex flex-col gap-3">
                    <h3 className="m-0 border-b border-border pb-1 text-sm font-semibold">{GROUP_TITLE[group] ?? group}</h3>
                    <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                      {byArea(keys).map(([area, areaKeys]) => (
                        <fieldset key={area} className="flex min-w-0 flex-col border-0 p-0">
                          <legend className="mb-1 p-0 text-xs font-medium uppercase tracking-wide text-muted">{AREA_TITLES[area] ?? area}</legend>
                          {areaKeys.map((k) => (
                            <label key={k} className="flex min-h-9 items-start gap-2 py-1.5 text-sm">
                              <input
                                type="checkbox"
                                name="permissions"
                                value={k}
                                defaultChecked={granted.has(k) || locked}
                                disabled={!canManage || locked}
                                className="mt-0.5 size-4 accent-primary"
                              />
                              <span className="min-w-0">
                                <span className="block">{PERMISSION_LABELS[k as keyof typeof PERMISSION_LABELS]}</span>
                                {showKeys ? <span className="block break-all text-xs text-muted">{k}</span> : null}
                              </span>
                            </label>
                          ))}
                        </fieldset>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ConfirmFormOrView>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function ConfirmFormOrView({ canEdit, roleId, roleName, children }: { canEdit: boolean; roleId: string; roleName: string; children: ReactNode }) {
  if (!canEdit) return <div>{children}</div>;
  return (
    <ConfirmForm
      action={savePermissionsAction}
      label="Save permissions"
      title={`Change permissions for ${roleName}?`}
      description="This changes what everyone with this role can see and do. The change is recorded in the audit log."
      confirmLabel="Save permissions"
      danger={false}
      formClassName="flex flex-col items-start gap-4"
    >
      <input type="hidden" name="roleId" value={roleId} />
      <div className="w-full">{children}</div>
    </ConfirmForm>
  );
}
