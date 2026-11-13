import Link from "next/link";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { buttonClass } from "@/components/ui/styles";
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
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
          {rows.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className={n.read ? "text-muted" : "font-semibold"}>
                {!n.read ? <span className="mr-2 rounded-full bg-info-soft px-2 py-0.5 text-xs text-info">New</span> : null}
                {n.href ? (
                  <Link href={n.href} className="underline">
                    {n.title}
                  </Link>
                ) : (
                  n.title
                )}
                {n.body ? <span className="block text-sm font-normal text-muted">{n.body}</span> : null}
              </span>
              <span className="ml-auto text-xs text-muted">{n.createdAt.toLocaleString()}</span>
              {!n.read ? (
                <form action={markReadAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <button type="submit" className="text-sm underline">
                    Mark read
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <nav className="flex items-center gap-3 text-sm" aria-label="Pagination">
        {page > 1 ? (
          <Link href={{ query: { ...sp, page: page - 1 } }} className="underline">
            Previous
          </Link>
        ) : null}
        <span>
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={{ query: { ...sp, page: page + 1 } }} className="underline">
            Next
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
