const STATUSES = ["Pending", "In Progress", "In Review", "Completed"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

export function TaskFilters({
  q,
  status,
  priority,
  overdue,
  extra,
}: {
  q?: string;
  status?: string;
  priority?: string;
  overdue?: boolean;
  extra?: React.ReactNode;
}) {
  const field = "rounded border border-border px-3 py-2";
  return (
    <form className="flex flex-wrap items-center gap-2">
      {extra}
      <input name="q" aria-label="Search" defaultValue={q} placeholder="Search title or code" className={field} />
      <select name="status" aria-label="Status" defaultValue={status ?? ""} className={field}>
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <select name="priority" aria-label="Priority" defaultValue={priority ?? ""} className={field}>
        <option value="">All priorities</option>
        {PRIORITIES.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-sm">
        <input type="checkbox" name="overdue" value="1" defaultChecked={overdue} /> Overdue only
      </label>
      <button type="submit" className="rounded border border-border px-3 py-2">
        Filter
      </button>
    </form>
  );
}
