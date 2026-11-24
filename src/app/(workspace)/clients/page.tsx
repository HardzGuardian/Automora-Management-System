import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pager } from "@/components/ui/pager";
import { buttonClass, linkClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { can } from "@/lib/permissions";
import { listClients } from "@/modules/clients";
import { projectsOverview, type ProjectOverviewRow } from "@/modules/projects";

export const metadata = { title: "Clients" };

/** A client reads as Active while any project runs, then On hold, then Completed (design). */
function clientStatus(projects: ProjectOverviewRow[], own: string, archived: boolean): string {
  if (archived) return "Archived"; // an archived client never reads as Active, whatever its projects do
  if (projects.length === 0) return own;
  if (projects.some((p) => p.status === "Active" || p.status === "Planning")) return "Active";
  if (projects.some((p) => p.status === "On Hold")) return "On Hold";
  return "Completed";
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string; page?: string }> }) {
  const actor = await requireActor();
  if (!can(actor, "clients.read")) {
    return <p className="rounded-lg border border-border bg-surface p-5 text-muted">You do not have access to clients.</p>;
  }
  const sp = await searchParams;
  const PAGE_SIZE = 25;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const [{ rows: clients, total }, projects] = await Promise.all([listClients(actor, { page, pageSize: PAGE_SIZE, search: sp.q, includeArchived: sp.archived === "1" }), projectsOverview(actor)]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n: number) => `/clients?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.archived === "1" ? { archived: "1" } : {}), page: String(n) }).toString()}`;
  const byClient = new Map<string, ProjectOverviewRow[]>();
  for (const p of projects) if (p.clientId) byClient.set(p.clientId, [...(byClient.get(p.clientId) ?? []), p]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Clients</h1>
          <p className="mt-1 text-muted">The companies you build projects for. Open a client to see its projects.</p>
        </div>
        {can(actor, "clients.create") ? (
          <Link href="/clients/new" className={buttonClass("primary", "gap-2")}>
            <Icon name="plus" size={18} strokeWidth={2.2} />
            New client
          </Link>
        ) : null}
      </div>

      <form role="search" className="relative max-w-[360px]">
        <label htmlFor="cl-q" className="sr-only">Search clients</label>
        <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-[11px] text-muted" />
        <input
          id="cl-q"
          name="q"
          type="search"
          defaultValue={sp.q}
          placeholder="Search clients"
          className="h-10 w-full rounded-lg border border-field bg-surface pl-10 pr-3 text-foreground placeholder:text-muted"
        />
      </form>
      <Link href={sp.archived === "1" ? "/clients" : "/clients?archived=1"} className="w-fit text-[13px] font-medium text-primary-ink hover:text-primary-hover">
        {sp.archived === "1" ? "Hide archived clients" : "Show archived clients"}
      </Link>

      <section aria-label="Clients" className="rounded-lg border border-border bg-surface">
        {clients.length === 0 ? (
          <p className="px-5 py-10 text-center text-muted">{sp.q ? "No clients match this search." : "No clients yet."}</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {clients.map((c, i) => {
              const list = byClient.get(c.id) ?? [];
              const status = clientStatus(list, c.status, c.archived);
              return (
                <li key={c.id} className="border-t border-border first:border-t-0">
                  <details open={i === 0 && clients.length > 1 ? true : undefined} className="group">
                    <summary className="flex min-h-[68px] cursor-pointer list-none flex-wrap items-center gap-3.5 px-5 py-4">
                      <span aria-hidden="true" className="inline-flex size-10 flex-none items-center justify-center rounded-lg bg-primary-soft font-bold text-primary-ink">
                        {c.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-[1_1_220px]">
                        <span className="block font-semibold text-foreground">{c.name}</span>
                        <span className="mt-0.5 block text-xs text-muted">{c.email ?? c.contactPerson ?? "No contact yet"}</span>
                      </span>
                      <span className="flex-[0_1_140px] text-[13px] text-body">
                        {list.length} {list.length === 1 ? "project" : "projects"}
                      </span>
                      <StatusBadge status={status} />
                      <Icon name="chevronDown" size={18} strokeWidth={2.2} className="flex-none text-body transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-5 pb-4 pl-[74px]">
                      {list.length === 0 ? (
                        <p className="m-0 text-sm text-muted">No projects for this client yet.</p>
                      ) : (
                        <ul className="m-0 list-none rounded-lg border border-border p-0">
                          {list.map((p) => (
                            <li key={p.id} className="flex flex-wrap items-center gap-3 border-t border-border px-3.5 py-2.5 first:border-t-0">
                              <Link href={`/projects/${p.id}`} className="min-w-[200px] flex-[1_1_200px] font-medium text-primary-ink hover:text-primary-hover">
                                {p.name}
                              </Link>
                              <span className="text-xs text-muted">Due {p.dueDate ?? "—"}</span>
                              <StatusBadge status={p.status} />
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mb-0 mt-3 text-sm">
                        <Link href={`/clients/${c.id}`} className={linkClass}>
                          Client details and notes
                        </Link>
                      </p>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <Pager page={page} pages={pages} prevHref={page > 1 ? pageHref(page - 1) : undefined} nextHref={page < pages ? pageHref(page + 1) : undefined} />
    </div>
  );
}
