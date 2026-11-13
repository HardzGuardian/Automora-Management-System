import Link from "next/link";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { buttonClass, inputClass, linkClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { globalSearch, type SearchHit } from "@/modules/search";

export const metadata = { title: "Search" };

function Group({ title, hits }: { title: string; hits: SearchHit[] }) {
  if (hits.length === 0) return null;
  return (
    <SectionCard title={title} count={hits.length}>
      <ul className="flex flex-col divide-y divide-border text-sm">
        {hits.map((h) => (
          <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 first:pt-0 last:pb-0">
            <Link href={h.href} className={`${linkClass} font-medium`}>
              {h.title}
            </Link>
            <span className="text-muted">{h.subtitle}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireActor();
  const { q = "" } = await searchParams;
  const results = await globalSearch(actor, q);
  const trimmed = q.trim().length;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Search" description="Find tasks, projects, clients and employees you have access to." />
      <form role="search" aria-label="Search the workspace" className="flex flex-wrap gap-2">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search employees, clients, projects, tasks"
          aria-label="Search"
          className={`${inputClass} max-w-md flex-1`}
        />
        <button type="submit" className={buttonClass("secondary")}>
          Search
        </button>
      </form>
      {trimmed > 0 && trimmed < 2 ? <p className="text-sm text-muted">Type at least 2 characters.</p> : null}
      {trimmed >= 2 && results.total === 0 ? <EmptyState title={`Nothing found for “${q}”`} description="Check the spelling, or try a task code or a shorter word." /> : null}
      <Group title="Tasks" hits={results.tasks} />
      <Group title="Projects" hits={results.projects} />
      <Group title="Clients" hits={results.clients} />
      <Group title="Employees" hits={results.employees} />
    </div>
  );
}
