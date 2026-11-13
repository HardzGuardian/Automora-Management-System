import { cardClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { getNumbering } from "@/modules/settings";

export const metadata = { title: "Numbering" };

export default async function NumberingPage() {
  const rows = await getNumbering(await requireActor());
  return (
    <section className={`${cardClass} flex max-w-xl flex-col gap-3`}>
      <div>
        <h2 className="m-0 text-base font-semibold">Document numbers</h2>
        <p className="mt-1 text-sm text-muted">Numbers are allocated automatically and never reused. This shows the next number each type will receive.</p>
      </div>
      <div tabIndex={0} className="overflow-x-auto rounded-md border border-border">
        <table className="table w-full min-w-[20rem] border-0 text-left text-sm">
          <caption className="sr-only">Next document numbers</caption>
          <thead className="bg-primary-soft">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">
                Type
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Next number
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.kind} className="border-t border-border">
                <th scope="row" className="px-3 py-2 font-normal">
                  {r.label}
                </th>
                <td className="px-3 py-2 font-mono tabular-nums">{r.next}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Invoice numbers are formatted by the finance module as INV-YYYY-NNNNNN when issued.</p>
    </section>
  );
}
