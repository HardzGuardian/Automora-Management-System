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

let current: Notifier | null = null;

export function setNotifier(fn: Notifier): void {
  current = fn;
}

export function resetNotifier(): void {
  current = null;
}

export async function notify(event: NotifyEvent): Promise<void> {
  if (!current) return;
  try {
    await current(event);
  } catch {
    // Swallowed on purpose; delivery problems are the notifier's concern.
  }
}
