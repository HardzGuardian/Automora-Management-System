import { describe, expect, it } from "vitest";
import { MANAGER_KEYS, workWorld } from "@/test/work";
import { addClientItem, addProjectComment, listClientItems, listProjectComments, setClientItemReceived } from "./collab";

async function setup() {
  const w = await workWorld([...MANAGER_KEYS, "projects.update"]);
  const member = await w.employee();
  const outsider = await w.employee();
  const project = await w.project({ members: [member.employeeId] });
  return { w, member, outsider, project };
}

describe("project comments", () => {
  it("lets members post and read, newest first, with the author's name", async () => {
    const s = await setup();
    await addProjectComment(s.member.actor, s.project.id, "  First update  ");
    await addProjectComment(s.w.manager, s.project.id, "Second update");
    const list = await listProjectComments(s.member.actor, s.project.id);
    expect(list.map((c) => c.body)).toEqual(["Second update", "First update"]);
    expect(list[0].authorName).toBeTruthy();
  });

  it("rejects empty or oversized text, outsiders, and people without comment rights", async () => {
    const s = await setup();
    await expect(addProjectComment(s.member.actor, s.project.id, "   ")).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(addProjectComment(s.member.actor, s.project.id, "x".repeat(2001))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(addProjectComment(s.outsider.actor, s.project.id, "hi")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(listProjectComments(s.outsider.actor, s.project.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const mute = await s.w.employee(["tasks.status.update.own"]);
    await expect(addProjectComment(mute.actor, s.project.id, "hi")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("stays inside the company", async () => {
    const s = await setup();
    const other = await workWorld();
    await expect(addProjectComment(other.manager, s.project.id, "hi")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("client input", () => {
  it("adds items, marks them received and reopens them", async () => {
    const s = await setup();
    await addClientItem(s.w.manager, s.project.id, { title: "Logo files", detail: " needed for the homepage " });
    const [item] = await listClientItems(s.member.actor, s.project.id);
    expect(item).toMatchObject({ title: "Logo files", detail: "needed for the homepage", received: false });
    await setClientItemReceived(s.w.manager, s.project.id, item.id, true);
    expect((await listClientItems(s.member.actor, s.project.id))[0].received).toBe(true);
    await setClientItemReceived(s.w.manager, s.project.id, item.id, false);
    expect((await listClientItems(s.member.actor, s.project.id))[0].received).toBe(false);
  });

  it("only people who can update the project change the list; invalid input is refused", async () => {
    const s = await setup();
    await expect(addClientItem(s.member.actor, s.project.id, { title: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(addClientItem(s.w.manager, s.project.id, { title: "  " })).rejects.toMatchObject({ code: "VALIDATION" });
    await addClientItem(s.w.manager, s.project.id, { title: "Real" });
    const [item] = await listClientItems(s.w.manager, s.project.id);
    await expect(setClientItemReceived(s.member.actor, s.project.id, item.id, true)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setClientItemReceived(s.w.manager, s.project.id, "00000000-0000-4000-8000-000000000000", true)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(listClientItems(s.outsider.actor, s.project.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
