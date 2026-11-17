import { FilterPills } from "@/components/ui/filter-pills";
import { Icon } from "@/components/ui/icons";
import { requireActor } from "@/lib/auth/require-actor";
import { DOC_KINDS, listDocuments, type DocKind } from "@/modules/documents";
import { projectsOverview } from "@/modules/projects";

export const metadata = { title: "Documents" };

const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

type SP = { q?: string; project?: string; type?: string };

function href(sp: SP, patch: Partial<SP>): string {
  const next = { ...sp, ...patch };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `/documents?${s}` : "/documents";
}

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const kind = DOC_KINDS.find((k) => k === sp.type) as DocKind | undefined;
  const projects = await projectsOverview(actor);
  const projectId = projects.find((p) => p.id === sp.project)?.id;
  const { rows, kindCounts } = await listDocuments(actor, { q: sp.q, projectId, kind });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Documents</h1>
        <p className="mt-1 text-muted">Every file across your projects. Admins add files inside a project; you can search and download.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <form role="search" className="flex flex-wrap items-center gap-2.5">
          <div className="relative max-w-[360px] min-w-60 flex-1">
            <label htmlFor="doc-q" className="sr-only">Search documents</label>
            <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-[11px] text-muted" />
            <input
              id="doc-q"
              name="q"
              type="search"
              defaultValue={sp.q}
              placeholder="Search by file name"
              className="h-10 w-full rounded-lg border border-field bg-surface pl-10 pr-3 text-foreground placeholder:text-muted"
            />
          </div>
          <label htmlFor="doc-project" className="sr-only">Filter by project</label>
          <select id="doc-project" name="project" defaultValue={projectId ?? ""} className="h-10 rounded-lg border border-field bg-surface px-2.5 text-foreground">
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {kind ? <input type="hidden" name="type" value={kind} /> : null}
          <button type="submit" className="h-10 rounded-lg border border-field bg-surface px-4 font-medium hover:bg-primary-soft">Search</button>
        </form>
        <FilterPills
          label="File type"
          pills={(["All", ...DOC_KINDS] as const).map((k) => ({
            label: k,
            href: href({ q: sp.q, project: projectId }, { type: k === "All" ? undefined : k }),
            active: (kind ?? "All") === k,
          }))}
        />
      </div>

      <section aria-label="Documents" className="rounded-lg border border-border bg-surface">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-muted">
            {kindCounts.All === 0 && !sp.q && !projectId && !kind
              ? "No documents yet. Admins add files from inside a project."
              : "No documents match. Clear the search or choose All."}
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {rows.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3.5 border-t border-border px-5 py-3.5 first:border-t-0">
                <span className="inline-flex size-[38px] flex-none items-center justify-center rounded-lg bg-primary-soft text-primary-ink">
                  <Icon name="documents" size={18} />
                </span>
                <span className="min-w-0 flex-[1_1_260px]">
                  <span className="block truncate font-medium">{d.name}</span>
                  <span className="mt-0.5 block text-xs text-muted">{d.projectName}</span>
                </span>
                <span className="flex-[0_1_200px] text-[13px] text-body">
                  {d.uploadedByName ?? "Unknown"} · {fmtDate(d.createdAt)}
                </span>
                <span className="w-16 flex-none text-right text-[13px] text-body">{fmtSize(d.size)}</span>
                <a
                  href={`/api/files/${d.fileId}`}
                  aria-label={`Download ${d.name}`}
                  className="inline-flex size-11 items-center justify-center rounded-lg border border-field bg-surface text-body hover:bg-primary-soft"
                >
                  <Icon name="download" size={18} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
