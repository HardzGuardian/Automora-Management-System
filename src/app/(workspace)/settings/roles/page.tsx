import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { ALL_PERMISSION_KEYS, PERMISSION_GROUPS, can } from "@/lib/permissions";
import { listRoles } from "@/modules/auth";
import { createRoleAction, savePermissionsAction } from "../actions";

export const metadata = { title: "Roles & permissions" };

const GROUP_LABEL: Record<string, string> = { system: "System", work: "Work management", finance: "Finance" };

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
          <section key={role.id} aria-label={role.name} className="rounded-md border border-border bg-surface p-4 shadow-sm">
            <h2 className="text-lg font-semibold">
              {role.name} {role.isSystem ? <span className="ml-2 rounded-full bg-background px-2 py-0.5 text-xs font-normal text-muted">system role</span> : null}
            </h2>
            {role.description ? <p className="text-sm text-muted">{role.description}</p> : null}
            <p className="mt-1 text-xs text-muted">
              {granted.size} of {ALL_PERMISSION_KEYS.length} permissions
            </p>

            <ConfirmFormOrView canEdit={canManage && !locked} roleId={role.id} roleName={role.name}>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                {Object.entries(PERMISSION_GROUPS).map(([group, keys]) => (
                  <fieldset key={group} className="flex flex-col gap-1">
                    <legend className="mb-1 text-sm font-semibold">{GROUP_LABEL[group] ?? group}</legend>
                    {keys.map((k) => (
                      <label key={k} className="flex items-start gap-2 text-sm">
                        <input type="checkbox" name="permissions" value={k} defaultChecked={granted.has(k) || locked} disabled={!canManage || locked} className="mt-1" />
                        <span className="break-all">{k}</span>
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
            </ConfirmFormOrView>
          </section>
        );
      })}

      {canManage ? (
        <form action={createRoleAction} className="flex max-w-xl flex-col gap-3 rounded-md border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">New role</h2>
          <p className="text-sm text-muted">A new role starts with no permissions. Add them above after creating it.</p>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Name
            <input name="name" required minLength={2} maxLength={60} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Description (optional)
            <input name="description" maxLength={300} className={inputClass} />
          </label>
          <button type="submit" className={buttonClass("primary", "self-start")}>
            Create role
          </button>
        </form>
      ) : null}
    </div>
  );
}

function ConfirmFormOrView({ canEdit, roleId, roleName, children }: { canEdit: boolean; roleId: string; roleName: string; children: React.ReactNode }) {
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
      {children}
    </ConfirmForm>
  );
}
