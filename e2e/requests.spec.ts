import { expect, test } from "@playwright/test";
import { ADMIN, EMPLOYEE, login } from "./helpers";

test("tasks search: typing shows a dropdown of matching tasks; pick one with the mouse or the keyboard", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/tasks");
  const search = page.getByRole("combobox", { name: "Search" });

  // No Enter needed: the matches appear while typing.
  await search.fill("login");
  const list = page.getByRole("listbox", { name: "Matching tasks" });
  const option = list.getByRole("option", { name: /Fix login bug/ });
  await expect(option).toBeVisible();
  await expect(list.getByRole("option")).toHaveCount(1);

  await option.click();
  await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name: "Fix login bug" })).toBeVisible();

  // Keyboard: arrow to the match and Enter opens it.
  await page.goto("/tasks");
  await page.getByRole("combobox", { name: "Search" }).fill("design");
  await expect(page.getByRole("listbox", { name: "Matching tasks" }).getByRole("option", { name: /Design homepage/ })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Design homepage" })).toBeVisible();

  // Nothing matches: a clear message, and Escape closes the dropdown.
  await page.goto("/tasks");
  await page.getByRole("combobox", { name: "Search" }).fill("zzzz-no-such-task");
  await expect(page.getByText("No tasks match")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("No tasks match")).toHaveCount(0);
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
  await page.getByRole("link", { name: "New task" }).click();
  await expect(page.getByRole("heading", { name: "New task" })).toBeVisible();
  await expect(page.getByLabel("Client")).toHaveCount(0);
  await page.getByLabel("Title").fill("Review the draft with Asha");
  await page.getByLabel("Asha Admin").check();
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name: "Review the draft with Asha" })).toBeVisible();
  await expect(page.getByText("Asha Admin").first()).toBeVisible();
});
