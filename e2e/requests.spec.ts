import { expect, test } from "@playwright/test";
import { ADMIN, EMPLOYEE, login } from "./helpers";

test("tasks search: typing filters the list below, with no pop-up and no Enter", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/tasks", { waitUntil: "networkidle" }); // wait until the page is interactive before typing
  const search = page.getByPlaceholder("Search tasks by title or code...");
  const rows = page.locator("tbody tr");
  const all = await rows.count();
  expect(all).toBeGreaterThan(1);

  await search.fill("login");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Fix login bug");
  await expect(page).toHaveURL(/q=login/);
  // The list itself is the result: nothing pops up over the page.
  await expect(page.getByRole("listbox")).toHaveCount(0);

  // A code works too, and clearing the box brings every task back.
  await search.fill("TSK-000001");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Design homepage");
  await search.fill("");
  await expect(rows).toHaveCount(all);

  // Nothing matches: the list says so.
  await search.fill("zzzz-no-such-task");
  await expect(rows).toHaveCount(0);
});

test("every list search filters as you type, with no Enter", async ({ page }) => {
  await login(page, ADMIN);
  const searches: [string, string][] = [
    ["/projects", "Search projects by name or code..."],
    ["/clients", "Search clients"],
    ["/employees", "Search name, email or code"],
    ["/documents", "Search by file name"],
    ["/teams", "Search teams by name"],
    ["/settings/users", "Search by name or email"],
    ["/search", "Search projects, tasks, documents"],
  ];
  for (const [url, placeholder] of searches) {
    await page.goto(url, { waitUntil: "networkidle" }); // interactive before typing
    const box = page.getByPlaceholder(placeholder, { exact: true });
    await box.fill("zzz-none");
    await expect(page, `${url} should filter while typing`).toHaveURL(/q=zzz-none/);
    await box.fill("");
    await expect(page, `${url} should clear the filter`).not.toHaveURL(/q=/);
  }

  // The list itself narrows, and everyone is back when the box is cleared.
  await page.goto("/employees", { waitUntil: "networkidle" });
  const list = page.getByRole("region", { name: "Employees" });
  await expect(list).toContainText("Asha Admin");
  await page.getByPlaceholder("Search name, email or code").fill("Ravi");
  await expect(list).toContainText("Ravi Employee");
  await expect(list).not.toContainText("Asha Admin");
  await page.getByPlaceholder("Search name, email or code").fill("");
  await expect(list).toContainText("Asha Admin");
});

test("employee: adds a task to their own project (to themselves, then to a teammate)", async ({ page }) => {
  await login(page, EMPLOYEE);

  // Inline form on the project's Tasks tab.
  await page.goto("/projects");
  await page.getByRole("link", { name: "Open project details" }).first().click();
  await expect(page.getByText("Only admins create and assign tasks")).toHaveCount(0);
  await page.getByPlaceholder("Add a task to this project").fill("Prepare handover notes");
  await expect(page.getByLabel("Assign new task to")).toHaveValue(/.+/); // defaults to themselves
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByRole("link", { name: "Prepare handover notes" })).toBeVisible();

  // The full form from the Tasks page: only their projects, a project is required, and teammates can be picked.
  await page.goto("/tasks");
  await page.getByRole("main").getByRole("link", { name: "New task" }).click();
  await expect(page.getByRole("heading", { name: "New task" })).toBeVisible();
  await expect(page.getByLabel("Client")).toHaveCount(0);
  await page.getByLabel("Title").fill("Review the draft with Asha");
  await page.getByLabel("Asha Admin").check();
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name: "Review the draft with Asha" })).toBeVisible();
  await expect(page.getByText("Asha Admin").first()).toBeVisible();
});
