import Link from "next/link";
import { requireActor } from "@/lib/auth/require-actor";
import { globalSearch, type SearchHit } from "@/modules/search";

function Group({ title, hits }: { title: string; hits: SearchHit[] }) {
  if (hits.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-lg font-medium">{title}</h2>
      <ul className="text-sm">
        {hits.map((h) => (
          <li key={h.id}>
            <Link href={h.href} className="underline">
              {h.title}
            </Link>{" "}
            <span className="text-muted">· {h.subtitle}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireActor();
  const { q = "" } = await searchParams;
  const results = await globalSearch(actor, q);
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Search</h1>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search employees, clients, projects, tasks"
          aria-label="Search"
          className="w-full max-w-md rounded border border-border px-3 py-2"
        />
        <button type="submit" className="rounded border border-border px-3 py-2">
          Search
        </button>
      </form>
      {q.trim().length > 0 && q.trim().length < 2 ? <p className="text-sm text-muted">Type at least 2 characters.</p> : null}
      {q.trim().length >= 2 && results.total === 0 ? <p className="text-sm text-muted">Nothing found for “{q}”.</p> : null}
      <Group title="Tasks" hits={results.tasks} />
      <Group title="Projects" hits={results.projects} />
      <Group title="Clients" hits={results.clients} />
      <Group title="Employees" hits={results.employees} />
    </main>
  );
}
