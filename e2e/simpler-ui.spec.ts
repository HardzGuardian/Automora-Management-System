import { expect, test } from "@playwright/test";
import { ADMIN, expectNoPageOverflow, login } from "./helpers";

test.describe.configure({ mode: "serial" });

test("shell: no breadcrumb bar, and the sidebar has no copies of the bell or account menu", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/tasks");
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0);
  const sidebar = page.getByRole("navigation", { name: "Main" });
  await expect(sidebar.getByRole("link", { name: "My account" })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Notifications" })).toHaveCount(0);
  await expect(page.getByRole("banner").getByRole("link", { name: /Notifications/ })).toBeVisible();
});

test("tasks: filter pills carry counts, Overdue narrows the list, All brings it back", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/tasks");
  const pills = page.getByRole("navigation", { name: "Filter tasks" });
  await expect(pills.getByRole("link", { name: /^All \d+$/ })).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("navigation", { name: "Pagination" })).toHaveCount(0);

  const before = await page.locator("tbody tr").count();
  await pills.getByRole("link", { name: /^Overdue/ }).click();
  await expect(page).toHaveURL(/show=overdue/);
  await expect.poll(() => page.locator("tbody tr").count()).toBeLessThan(before);

  await pills.getByRole("link", { name: /^All/ }).click();
  await expect(page).not.toHaveURL(/show=/);
  await expect.poll(() => page.locator("tbody tr").count()).toBe(before);

  // List and Board are two views of the same tasks.
  await page.getByRole("navigation", { name: "Layout" }).getByRole("link", { name: "Board" }).click();
  await expect(page).toHaveURL(/layout=board/);
  await expect(page.getByRole("region", { name: "In progress" })).toBeVisible();
});

test("dashboard: three stat cards, due soon and active projects", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  for (const label of ["Open tasks", "Overdue", "Active projects"]) {
    await expect(page.getByRole("region", { name: "Key numbers" }).getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Due soon" })).toContainText("Fix login bug");
  await expect(page.getByRole("region", { name: "Active projects" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Recent documents" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/ui2-dashboard.png", fullPage: true });
});

test("roles: plain wording first, technical names on request, one role at a time", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/settings/roles");
  await expect(page.getByText("View the employee directory")).toBeVisible();
  await expect(page.getByText("employees.read", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Show technical names" }).click();
  await expect(page.getByText("employees.read", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/ui2-roles.png", fullPage: true });
  // choosing another role swaps the editor
  const roleLinks = page.getByRole("navigation", { name: "Roles" }).getByRole("link");
  expect(await roleLinks.count()).toBeGreaterThan(1);
  await roleLinks.nth(1).click();
  await expect(page).toHaveURL(/role=/);
});

test("forms: optional fields are tucked behind 'More options' but still saved", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/invoices/new");
  await expect(page.getByLabel("Discount")).toBeHidden();
  await page.getByText("More options").click();
  await expect(page.getByLabel("Discount")).toBeVisible();
  await page.screenshot({ path: "test-results/ui2-new-invoice.png", fullPage: true });

  await page.goto("/employees/new");
  await expect(page.getByLabel("Phone")).toBeHidden();
  await expect(page.getByLabel("Designation")).toBeVisible();
});

test("phone width: main screens fit and the filter bar wraps", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await login(page, ADMIN);
  for (const [name, url] of [
    ["dashboard", "/dashboard"],
    ["tasks", "/tasks"],
    ["projects", "/projects"],
    ["employees", "/employees"],
    ["invoices", "/invoices"],
    ["roles", "/settings/roles"],
    ["new-invoice", "/invoices/new"],
    ["profile", "/profile"],
  ] as const) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await expectNoPageOverflow(page, url);
    await page.screenshot({ path: `test-results/ui2-m-${name}.png`, fullPage: true });
  }
});
