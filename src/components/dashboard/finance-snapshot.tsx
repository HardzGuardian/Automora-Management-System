type Money = { currency: string; amount: string };

function List({ title, basis, rows }: { title: string; basis: string; rows: Money[] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <p className="text-xs text-muted">{basis}</p>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-muted">None</p>
      ) : (
        <ul className="mt-1 text-lg font-semibold tabular-nums">
          {rows.map((r) => (
            <li key={r.currency}>
              {r.currency} {r.amount}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Finance snapshot. Each figure says whether it is a period total or a point-in-time balance; currencies are never added together. */
export function FinanceSnapshotCard({
  invoices,
  receipts,
  expenses,
  outstanding,
}: {
  invoices: Money[];
  receipts: Money[];
  expenses: Money[];
  outstanding: Money[];
}) {
  return (
    <section aria-label="Finance snapshot" className="rounded-md border border-border bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold">Finance snapshot</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <List title="Invoiced" basis="period total · by issue date" rows={invoices} />
        <List title="Received" basis="period total · by payment date" rows={receipts} />
        <List title="Expenses" basis="period total · by expense date" rows={expenses} />
        <List title="Outstanding receivables" basis="point in time · all issued invoices" rows={outstanding} />
      </div>
    </section>
  );
}
