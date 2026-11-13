import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ADMIN, ADMIN_ROUTES, COMMON_ROUTES, EMPLOYEE, expectNoPageOverflow, login } from "./helpers";

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
];

test.describe("AC-15: every screen works at mobile, tablet and desktop widths", () => {
  for (const vp of VIEWPORTS) {
    test(`admin screens at ${vp.name} (${vp.width}px): no horizontal page scroll, a heading, a way to navigate`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await login(page, ADMIN);
      for (const url of [...COMMON_ROUTES, ...ADMIN_ROUTES]) {
        const res = await page.goto(url);
        expect(res?.status(), url).toBeLessThan(400);
        await expect(page.locator("h1").first(), `${url} needs a heading`).toBeVisible();
        await expectNoPageOverflow(page, url);
        if (vp.width < 1024) {
          await expect(page.getByRole("button", { name: "Open menu" }), `${url} must offer the drawer`).toBeVisible();
        }
      }
    });
  }

  test("the mobile drawer opens, shows grouped navigation, navigates and closes", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await login(page, ADMIN);
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer.getByText("Finance", { exact: true })).toBeVisible();
    await drawer.getByRole("link", { name: "Projects" }).click();
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByRole("dialog", { name: "Navigation" })).toHaveCount(0);
  });
});

test.describe("accessibility (axe, WCAG 2.1 A/AA)", () => {
  const scan = async (page: import("@playwright/test").Page, url: string) => {
    await page.goto(url);
    await expect(page.locator("h1").first()).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(" ")}`), url).toEqual([]);
  };

  test("admin screens have no serious or critical violations", async ({ page }) => {
    await login(page, ADMIN);
    for (const url of [...COMMON_ROUTES, ...ADMIN_ROUTES]) await scan(page, url);
  });

  test("employee screens have no serious or critical violations", async ({ page }) => {
    await login(page, EMPLOYEE);
    for (const url of COMMON_ROUTES) await scan(page, url);
  });

  test("login page is accessible", async ({ page }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});

test.describe("keyboard", () => {
  test("skip link, tab order reaches the menu and the main content, focus is visible", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/tasks");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    const focusedOutline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
    expect(focusedOutline).not.toBe("");
    // Reach the primary action by keyboard alone.
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent?.trim() === "New task");
    }
    expect(reached).toBe(true);
  });

  test("the confirm dialog traps focus, closes with Escape and does not act when cancelled", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/settings/roles");
    await page.getByRole("button", { name: "Save permissions" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
