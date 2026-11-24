import { expect, test } from "@playwright/test";
import { ADMIN, EMPLOYEE, login } from "./helpers";

test.describe.configure({ mode: "serial" });

test("employee page has all six views: Overview, Assigned, Completed, Overdue, Projects, Activity", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/employees");
  const row = page.getByRole("region", { name: "Employees" }).locator("li", { hasText: "Ravi Employee" });
  await row.locator("summary").click();
  await row.getByRole("link", { name: "Open full profile" }).click();
  await page.waitForURL(/\/employees\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Ravi Employee" })).toBeVisible(); // overview

  const views = page.getByRole("navigation", { name: "Work view" });
  for (const label of ["Assigned", "Completed", "Overdue", "Projects", "Activity"]) {
    await expect(views.getByRole("link", { name: label })).toBeVisible();
  }
  await views.getByRole("link", { name: "Projects" }).click();
  await expect(page).toHaveURL(/tab=projects/);
  await expect(page.getByRole("link", { name: /Northwind Website/ })).toBeVisible();

  await views.getByRole("link", { name: "Activity" }).click();
  await expect(page).toHaveURL(/tab=activity/);
  await expect(page.getByRole("region", { name: /Work/ }).first()).toBeVisible();
});

test("client page shows the client's projects first; a project opens its unpaid charges, invoices and tasks", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/clients");
  await page.getByText("Northwind Traders").first().click(); // opens the client's row
  await page.getByRole("listitem").filter({ hasText: "Northwind Traders" }).getByRole("link", { name: "Client details and notes" }).click();
  await page.waitForURL(/\/clients\/[0-9a-f-]{36}$/);

  // The client page itself: projects (and the client's own notes), not the project-level lists.
  for (const title of ["Projects", "Notes"]) {
    await expect(page.getByRole("heading", { name: new RegExp(`^${title}`) }).first()).toBeVisible();
  }
  for (const title of ["Tasks", "Invoices", "Receipts", "Unpaid charges"]) {
    await expect(page.getByRole("heading", { name: new RegExp(`^${title}`) })).toHaveCount(0);
  }

  // Clicking a project opens a pop-up with that project's own details.
  await page.getByRole("link", { name: /Northwind Website/ }).click();
  const popup = page.getByRole("dialog", { name: "Create" });
  await expect(popup).toBeVisible();
  for (const title of ["Unpaid charges", "Invoices", "Tasks"]) {
    await expect(popup.getByRole("heading", { name: new RegExp(`^${title}`) })).toBeVisible();
  }
  await expect(popup.getByText("Design homepage")).toBeVisible(); // a task of this project
});

test("a project is only shown under its own client", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/projects");
  await page.getByRole("link", { name: "Open project details" }).first().click();
  const projectId = page.url().match(/\/projects\/([0-9a-f-]{36})/)?.[1] ?? "";
  const res = await page.goto(`/clients/00000000-0000-4000-8000-000000000000/projects/${projectId}`);
  expect(res?.status()).toBe(404);
});

test("project page lists its invoices, receipts and expenses", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/projects");
  await page.locator("details").evaluateAll((all) => all.forEach((d) => d.setAttribute("open", "")));
  await page.locator("details", { hasText: "Northwind Website" }).getByRole("link", { name: "Open project details" }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const tabs = page.getByRole("group", { name: "Project sections and actions" });
  for (const label of ["Tasks", "Documents", "Team", "Milestones", "Finance"]) {
    await expect(tabs.getByRole("link", { name: new RegExp(`^${label}`) })).toBeVisible();
  }
  await tabs.getByRole("link", { name: /^Finance/ }).click();
  for (const title of ["Invoices", "Receipts", "Expenses"]) {
    await expect(page.getByRole("heading", { name: new RegExp(`^${title}`) }).first()).toBeVisible();
  }
});

test("an employee without finance access sees no finance lists on a project", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/projects");
  await page.locator("details").evaluateAll((all) => all.forEach((d) => d.setAttribute("open", "")));
  const link = page.locator("details", { hasText: "Northwind Website" }).getByRole("link", { name: "Open project details" });
  if (await link.count()) {
    await link.click();
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("group", { name: "Project sections and actions" }).getByRole("link", { name: /^Finance/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /^Invoices/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /^Receipts/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /^Expenses/ })).toHaveCount(0);
  }
});
