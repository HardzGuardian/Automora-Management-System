import { ConfirmForm } from "@/components/ui/confirm-dialog";
import { buttonClass } from "@/components/ui/styles";
import type { PendingInvitationDTO } from "@/modules/auth";
import { resendInvitationAction, revokeInvitationAction } from "./actions";

/** Invitations waiting to be accepted, with Resend and Revoke. `returnTo` refreshes the page the buttons were used on. */
export function PendingInvitations({ rows, returnTo }: { rows: PendingInvitationDTO[]; returnTo: string }) {
  if (rows.length === 0) return <p className="m-0 text-sm text-muted">No pending invitations.</p>;
  return (
    <ul className="m-0 flex list-none flex-col divide-y divide-border rounded-md border border-border bg-surface p-0">
      {rows.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
          <span className="min-w-0 flex-1">
            <span className="block break-all font-medium">{i.email}</span>
            <span className="block text-xs text-muted">
              {i.roleName} · {i.expired ? "expired" : `expires ${i.expiresAt.toISOString().slice(0, 10)}`}
            </span>
          </span>
          <form action={resendInvitationAction}>
            <input type="hidden" name="invitationId" value={i.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button type="submit" className={buttonClass("secondary", "min-h-9! px-3!")}>
              Resend
            </button>
          </form>
          <ConfirmForm
            action={revokeInvitationAction}
            label="Revoke"
            triggerClassName="min-h-9! px-3!"
            title={`Revoke the invitation for ${i.email}?`}
            description="The link stops working. You can invite them again later."
            confirmLabel="Revoke invitation"
          >
            <input type="hidden" name="invitationId" value={i.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
          </ConfirmForm>
        </li>
      ))}
    </ul>
  );
}
