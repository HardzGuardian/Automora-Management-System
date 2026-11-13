import { expect, test } from "@playwright/test";
import { ADMIN, EMPLOYEE, login } from "./helpers";

test.describe.configure({ mode: "serial" });

const probe = `probe-${Date.now()}@example.test`;

test("a failed sign-in is recorded and shown to an administrator", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(probe);
  await page.getByLabel("Password").fill("not-the-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();

  await login(page, ADMIN);
  await page.goto("/settings/security");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Security" })).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: probe });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Failed sign-in");
  await expect(row).toContainText("wrong email or password");
  await page.screenshot({ path: "test-results/ui3-security.png", fullPage: true });
});

test("a denied action by an employee shows up, and the filter narrows the list", async ({ page }) => {
  await login(page, EMPLOYEE);
  // An employee asks for an invoice PDF: the finance service refuses (403) and the refusal is recorded.
  const res = await page.request.get("/api/invoices/00000000-0000-4000-8000-000000000000/pdf");
  expect(res.status()).toBe(403);
  await page.context().clearCookies();

  await login(page, ADMIN);
  await page.goto("/settings/security");
  await expect(page.getByRole("row").filter({ hasText: "Ravi Employee tried: View invoices" }).first()).toBeVisible();

  await page.getByLabel("Event type").selectOption("permission_denied");
  await expect(page).toHaveURL(/type=permission_denied/);
  await expect(page.getByRole("row").filter({ hasText: probe })).toHaveCount(0); // sign-in rows are filtered out
  await expect(page.getByRole("row").filter({ hasText: "Permission denied" }).first()).toBeVisible();
});

test("the summary counts the last 24 hours", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/settings/security");
  const tile = page.getByRole("region", { name: "Last 24 hours" });
  await expect(tile.getByText("Failed sign-ins")).toBeVisible();
  await expect(tile.getByText("Permission denied")).toBeVisible();
});

test("an employee cannot open the Security page", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto("/settings/security");
  // Next streams its not-found page with a 200, so check what is shown: no data, just "not found".
  await expect(page.getByText(/not found|can.t find/i).first()).toBeVisible();
  await expect(page.getByText("Failed sign-ins")).toHaveCount(0);
  await expect(page.getByText("Permission denied")).toHaveCount(0);
});
