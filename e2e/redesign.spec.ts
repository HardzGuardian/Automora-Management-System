import { expect, test } from "@playwright/test";
import { ADMIN, EMPLOYEE, login } from "./helpers";

test.describe.configure({ mode: "serial" });

const PDF = Buffer.from("%PDF-1.7\nE2E brief\n%%EOF\n");

test("new project: details, a reference document and a team; the document shows in the library and downloads", async ({ page }) => {
  await login(page, ADMIN);
  const name = `Redesign ${Date.now().toString().slice(-6)}`;
  await page.goto("/projects/new");
  await page.locator("#np-name").fill(name);
  await page.locator("#np-client").selectOption({ label: "Northwind Traders" });
  await page.setInputFiles("#np-files", { name: "brief.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByText("brief.pdf")).toBeVisible();

  // The team is required, and the page says so.
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Choose the team" })).toBeVisible();

  await page.getByRole("button", { name: /Team A/ }).click();
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("status")).toContainText("1 reference document");
  await expect(page.getByRole("status")).toContainText("Ravi Employee");

  await page.goto("/documents");
  await page.getByLabel("Search documents").fill("brief");
  await page.getByRole("button", { name: "Search" }).click();
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("brief.pdf");
  const res = await page.request.get((await row.getByRole("link", { name: /Download/ }).getAttribute("href"))!);
  expect(res.status()).toBe(200);
  expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("a team member sees the project and its document, but cannot upload", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/projects");
  await page.locator("details").evaluateAll((all) => all.forEach((d) => d.setAttribute("open", "")));
  await page.locator("details", { hasText: /Redesign/ }).first().getByRole("link", { name: "Open project details" }).click();
  await page.getByRole("group", { name: "Project sections and actions" }).getByRole("link", { name: /^Documents/ }).click();
  await expect(page.getByText("brief.pdf")).toBeVisible();
  await expect(page.getByText("Only admins can upload or remove documents")).toBeVisible();
  await expect(page.getByLabel(/Drop a file here/)).toHaveCount(0);
});

test("project tabs: comments are posted, client input is tracked", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/projects");
  await page.locator("details").evaluateAll((all) => all.forEach((d) => d.setAttribute("open", "")));
  await page.locator("details", { hasText: "Northwind Website" }).getByRole("link", { name: "Open project details" }).click();
  const tabs = page.getByRole("group", { name: "Project sections and actions" });

  await tabs.getByRole("link", { name: /^Comments/ }).click();
  await page.getByLabel("Add a comment").fill("Client approved the sitemap.");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText("Client approved the sitemap.")).toBeVisible();

  await tabs.getByRole("link", { name: /^Client input/ }).click();
  await page.getByLabel("What are you waiting for").fill("Logo files and brand colours");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("Waiting on client")).toBeVisible();
  await page.getByRole("button", { name: /Mark received/ }).click();
  await expect(page.getByText("Received", { exact: true }).first()).toBeVisible();
});

test("team page lists teams; opening one shows members with task counts; search narrows; Add team is a modal", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/teams");
  await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage teams" })).toHaveCount(0);
  const teams = page.getByRole("region", { name: "Teams" });
  await teams.locator("summary").first().click();
  await expect(teams.getByRole("row", { name: /Ravi Employee/ })).toContainText(/[0-9]/);
  await page.getByLabel("Search teams").fill("zzz-no-such-team");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText(/No team matches/)).toBeVisible();
  await page.getByRole("link", { name: "Clear" }).click();
  await page.getByRole("link", { name: "Add team" }).click();
  const dialog = page.getByRole("dialog", { name: "Create" });
  await expect(dialog.getByLabel("Team name")).toBeVisible();
  await expect(dialog.getByLabel(/Team lead/)).toBeVisible();
  await expect(dialog.getByRole("group", { name: /Members/ })).toBeVisible();
});

test("notifications: mark all as read, then mark one unread again", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/notifications");
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByText("Nothing new")).toBeVisible();
  const first = page.getByRole("button", { name: "Mark unread" }).first();
  if (await first.count()) {
    await first.click();
    await expect(page.locator("main").getByText(/\d+ unread/)).toBeVisible();
  }
});

test("my account: details, sign out from the page", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.getByRole("link", { name: /My account/ }).click();
  await expect(page.getByRole("heading", { name: "My account" })).toBeVisible();
  await expect(page.getByText("employee@e2e.test")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).first().click(); // the page-level one; other devices have their own
  await expect(page).toHaveURL(/\/login/);
});

test("sign-in family: password rules appear on the reset form and the 404 page offers a way back", async ({ page }) => {
  await page.goto("/reset-password?token=not-a-real-token");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await expect(page.getByText("At least 10 characters")).toBeVisible();
  await page.getByLabel("Confirm password").fill("short");
  await expect(page.getByText("Both passwords match")).toBeVisible();

  // Signed-out visitors are sent to sign in first, so look at the 404 page as a signed-in person.
  await login(page, ADMIN);
  await page.goto("/definitely-not-a-page");
  await expect(page.getByRole("heading", { name: "We cannot find that page" })).toBeVisible();
  await page.getByRole("link", { name: "Go to dashboard" }).click();
  await expect(page).toHaveURL(/\/login|\/dashboard/);
});

test("quick New task panel: validation and success state", async ({ page }) => {
  await login(page, ADMIN);
  await page.getByRole("button", { name: "New task" }).click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("button", { name: "Create task" })).toBeDisabled(); // needs a title and a person
  await panel.getByLabel("Task title").fill("Quick task from the panel");
  await expect(panel.getByRole("button", { name: "Create task" })).toBeDisabled();
  await expect(panel.getByLabel("Project")).toHaveValue(""); // no project: an individual task
  await panel.getByLabel(/Ravi Employee/).check();
  await expect(panel.getByLabel("Due date")).toHaveAttribute("min", /\d{4}-\d{2}-\d{2}/);
  await panel.getByRole("button", { name: "Create task" }).click();
  await expect(panel.getByText("Task created")).toBeVisible();
  await panel.getByRole("button", { name: "Add another" }).click();
  await expect(panel.getByLabel("Task title")).toHaveValue("");
  await panel.getByRole("button", { name: "Close" }).click();
  await page.goto("/tasks");
  await expect(page.getByRole("link", { name: "Quick task from the panel" })).toBeVisible();
});
