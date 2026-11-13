import Link from "next/link";

export type ActivityItem = { id: string; action: string; actorName: string | null; taskTitle: string; taskCode: string; createdAt: Date; href: string };

const VERB: Record<string, string> = {
  created: "created",
  updated: "updated",
  status_changed: "changed the status of",
  reopened: "reopened",
  assigned: "assigned",
  unassigned: "unassigned",
  reassigned: "reassigned",
  archived: "archived",
  attachment_added: "attached a file to",
  attachment_removed: "removed a file from",
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section aria-label="Recent activity" className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4 shadow-sm">
      <h2 className="text-base font-semibold">Recent activity</h2>
      {items.length === 0 ? (
        <p className="py-4 text-sm text-muted">Nothing has happened yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border text-sm">
          {items.map((a) => (
            <li key={a.id} className="py-2">
              <span className="font-medium">{a.actorName ?? "System"}</span> {VERB[a.action] ?? a.action.replace(/_/g, " ")}{" "}
              <Link href={a.href} className="underline">
                {a.taskCode} {a.taskTitle}
              </Link>
              <span className="block text-xs text-muted">{a.createdAt.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
