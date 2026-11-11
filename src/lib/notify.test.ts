import { afterEach, describe, expect, it } from "vitest";
import { notify, resetNotifier, setNotifier, type NotifyEvent } from "./notify";

const event: NotifyEvent = {
  type: "task.assigned",
  userIds: ["u1"],
  entity: { type: "task", id: "t1" },
  eventKey: "task:t1:assigned:e1:1",
  title: "You were assigned a task",
};

afterEach(() => resetNotifier());

describe("notify port", () => {
  it("is a harmless no-op until a notifier is registered", async () => {
    await expect(notify(event)).resolves.toBeUndefined();
  });

  it("forwards events to the registered notifier", async () => {
    const seen: NotifyEvent[] = [];
    setNotifier(async (e) => void seen.push(e));
    await notify(event);
    expect(seen).toEqual([event]);
  });

  it("never throws when the notifier fails (a failed notification must not roll back work)", async () => {
    setNotifier(async () => {
      throw new Error("smtp down");
    });
    await expect(notify(event)).resolves.toBeUndefined();
  });
});
