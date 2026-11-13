/**
 * Port for in-app notifications. The implementation (modules/notifications) belongs to
 * Shubhangi and registers itself with setNotifier(); until then notify() is a no-op.
 * notify() is always called AFTER the main transaction commits and never throws:
 * a failed notification must not roll back a task or payment (ADR-11).
 */
export type NotifyEvent = {
  type: string;
  userIds: string[];
  entity: { type: string; id: string };
  /** Stable key used to deduplicate, e.g. task:{id}:assigned:{assigneeId}:{assignedAt}. */
  eventKey: string;
  title: string;
  body?: string;
};

export type Notifier = (event: NotifyEvent) => Promise<void>;

// Held on globalThis (like the db pool) so a notifier registered from instrumentation.ts is visible
// to route handlers and server actions even when the bundler gives them separate module instances.
const globalForNotify = globalThis as unknown as { __automoraNotifier?: Notifier | null };

export function setNotifier(fn: Notifier): void {
  globalForNotify.__automoraNotifier = fn;
}

export function resetNotifier(): void {
  globalForNotify.__automoraNotifier = null;
}

export async function notify(event: NotifyEvent): Promise<void> {
  const current = globalForNotify.__automoraNotifier;
  if (!current) return;
  try {
    await current(event);
  } catch {
    // Swallowed on purpose; delivery problems are the notifier's concern.
  }
}
