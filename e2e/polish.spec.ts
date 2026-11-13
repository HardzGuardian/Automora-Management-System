import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { ADMIN, login } from "./helpers";

test.describe.configure({ mode: "serial" });

async function setSecondPerson(page: Page, on: boolean): Promise<void> {
  await page.goto("/settings/preferences");
  const box = page.getByLabel("Require a second person to confirm payments");
  if (on) await box.check();
  else await box.uncheck();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
}

test("profile photo: add, see it, remove", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/profile");
  await expect(page.getByRole("img", { name: /has no photo/ })).toBeVisible();

  const png = await sharp({ create: { width: 900, height: 500, channels: 3, background: "#167C50" } }).png().toBuffer();
  await page.getByLabel("Add photo").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });
  const photo = page.getByRole("img", { name: /Photo of/ });
  await expect(photo).toBeVisible();
  await expect.poll(async () => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(256);
  await expect(page.getByText("Change photo")).toBeVisible();
  await page.screenshot({ path: "test-results/ui-profile-photo.png", fullPage: true });

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("img", { name: /has no photo/ })).toBeVisible();
});

test("profile photo: a text file renamed .png is refused with a plain message", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/profile");
  await page.getByLabel("Add photo").setInputFiles({ name: "notes.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await expect(page.getByRole("alert").filter({ hasText: "not a valid PNG, JPEG or WebP image" })).toBeVisible();
  await expect(page.getByRole("img", { name: /has no photo/ })).toBeVisible();
});

test("unsaved changes: leaving a half-filled form asks first", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/clients/new");

  // Untouched form: leaving is silent.
  let asked = false;
  page.on("dialog", async (d) => {
    asked = true;
    await d.dismiss();
  });
  await page.getByRole("link", { name: "Cancel" }).click();
  await page.waitForURL(/\/clients$/);
  expect(asked).toBe(false);

  await page.goto("/clients/new");
  await page.getByLabel("Client name").fill("Half typed client");
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect.poll(() => asked).toBe(true);
  expect(page.url()).toContain("/clients/new"); // dismissed: still here, text kept
  await expect(page.getByLabel("Client name")).toHaveValue("Half typed client");
});

test("two-person rule: the recorder is told to wait and gets no Confirm button", async ({ page }) => {
  await login(page, ADMIN);
  await setSecondPerson(page, true);
  await page.screenshot({ path: "test-results/ui-preferences.png", fullPage: true });
  try {
    await page.goto("/invoices/new");
    await page.locator("select[name=clientId]").selectOption({ index: 1 });
    await page.getByLabel("Due date").fill("2099-12-31");
    await page.getByLabel("Description").fill("Two-person check");
    await page.getByLabel("Unit price").fill("100");
    await page.getByRole("button", { name: "Create draft invoice" }).click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: "Issue invoice" }).click();
    await expect(page.getByText(/INV-\d{4}-\d{6}/).first()).toBeVisible();

    await page.getByLabel("Amount").fill("40");
    await page.getByLabel("Payment date").fill("2026-11-13");
    await page.getByLabel("Reference").fill("UTR-2P");
    await page.getByRole("button", { name: "Record pending receipt" }).click();
    await page.waitForURL(/\/payments\/[0-9a-f-]{36}$/);

    await expect(page.getByText(/Waiting for another person to confirm/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm receipt" })).toHaveCount(0);
    await page.screenshot({ path: "test-results/ui-waiting-receipt.png", fullPage: true });
  } finally {
    await setSecondPerson(page, false);
  }
});
