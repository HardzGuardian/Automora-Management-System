import { expect, type Page } from "@playwright/test";

export const PASSWORD = "e2e-password-123";
export const ADMIN = "admin@e2e.test";
export const EMPLOYEE = "employee@e2e.test";

export async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
}

/** Pages every signed-in user can open. */
export const COMMON_ROUTES = ["/dashboard", "/my-tasks", "/tasks", "/projects", "/notifications", "/profile", "/search?q=north"];
/** Pages that need admin permissions. */
export const ADMIN_ROUTES = ["/clients", "/employees", "/reports", "/reports/task-register", "/reports/employee-workload", "/settings/company", "/settings/roles", "/invoices", "/payments", "/expenses", "/finance-reports", "/tasks/calendar", "/tasks/new", "/projects/new", "/clients/new", "/employees/new"];

export async function expectNoPageOverflow(page: Page, url = page.url()): Promise<void> {
  const { scrollW, clientW } = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }));
  expect(scrollW, `${url} must not scroll horizontally`).toBeLessThanOrEqual(clientW);
}

/** Value of the <option> whose text contains `text` (option labels carry a generated code prefix). */
export async function optionValue(page: Page, selector: string, text: string): Promise<string> {
  const option = page.locator(selector).locator("option", { hasText: text });
  return (await option.first().getAttribute("value")) ?? "";
}
