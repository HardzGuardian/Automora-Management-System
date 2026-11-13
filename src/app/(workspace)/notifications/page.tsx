import Link from "next/link";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatDateTime } from "@/components/ui/format";
import { PageHeader } from "@/components/ui/page-header";
import { Pager } from "@/components/ui/pager";
import { EmptyState } from "@/components/ui/states";
import { buttonClass, linkClass } from "@/components/ui/styles";
import { requireActor } from "@/lib/auth/require-actor";
import { listForUser, markAllRead, markRead } from "@/modules/notifications";

const PAGE_SIZE = 20;

async function markReadAction(fd: FormData) {
  "use server";
  const actor = await requireActor();
  await markRead(actor, z.string().uuid().parse(fd.get("id"))).catch(() => undefined);
  revalidatePath("/notifications");
}

async function markAllAction() {
  "use server";
  await markAllRead(await requireActor());
  revalidatePath("/notifications");
}

export const metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string; unread?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const unreadOnly = sp.unread === "1";
  const { rows, total } = await listForUser(actor, { page, pageSize: PAGE_SIZE, unreadOnly });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Notifications"
        description={unreadOnly ? "Showing unread notifications only." : "Assignments, reviews and reminders for you."}
        actions={
          <>
            <Link href={{ query: { unread: unreadOnly ? undefined : "1" } }} className={buttonClass("secondary")}>
              {unreadOnly ? "Show all" : "Unread only"}
            </Link>
            <form action={markAllAction}>
              <button type="submit" className={buttonClass("secondary")}>
                Mark all as read
              </button>
            </form>
          </>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title={unreadOnly ? "No unread notifications" : "You are all caught up"} description="Assignments, reviews and reminders will appear here." />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface shadow-sm">
          {rows.map((n) => (
            <li key={n.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 p-3">
              <div className="min-w-0 flex-1">
                <p className={n.read ? "text-muted" : "font-medium"}>
                  {!n.read ? <span className="mr-2 rounded-full bg-info-soft px-2 py-0.5 text-xs font-medium text-info">New</span> : null}
                  {n.href ? (
                    <Link href={n.href} className={linkClass}>
                      {n.title}
                    </Link>
                  ) : (
                    n.title
                  )}
                </p>
                {n.body ? <p className="mt-0.5 text-sm text-muted">{n.body}</p> : null}
                <time dateTime={n.createdAt.toISOString()} className="mt-0.5 block text-xs text-muted">
                  {formatDateTime(n.createdAt, actor.timezone)}
                </time>
              </div>
              {!n.read ? (
                <form action={markReadAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <button type="submit" className={buttonClass("ghost", "min-h-8 px-2.5 text-xs")}>
                    Mark read
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Pager
        page={page}
        pages={pages}
        prevHref={page > 1 ? { query: { ...sp, page: page - 1 } } : undefined}
        nextHref={page < pages ? { query: { ...sp, page: page + 1 } } : undefined}
      />
    </div>
  );
}
