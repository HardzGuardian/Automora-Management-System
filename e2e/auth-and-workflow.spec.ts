import { expect, test } from "@playwright/test";
import { ADMIN, EMPLOYEE, login } from "./helpers";

test.describe("authentication", () => {
  test("unauthenticated visitors are sent to login", async ({ page }) => {
    await page.goto("/tasks");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a wrong password shows an error and does not sign in", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN);
    await page.getByLabel("Password").fill("definitely-wrong-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("[role=alert]", { hasText: "Invalid email or password" })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("sign in, see the shell, sign out", async ({ page }) => {
    await login(page, ADMIN);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Finance" })).toBeVisible();
    await page.getByRole("link", { name: /My account/ }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("permission-aware navigation and access", () => {
  test("an employee sees a reduced menu, a personal dashboard, and cannot open admin pages", async ({ page }) => {
    await login(page, EMPLOYEE);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const hidden of ["Finance", "Clients", "Settings"]) {
      await expect(nav.getByRole("link", { name: hidden, exact: true })).toHaveCount(0);
    }
    for (const shown of ["Dashboard", "Projects", "Tasks", "Documents", "Team"]) {
      await expect(nav.getByRole("link", { name: shown, exact: true })).toBeVisible();
    }
    // Only admins get the quick New task button.
    await expect(page.getByRole("button", { name: "New task" })).toHaveCount(0);
    // Direct URL access is still refused by the server, not just hidden.
    for (const url of ["/settings/company", "/finance-reports", "/employees", "/clients"]) {
      await page.goto(url);
      await expect(page.getByText(/not found|do not have|can.t find|cannot find/i).first()).toBeVisible();
    }
  });

  test("an employee sees only their own tasks", async ({ page }) => {
    await login(page, EMPLOYEE);
    await page.goto("/tasks");
    await expect(page.getByRole("link", { name: "Design homepage" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Fix login bug" })).toBeVisible();
    // Tasks that belong to other people in the same project are not on an employee's page.
    await expect(page.getByRole("link", { name: "Set up hosting" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Write launch plan" })).toHaveCount(0);
  });
});

test.describe("workflow: client → project → task", () => {
  test("an admin creates a client, a project for it, and a task, then moves the task along", async ({ page }) => {
    await login(page, ADMIN);
    const unique = Date.now().toString().slice(-6);

    await page.goto("/clients/new");
    await page.getByLabel("Client name").fill(`E2E Client ${unique}`);
    await page.getByRole("button", { name: "Create client" }).click();
    await expect(page.getByRole("heading", { name: `E2E Client ${unique}` })).toBeVisible();

    await page.goto("/projects/new");
    await page.locator("#np-name").fill(`E2E Project ${unique}`);
    await page.locator("#np-client").selectOption({ label: `E2E Client ${unique}` });
    await page.getByRole("button", { name: /Team A/ }).click();
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByText("Project created")).toBeVisible();
    await page.getByRole("link", { name: "Open project" }).click();
    await expect(page.getByRole("heading", { name: `E2E Project ${unique}` })).toBeVisible();

    // The quick New task panel in the top bar: title, project, one person.
    await page.getByRole("button", { name: "New task" }).click();
    const panel = page.getByRole("dialog");
    await panel.getByLabel("Task title").fill(`E2E Task ${unique}`);
    await panel.getByLabel("Project").selectOption({ label: `E2E Project ${unique}` });
    await panel.getByLabel(/Ravi Employee/).check();
    await panel.getByRole("button", { name: "Create task" }).click();
    await expect(panel.getByText("Task created")).toBeVisible();
    await panel.getByRole("button", { name: "Done" }).click();

    await page.goto("/tasks");
    const row = page.getByRole("row", { name: new RegExp(`E2E Task ${unique}`) });
    await expect(row).toBeVisible();
    await expect(row.getByLabel(/Assigned to for/)).toHaveValue(/.+/);
    await row.getByLabel(/Status for/).selectOption("In Progress");
    await expect(page.getByRole("row", { name: new RegExp(`E2E Task ${unique}`) }).getByLabel(/Status for/)).toHaveValue("In Progress");
  });

  test("an admin creates an employee who appears in the directory", async ({ page }) => {
    await login(page, ADMIN);
    const unique = Date.now().toString().slice(-6);
    await page.goto("/employees/new");
    await page.getByLabel("Full name").fill(`E2E Person ${unique}`);
    await page.getByLabel("Work email").fill(`e2e.person.${unique}@example.test`);
    await page.getByRole("button", { name: "Create employee" }).click();
    await expect(page.getByRole("heading", { name: `E2E Person ${unique}` })).toBeVisible();
    await page.goto(`/employees?q=E2E+Person+${unique}`);
    await expect(page.getByRole("link", { name: `E2E Person ${unique}` })).toBeVisible();
  });
});

test.describe("reports and exports", () => {
  test("opens the task register and downloads a CSV with the same data", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/reports");
    await page.getByRole("link", { name: "Task register" }).click();
    await expect(page.getByRole("table")).toContainText("Design homepage");
    await page.getByText("Export", { exact: true }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: "Export as CSV" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^task-register-.*\.csv$/);
    const body = (await (await download.createReadStream()).toArray()).map((c) => c.toString()).join("");
    expect(body).toContain("Code,Title,Status");
    expect(body).toContain("Design homepage");
  });

  test("an employee has no exports and no company-wide reports", async ({ page }) => {
    await login(page, EMPLOYEE);
    await page.goto("/reports");
    await expect(page.getByRole("link", { name: "Task register" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Employee workload" })).toHaveCount(0);
    await page.goto("/reports/task-register");
    await expect(page.getByRole("link", { name: /Export/ })).toHaveCount(0);
    const res = await page.request.get("/api/exports/task-register?format=csv");
    expect(res.status()).toBe(403);
  });
});

test.describe("operational endpoints", () => {
  test("health is public; cron endpoints demand the secret", async ({ request }) => {
    expect((await request.get("/api/health")).status()).toBe(200);
    expect((await request.get("/api/cron/reminders")).status()).toBe(401);
    const ok = await request.get("/api/cron/reminders", { headers: { authorization: "Bearer e2e-cron-secret-0123456789" } });
    expect(ok.status()).toBe(200);
  });

  test("security headers are present", async ({ request }) => {
    const res = await request.get("/login");
    const h = res.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  });
});
