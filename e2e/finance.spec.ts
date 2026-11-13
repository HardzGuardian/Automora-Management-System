import { expect, test, type Page } from "@playwright/test";
import { ADMIN, login } from "./helpers";

test.describe.configure({ mode: "serial" });

async function pickClient(page: Page): Promise<void> {
  await page.locator("select[name=clientId]").selectOption({ index: 1 });
}

test("invoice → issue → pending receipt → confirm: the balance falls and the dashboard follows", async ({ page }) => {
  await login(page, ADMIN);

  await page.goto("/invoices/new");
  await pickClient(page);
  await page.getByLabel("Due date").fill("2099-12-31");
  await page.getByLabel("Description").fill("E2E consulting");
  await page.getByLabel("Unit price").fill("1000");
  await page.getByLabel("Tax rate (%)").fill("18");
  await page.getByRole("button", { name: "Create draft invoice" }).click();
  await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/);
  await expect(page.getByText("1,180.00").first()).toBeVisible();

  await page.getByRole("button", { name: "Issue invoice" }).click();
  await expect(page.getByText(/INV-\d{4}-\d{6}/).first()).toBeVisible();
  const invoiceUrl = page.url();

  await page.getByLabel("Amount").fill("500");
  await page.getByLabel("Payment date").fill("2026-11-13");
  await page.getByLabel("Reference").fill("UTR-E2E-1");
  await page.getByRole("button", { name: "Record pending receipt" }).click();
  await expect(page.getByText("pending", { exact: false }).first()).toBeVisible();

  await page.goto("/payments");
  await page.getByRole("link", { name: /INV-/ }).first().click();
  await page.getByRole("button", { name: "Confirm receipt" }).click();
  await expect(page.getByText("confirmed", { exact: false }).first()).toBeVisible();

  await page.goto(invoiceUrl);
  await expect(page.getByText("680.00").first()).toBeVisible(); // 1180 - 500 outstanding

  // The dashboard's finance snapshot reflects it (point-in-time outstanding receivables).
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "Finance snapshot" })).toContainText("680.00");
});

test("expense → pending payment → confirm", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/expenses/new");
  await page.locator("select[name=categoryId]").selectOption({ index: 1 });
  await page.getByLabel("Payee/vendor").fill("E2E Cloud Vendor");
  await page.getByLabel("Description").fill("Hosting for E2E");
  await page.getByLabel("Expense date").fill("2026-11-10");
  await page.getByLabel("Total").fill("300");
  await page.getByRole("button", { name: "Create expense" }).click();
  await page.waitForURL(/\/expenses\/[0-9a-f-]{36}$/);

  await page.getByLabel("Amount").fill("300");
  await page.getByLabel("Payment date").fill("2026-11-12");
  await page.getByLabel("Reference").fill("UTR-E2E-EXP");
  await page.getByRole("button", { name: "Record pending payment" }).click();
  await page.getByRole("button", { name: "Confirm payment" }).click();
  await expect(page.getByText("confirmed", { exact: false }).first()).toBeVisible();

  // Attach a receipt and download it through the permission-checked route.
  await page.getByLabel("Attach a receipt").setInputFiles({ name: "receipt.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nE2E receipt\n%%EOF\n") });
  await page.getByRole("button", { name: "Upload receipt" }).click();
  const link = page.getByRole("link", { name: "receipt.pdf" });
  await expect(link).toBeVisible();
  const res = await page.request.get((await link.getAttribute("href"))!);
  expect(res.status()).toBe(200);
  expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("finance reports page shows the period summary and exports CSV", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/finance-reports?preset=quarter");
  await expect(page.getByRole("region", { name: "Summary" })).toContainText("INR");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Export CSV" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^finance-receivables-.*\.csv$/);
});
