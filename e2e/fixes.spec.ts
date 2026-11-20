import { expect, test } from "@playwright/test";
import { ADMIN, EMPLOYEE, PASSWORD, login } from "./helpers";

test.describe.configure({ mode: "serial" });

test("employee: no controls that would only fail, and clean no-access pages for finance", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/tasks");
  // Only their own tasks are listed, with a personal heading and no "All" view.
  await expect(page.getByRole("row", { name: /Set up hosting/ })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Filter tasks" }).getByRole("link", { name: /^All/ })).toHaveCount(0);
  await expect(page.getByText("Tasks that are just yours")).toBeVisible();
  // Their own task: a status menu that stops at In Review, and no done tick.
  const own = page.getByLabel("Status for Renew office licence");
  await expect(own).toBeVisible();
  expect(await own.locator("option").allInnerTexts()).not.toContain("Completed");
  await expect(page.getByRole("button", { name: "Complete Renew office licence" })).toHaveCount(0);
  // The employee cannot change someone else's assignee either.
  await expect(page.getByLabel(/Assigned to for/)).toHaveCount(0);
  // Same rules for a task inside a project.
  await page.goto("/projects");
  await page.locator("details").evaluateAll((all) => all.forEach((d) => d.setAttribute("open", "")));
  await expect(page.getByLabel("Status for Design homepage")).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete Design homepage" })).toHaveCount(0);

  for (const url of ["/invoices", "/invoices/new", "/payments", "/expenses", "/expenses/new"]) {
    await page.goto(url);
    await expect(page.getByText(/You do not have access to/), url).toBeVisible();
    await expect(page.getByText("could not be loaded"), url).toHaveCount(0);
  }
});

test("employee: Finance is only their Reports, with no money tabs", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/finance");
  await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Finance sections" })).toHaveCount(0);
});

test("admin: edit a task, archive it, find it under Archived and restore it", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/tasks");
  await page.getByRole("link", { name: "Renew office licence" }).click();
  await page.getByRole("link", { name: "Edit task" }).click(); // opens in a modal
  const edit = page.getByRole("dialog", { name: "Create" });
  await edit.locator("#et-title").fill("Renew office licence v2");
  await edit.locator("#et-priority").selectOption("High");
  await edit.getByRole("button", { name: "Save task" }).click();
  await expect(edit).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Renew office licence v2" })).toBeVisible();

  await page.getByRole("button", { name: "Archive task" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Archive task" }).click();
  await page.waitForURL(/\/tasks$/);
  await expect(page.getByRole("link", { name: "Renew office licence v2" })).toHaveCount(0);

  await page.getByRole("navigation", { name: "Filter tasks" }).getByRole("link", { name: /^Archived/ }).click();
  await page.getByRole("link", { name: "Renew office licence v2" }).click();
  await page.getByRole("button", { name: "Restore task" }).click();
  await expect(page.getByRole("button", { name: "Restore task" })).toHaveCount(0);
  await page.goto("/tasks");
  await expect(page.getByRole("link", { name: "Renew office licence v2" })).toBeVisible();
});

test("admin: a project can be completed, reopened, archived and restored", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/projects");
  await page.locator("details").evaluateAll((all) => all.forEach((d) => d.setAttribute("open", "")));
  await page.locator("details", { hasText: "Northwind Website" }).getByRole("link", { name: "Open project details" }).click();
  const status = () => page.locator("summary[aria-label^='Project status']");
  const pick = async (name: string) => {
    const menu = page.locator("details:has(summary[aria-label^='Project status'])");
    if ((await menu.getAttribute("open")) === null) await status().click(); // the menu can still be open from the last choice
    await page.getByRole("menuitem", { name }).click();
    await page.waitForTimeout(800);
  };
  await pick("Active");
  await expect(status()).toHaveAttribute("aria-label", /Active/);
  await pick("Completed");
  await expect(status()).toHaveAttribute("aria-label", /Completed/);
  await pick("Reopen project");
  await expect(status()).toHaveAttribute("aria-label", /Active/);
  await pick("Completed");
  await page.getByRole("button", { name: /^Archive$/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Archive project" }).click();
  await page.waitForTimeout(800);
  await page.goto("/projects?status=Archived");
  await page.locator("details").evaluateAll((all) => all.forEach((d) => d.setAttribute("open", "")));
  await page.locator("details", { hasText: "Northwind Website" }).getByRole("link", { name: "Open project details" }).click();
  await pick("Restore project");
  await expect(status()).toHaveAttribute("aria-label", /Active/);
});

test("documents are searchable from the search box", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/projects");
  await page.locator("details").evaluateAll((all) => all.forEach((d) => d.setAttribute("open", "")));
  await page.locator("details", { hasText: "Northwind Website" }).getByRole("link", { name: "Open project details" }).click();
  await page.getByRole("group", { name: "Project sections and actions" }).getByRole("link", { name: /^Documents/ }).click();
  await page.setInputFiles("#p-file", { name: "Searchable-brief.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nx\n%%EOF\n") });
  await expect(page.getByText("Searchable-brief.pdf uploaded.")).toBeVisible();
  await page.getByRole("search").getByLabel("Search").fill("Searchable-brief");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /^Documents/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Searchable-brief.pdf" })).toBeVisible();
});

test("clients: a second client with the same name is refused", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/clients/new");
  await page.getByLabel("Client name").fill("northwind traders");
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "already exists" })).toBeVisible();
});

test("account: the new password must differ from the current one", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/profile");
  await page.locator("#current").fill(PASSWORD);
  await page.locator("#next").fill(PASSWORD);
  await page.locator("#confirm").fill(PASSWORD);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "different from the current one" })).toBeVisible();
});

test("employee: log time on their own task from the task page", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/projects");
  await page.locator("details").evaluateAll((all) => all.forEach((d) => d.setAttribute("open", "")));
  await page.getByRole("link", { name: "Design homepage" }).click();
  await page.locator("#log-hours").fill("3.5");
  await page.getByRole("button", { name: "Save hours" }).click();
  await expect(page.locator("#log-hours")).toHaveValue("3.50");
  await expect(page.getByText("3.50").first()).toBeVisible();
});

test("employee: a team member sees teammates but only their own tasks", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/teams");
  await expect(page.getByRole("region", { name: "Team summary" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "People" })).toContainText("Asha Admin");
  await expect(page.getByRole("link", { name: /Asha Admin/ })).toHaveCount(0); // teammates are names only, no work pages
  await expect(page.getByRole("region", { name: "Selected person's work" })).toContainText("Design homepage");
});

test("finance: filter by status and clear; the tab counts stay put", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/finance?tab=invoices");
  await page.getByLabel("Status").selectOption("paid"); // applies at once, there is no Apply button
  await expect(page).toHaveURL(/status=paid/);
  await expect(page.getByText("No invoices match these filters.")).toBeVisible();
  await page.getByRole("link", { name: "Clear" }).click();
  await expect(page).not.toHaveURL(/status=/);
  await page.getByRole("navigation", { name: "Finance sections" }).getByRole("link", { name: /^Expenses/ }).click();
  await expect(page.getByLabel("Status")).toContainText("Unpaid");
});

test("dashboard: the set-up checklist is hidden once people, a team, a client and a project exist", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Get started" })).toHaveCount(0);
});

test("employees: search and status pills", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/employees");
  await expect(page.getByRole("link", { name: "Ravi Employee" })).toBeVisible();
  await page.getByRole("navigation", { name: "Filter by status" }).getByRole("link", { name: /^Suspended/ }).click();
  await expect(page.getByText("No employees match.")).toBeVisible();
  await page.getByRole("navigation", { name: "Filter by status" }).getByRole("link", { name: /^All/ }).click();
  await expect(page).not.toHaveURL(/status=/);
  await page.getByLabel("Search employees").fill("ravi");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "Ravi Employee" })).toBeVisible();
  await expect(page.locator("#main").getByRole("link", { name: "Asha Admin" })).toHaveCount(0);
});
