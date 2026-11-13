import type { ReactNode } from "react";
import { FilterBar } from "@/components/ui/filter-bar";
import { inputClass } from "@/components/ui/styles";

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
  extra?: ReactNode;
}) {
  return (
    <FilterBar label="Filter tasks">
      {extra}
      <input name="q" type="search" aria-label="Search" defaultValue={q} placeholder="Search title or code" className={`${inputClass} sm:max-w-64`} />
      <select name="status" aria-label="Status" defaultValue={status ?? ""} className={`${inputClass} sm:w-40`}>
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <select name="priority" aria-label="Priority" defaultValue={priority ?? ""} className={`${inputClass} sm:w-40`}>
        <option value="">All priorities</option>
        {PRIORITIES.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input type="checkbox" name="overdue" value="1" defaultChecked={overdue} className="size-4 accent-primary" /> Overdue only
      </label>
    </FilterBar>
  );
}
