import { buttonClass, cardClass, inputClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { getNumbering } from "@/modules/settings";
import { saveNumberingAction } from "../actions";

export const metadata = { title: "Numbering" };

export default async function NumberingPage() {
  const actor = await requireActor();
  const rows = await getNumbering(actor);
  const canEdit = can(actor, "settings.manage");
  return (
    <section className={`${cardClass} flex flex-col gap-3`}>
      <div>
        <h2 className="m-0 text-base font-semibold">Document numbers</h2>
        <p className="mt-1 text-sm text-muted">
          Numbers are allocated automatically and never reused. Choose the letters in front and how many digits the running number has. A change applies to new records only; numbers already issued stay as they are.
        </p>
      </div>
      <div tabIndex={0} className="overflow-x-auto rounded-md border border-border">
        <table className="table w-full min-w-[34rem] border-0 text-left text-sm">
          <caption className="sr-only">Document numbering</caption>
          <thead className="text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Type</th>
              <th scope="col" className="px-3 py-2 font-semibold">Next number</th>
              <th scope="col" className="px-3 py-2 font-semibold">Prefix</th>
              <th scope="col" className="px-3 py-2 font-semibold">Digits</th>
              <th scope="col" className="px-3 py-2"><span className="sr-only">Save</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.kind} className="border-t border-border">
                <th scope="row" className="px-3 py-2 font-normal">{r.label}</th>
                <td className="px-3 py-2 font-mono tabular-nums">{r.next}</td>
                {canEdit ? (
                  <>
                    <td colSpan={3} className="px-3 py-2">
                      <form action={saveNumberingAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="kind" value={r.kind} />
                        <label className="sr-only" htmlFor={`prefix-${r.kind}`}>Prefix for {r.label}</label>
                        <input id={`prefix-${r.kind}`} name="prefix" defaultValue={r.prefix} required maxLength={8} pattern="[A-Za-z0-9]{1,8}" className={`${inputClass} w-28 font-mono uppercase`} />
                        <label className="sr-only" htmlFor={`padding-${r.kind}`}>Digits for {r.label}</label>
                        <input id={`padding-${r.kind}`} name="padding" type="number" min={3} max={9} defaultValue={r.padding} required className={`${inputClass} w-20`} />
                        <button type="submit" className={buttonClass("secondary")}>Save</button>
                      </form>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 font-mono">{r.prefix}</td>
                    <td className="px-3 py-2 tabular-nums">{r.padding}</td>
                    <td />
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Invoice numbers carry the issue year, for example {rows.find((r) => r.kind === "INV")?.next}.</p>
    </section>
  );
}
