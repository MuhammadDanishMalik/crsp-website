import { expect, test } from "@playwright/test";

async function pin(page: import("@playwright/test").Page, digits: string) {
  for (const d of digits) await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: "OK" }).click();
}

test("register terminal → PIN → open shift → order → cash pay → close shift", async ({ page }) => {
  await page.goto("/pin");
  await expect(page).toHaveURL(/\/terminal/);
  await page.getByPlaceholder("e.g. POS1-DEV").fill("POS1-DEV");
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page).toHaveURL(/\/pin/);

  await pin(page, "0000");
  await expect(page.getByText("Wrong PIN")).toBeVisible();

  await pin(page, "3333"); // cashier
  await expect(page.getByText("Open shift").first()).toBeVisible();
  for (const d of "5000") await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: "Open shift" }).click();

  // Order: Zinger Burger (required Spice Level has a default) + Fries
  await expect(page.getByText("Current order")).toBeVisible();
  await page.getByRole("button", { name: /Zinger Burger/ }).click();
  await page.getByRole("button", { name: /^Add ·/ }).click();
  await page.getByRole("button", { name: /Fries Rs 220/ }).click(); // Fries has optional sauces → sheet
  await page.getByRole("button", { name: /^Add ·/ }).click();
  await expect(page.getByText("Total", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "PAY" }).click();
  await page.getByRole("button", { name: "Exact" }).click();
  await page.getByRole("button", { name: "Complete order" }).click();
  await expect(page.getByText(/Order #\d+ paid/)).toBeVisible();
  await page.getByRole("button", { name: "New order" }).click();

  // Cashier can't see expected drawer total; close shift with a blind count
  await page.getByRole("button", { name: /Shift/ }).click();
  await expect(page.getByText("Expected in drawer")).toHaveCount(0);
  await page.getByRole("button", { name: "Close shift" }).click();
  for (const d of "5000") await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: "Submit count & close" }).click();
  await expect(page.getByText(/Over|Short|Balanced/)).toBeVisible();
});
