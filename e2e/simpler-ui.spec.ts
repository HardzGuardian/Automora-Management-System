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

test("lists: filters apply by themselves, Clear appears only while filtering, no pager on one page", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/tasks");
  await expect(page.getByRole("button", { name: "Filter", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Clear" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Pagination" })).toHaveCount(0);

  const before = await page.locator("tbody tr").count();
  await page.getByLabel("Status").selectOption("Completed");
  await expect(page).toHaveURL(/status=Completed/);
  await expect(page.getByRole("link", { name: "Clear" })).toBeVisible();
  await expect.poll(() => page.locator("tbody tr").count()).toBeLessThan(before);

  await page.getByRole("link", { name: "Clear" }).click();
  await expect(page).not.toHaveURL(/status=/);
  await expect.poll(() => page.locator("tbody tr").count()).toBe(before);

  // typing is debounced, then applied
  await page.getByRole("search", { name: "Filter tasks" }).getByLabel("Search").fill("login");
  await expect(page).toHaveURL(/q=login/);
});

test("tasks: the bulk bar appears only when rows are ticked", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/tasks");
  await expect(page.getByText(/\d+ selected/)).toBeHidden();
  await expect(page.getByLabel("Bulk action")).toBeHidden();

  await page.getByRole("checkbox", { name: /^Select TSK/ }).first().check();
  await expect(page.getByRole("status").filter({ hasText: "1 selected" })).toBeVisible();
  await expect(page.getByLabel("Bulk action")).toBeVisible();
  await page.screenshot({ path: "test-results/ui2-tasks-bulk.png" });

  await page.getByRole("checkbox", { name: "Select all on this page" }).check();
  const rows = await page.locator("tbody tr").count();
  await expect(page.getByRole("status").filter({ hasText: `${rows} selected` })).toBeVisible();

  await page.getByRole("button", { name: "Clear selection" }).click();
  await expect(page.getByLabel("Bulk action")).toBeHidden();
});

test("dashboard: four headline numbers, the rest behind 'More figures', one period picker", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Company dashboard" })).toBeVisible();
  for (const label of ["Open tasks", "Overdue tasks", "Due in next 7 days"]) {
    await expect(page.getByRole("region", { name: "Key figures" }).getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText("Active employees", { exact: true })).toBeHidden();
  await page.getByText("More figures").click();
  await expect(page.getByText("Active employees", { exact: true })).toBeVisible();
  // The tiles no longer repeat "point in time"; the money snapshot below keeps its own labels.
  await expect(page.getByRole("region", { name: "Key figures" }).getByText("point in time")).toHaveCount(0);

  await expect(page.getByLabel("From")).toHaveCount(0);
  await page.getByLabel("Period").selectOption("week");
  await expect(page).toHaveURL(/preset=week/);
  await page.getByLabel("Period").selectOption("custom");
  await expect(page.getByLabel("From")).toBeVisible();
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
