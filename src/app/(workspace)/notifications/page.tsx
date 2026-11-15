import Link from "next/link";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FilterPills } from "@/components/ui/filter-pills";
import { formatDateTime } from "@/components/ui/format";
import { Icon, type IconName } from "@/components/ui/icons";
import { Pager } from "@/components/ui/pager";
import { requireActor } from "@/lib/auth/require-actor";
import { cn } from "@/lib/cn";
import { listForUser, markAllRead, markRead, markUnread } from "@/modules/notifications";
import { parsePage } from "@/lib/pagination";

const PAGE_SIZE = 20;

async function toggleReadAction(fd: FormData) {
  "use server";
  const actor = await requireActor();
  const id = z.string().uuid().parse(fd.get("id"));
  await (fd.get("to") === "unread" ? markUnread(actor, id) : markRead(actor, id)).catch(() => undefined);
  revalidatePath("/notifications");
}

async function markAllAction() {
  "use server";
  await markAllRead(await requireActor());
  revalidatePath("/notifications");
}

export const metadata = { title: "Notifications" };

/** Icon and colour by what happened, from the event type (task.assigned, task.overdue, …). */
function look(type: string): { icon: IconName; cls: string } {
  if (type.includes("overdue")) return { icon: "overdue", cls: "bg-danger-soft text-danger" };
  if (type.startsWith("comment") || type.includes("comment")) return { icon: "comment", cls: "bg-success-soft text-success" };
  if (type.includes("attach") || type.includes("document")) return { icon: "documents", cls: "bg-warning-soft text-warning" };
  if (type.startsWith("task")) return { icon: "tasks", cls: "bg-info-soft text-info" };
  return { icon: "projects", cls: "bg-[#ecefec] text-body" };
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string; unread?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const unreadOnly = sp.unread === "1";
  const [{ rows, total }, unread, all] = await Promise.all([
    listForUser(actor, { page, pageSize: PAGE_SIZE, unreadOnly }),
    listForUser(actor, { page: 1, pageSize: 1, unreadOnly: true }),
    listForUser(actor, { page: 1, pageSize: 1 }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex max-w-[860px] flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Notifications</h1>
          <p className="mt-1 text-muted">{unread.total ? `${unread.total} unread` : "Nothing new"}</p>
        </div>
        <form action={markAllAction}>
          <button type="submit" className="min-h-11 rounded-lg border border-field bg-surface px-4 font-medium text-foreground hover:bg-primary-soft">
            Mark all as read
          </button>
        </form>
      </div>

      <FilterPills
        label="Filter notifications"
        pills={[
          { label: "All", href: "/notifications", count: all.total, active: !unreadOnly },
          { label: "Unread", href: "/notifications?unread=1", count: unread.total, active: unreadOnly },
        ]}
      />

      <section aria-label="Notifications" className="rounded-lg border border-border bg-surface">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-muted">You are all caught up. New updates show here.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {rows.map((n) => {
              const l = look(n.type);
              return (
                <li key={n.id} className={cn("flex flex-wrap items-center gap-3.5 border-t border-border px-5 py-3.5 first:border-t-0", !n.read && "bg-[#f3faf6]")}>
                  <span className={cn("inline-flex size-[38px] flex-none items-center justify-center rounded-full", l.cls)}>
                    <Icon name={l.icon} size={18} />
                  </span>
                  <span className="min-w-0 flex-[1_1_280px]">
                    <span className={cn("block", n.read ? "font-normal" : "font-semibold")}>{n.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {n.body ? `${n.body} · ` : ""}
                      <time dateTime={n.createdAt.toISOString()}>{formatDateTime(n.createdAt, actor.timezone)}</time>
                    </span>
                  </span>
                  {!n.read ? <span className="text-xs font-semibold text-primary-ink">New</span> : null}
                  {n.href ? (
                    <Link href={n.href} className="text-[13px] font-medium text-primary-ink hover:text-primary-hover">
                      Open
                    </Link>
                  ) : null}
                  <form action={toggleReadAction}>
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="to" value={n.read ? "unread" : "read"} />
                    <button type="submit" className="min-h-11 rounded-lg px-3 text-[13px] font-medium text-body hover:bg-primary-soft">
                      {n.read ? "Mark unread" : "Mark read"}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <Pager
        page={page}
        pages={pages}
        prevHref={page > 1 ? { query: { ...sp, page: page - 1 } } : undefined}
        nextHref={page < pages ? { query: { ...sp, page: page + 1 } } : undefined}
      />
    </div>
  );
}
