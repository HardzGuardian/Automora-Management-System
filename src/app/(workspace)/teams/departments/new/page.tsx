import { BackLink } from "@/components/ui/back-link";
import { buttonClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { createDepartmentAction } from "../../actions";

export const metadata = { title: "Create department" };

export default async function NewDepartmentPage() {
  const actor = await requireActor();
  if (!can(actor, "teams.manage")) {
    return <p role="alert" className="rounded-lg bg-warning-soft px-5 py-4 font-medium text-warning">Only admins can create departments.</p>;
  }
  return (
    <div className="flex max-w-[520px] flex-col gap-5">
      <div>
        <BackLink href="/teams">Teams</BackLink>
        <h1 className="mb-0 mt-1.5 text-2xl font-semibold tracking-tight text-foreground">Create department</h1>
        <p className="mt-1 text-muted">A department groups teams, such as Marketing or Software Development.</p>
      </div>
      <form action={createDepartmentAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="nd-name" className="text-sm font-medium">Department name</label>
          <input id="nd-name" name="name" required maxLength={80} placeholder="Marketing" className={inputClass} />
        </div>
        <div>
          <button type="submit" className={buttonClass("primary")}>Create department</button>
        </div>
      </form>
    </div>
  );
}
