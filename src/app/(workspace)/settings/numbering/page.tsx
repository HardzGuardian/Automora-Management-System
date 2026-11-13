import { requireActor } from "@/lib/auth/require-actor";
import { getNumbering } from "@/modules/settings";

export const metadata = { title: "Numbering" };

export default async function NumberingPage() {
  const rows = await getNumbering(await requireActor());
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <p className="text-sm text-muted">Numbers are allocated automatically and never reused. This shows the next number each type will receive.</p>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Next document numbers</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="py-2">
              Type
            </th>
            <th scope="col" className="py-2">
              Next number
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.kind} className="border-b border-border/60">
              <th scope="row" className="py-2 font-normal">
                {r.label}
              </th>
              <td className="py-2 font-mono">{r.next}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted">Invoice numbers are formatted by the finance module as INV-YYYY-NNNNNN when issued.</p>
    </div>
  );
}
