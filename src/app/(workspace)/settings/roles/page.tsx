import type { ReactNode } from "react";
import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { buttonClass, cardClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { ALL_PERMISSION_KEYS, PERMISSION_GROUPS, can } from "@/lib/permissions";
import { listRoles } from "@/modules/auth";
import { createRoleAction, savePermissionsAction } from "../actions";

export const metadata = { title: "Roles & permissions" };

const GROUP_LABEL: Record<string, string> = { system: "System", work: "Work management", finance: "Finance" };
const QUALIFIERS = new Set(["own", "all", "any"]);

const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** `tasks.status.update.own` becomes "Tasks · status update (own)". The raw key is still shown next to it. */
function permissionLabel(key: string): string {
  const parts = key.split(".");
  const area = capitalise(parts[0] ?? key);
  const rest = parts.slice(1);
  const last = rest[rest.length - 1];
  const qualifier = rest.length > 1 && last && QUALIFIERS.has(last) ? last : null;
  const action = (qualifier ? rest.slice(0, -1) : rest).join(" ");
  return `${area}${action ? ` · ${action}` : ""}${qualifier ? ` (${qualifier})` : ""}`;
}

/** Keys of one group, bucketed by their first segment (the area), keeping catalog order. */
function byArea(keys: readonly string[]): Array<[string, string[]]> {
  const map = new Map<string, string[]>();
  for (const k of keys) {
    const area = k.split(".")[0] ?? k;
    map.set(area, [...(map.get(area) ?? []), k]);
  }
  return [...map.entries()];
}

export default async function RolesPage() {
  const actor = await requireActor();
  const roles = await listRoles(actor);
  const canManage = can(actor, "roles.manage");

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-sm text-muted">
        Each role is a set of permissions. Changes apply the next time a user loads a page. The Super Admin role always has every permission and cannot be edited.
        Hiding a menu item is a convenience only; every action is checked on the server.
      </p>

      {roles.map((role) => {
        const locked = role.isSystem && role.name === "Super Admin";
        const granted = new Set<string>(role.permissions);
        return (
          <section key={role.id} aria-label={role.name} className={`${cardClass} flex flex-col gap-3`}>
            <div>
              <h2 className="m-0 flex flex-wrap items-center gap-2 text-base font-semibold">
                {role.name}
                {role.isSystem ? <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs font-normal text-muted">System role</span> : null}
              </h2>
              {role.description ? <p className="mt-1 text-sm text-muted">{role.description}</p> : null}
              <p className="mt-1 text-xs text-muted">
                {granted.size} of {ALL_PERMISSION_KEYS.length} permissions
                {locked ? " · always full access, not editable" : ""}
              </p>
            </div>

            <ConfirmFormOrView canEdit={canManage && !locked} roleId={role.id} roleName={role.name}>
              <div className="grid gap-6 lg:grid-cols-3">
                {Object.entries(PERMISSION_GROUPS).map(([group, keys]) => (
                  <fieldset key={group} className="flex min-w-0 flex-col gap-1 border-0 p-0">
                    <legend className="mb-2 w-full border-b border-border pb-1 text-sm font-semibold">{GROUP_LABEL[group] ?? group}</legend>
                    {byArea(keys).map(([area, areaKeys]) => (
                      <div key={area} className="flex flex-col">
                        <p className="mb-0.5 mt-2 text-xs font-medium uppercase tracking-wide text-muted">{capitalise(area)}</p>
                        {areaKeys.map((k) => (
                          <label key={k} className="flex min-h-8 items-start gap-2 py-1 text-sm">
                            <input type="checkbox" name="permissions" value={k} defaultChecked={granted.has(k) || locked} disabled={!canManage || locked} className="mt-0.5" />
                            <span className="min-w-0">
                              <span className="block">{permissionLabel(k)}</span>
                              <span className="block break-all text-xs text-muted">{k}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </fieldset>
                ))}
              </div>
            </ConfirmFormOrView>
          </section>
        );
      })}

      {canManage ? (
        <form action={createRoleAction} className={`${cardClass} flex max-w-xl flex-col gap-4`}>
          <div>
            <h2 className="m-0 text-base font-semibold">New role</h2>
            <p className="mt-1 text-sm text-muted">A new role starts with no permissions. Add them above after creating it.</p>
          </div>
          <Field id="new-role-name" label="Name" required>
            <input id="new-role-name" name="name" required minLength={2} maxLength={60} className={inputClass} />
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
      ) : null}
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
    >
      <input type="hidden" name="roleId" value={roleId} />
      <div className="mb-4">{children}</div>
    </ConfirmForm>
  );
}
