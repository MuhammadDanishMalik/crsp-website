import { expect, test, type Browser, type Page } from "@playwright/test";

async function login(browser: Browser, pinCode: string, opts: { openShift?: boolean } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto("/terminal");
  await page.getByPlaceholder("e.g. POS1-DEV").fill("POS1-DEV");
  await page.getByRole("button", { name: "Register" }).click();
  await page.waitForURL(/\/pin/);
  for (const d of pinCode) await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: "OK" }).click();
  if (opts.openShift) {
    await page.getByText("Open shift").first().waitFor();
    for (const d of "5000") await page.getByRole("button", { name: d, exact: true }).click();
    await page.getByRole("button", { name: "Open shift" }).click();
    await page.getByText("Current order").waitFor();
  }
  return page;
}

async function addZingerBurger(page: Page) {
  await page.getByRole("button", { name: /Zinger Burger Rs 520/ }).click();
  await page.getByRole("button", { name: /^Add ·/ }).click();
}

test("hold/recall, promo, KDS bump → status TV, void with manager override", async ({ browser }) => {
  const cashier = await login(browser, "3333", { openShift: true });

  // Hold, then recall
  await addZingerBurger(cashier);
  await cashier.getByRole("button", { name: "Hold", exact: true }).click();
  await expect(cashier.getByText(/Held as H/)).toBeVisible();
  await expect(cashier.getByText("Tap an item to start the order")).toBeVisible();
  await cashier.getByRole("button", { name: /^Held/ }).click();
  await cashier.getByText(/1 items — 1× Zinger Burger/).click();
  await cashier.getByRole("button", { name: "Recall order" }).click();
  await expect(cashier.getByText("Zinger Burger").first()).toBeVisible();

  // Promo code WELCOME10 → 10% off 520 = 52
  await cashier.getByRole("button", { name: "Discount" }).click();
  await cashier.getByPlaceholder("Promo / staff-meal code").fill("welcome10");
  await cashier.getByRole("button", { name: "Use code" }).click();
  await expect(cashier.getByText("Discount", { exact: true })).toBeVisible();
  await expect(cashier.getByText("-Rs 52", { exact: true }).first()).toBeVisible();

  // Pay: split bill ÷2, cash for both payers
  await cashier.getByRole("button", { name: "PAY" }).click();
  await cashier.getByRole("button", { name: "÷2" }).click();
  await cashier.getByRole("button", { name: "Exact" }).click();
  await cashier.getByRole("button", { name: /Take payer 1/ }).click();
  await cashier.getByRole("button", { name: "Exact" }).click();
  await cashier.getByRole("button", { name: "Complete order" }).click();
  const title = await cashier.getByText(/Order #\d+ paid/).textContent();
  const no = title!.match(/#(\d+)/)![1];
  await cashier.getByRole("button", { name: "New order" }).click();

  // Kitchen sees it and bumps it
  const kitchen = await login(browser, "5555");
  await expect(kitchen).toHaveURL(/\/kds/);
  await expect(kitchen.getByText(`#${no}`)).toBeVisible();
  const tv = await browser.newContext().then(async (c) => {
    const p = await c.newPage();
    await p.goto("/terminal"); await p.getByPlaceholder("e.g. POS1-DEV").fill("POS1-DEV"); await p.getByRole("button", { name: "Register" }).click();
    await p.waitForURL(/\/pin/);
    await p.goto("/status");
    return p;
  });
  await expect(tv.getByText(no, { exact: true })).toBeVisible();
  while (await kitchen.getByRole("button", { name: "BUMP ORDER" }).count()) {
    await kitchen.getByRole("button", { name: "BUMP ORDER" }).first().click();
    await kitchen.waitForTimeout(400);
  }
  await expect(kitchen.getByText("All caught up")).toBeVisible();
  await expect(tv.locator("section").nth(1).getByText(no, { exact: true })).toBeVisible({ timeout: 15_000 });

  // Cashier voids → manager PIN needed
  await cashier.goto("/orders");
  await cashier.getByRole("button", { name: "Void", exact: true }).first().click();
  await cashier.getByRole("button", { name: "Void order" }).click();
  await expect(cashier.getByText("Manager approval", { exact: true })).toBeVisible();
  for (const d of "3333") await cashier.getByRole("button", { name: d, exact: true }).last().click();
  await cashier.getByRole("button", { name: "Approve" }).click();
  await expect(cashier.getByText("Manager PIN not accepted")).toBeVisible();
  for (const d of "2222") await cashier.getByRole("button", { name: d, exact: true }).last().click();
  await cashier.getByRole("button", { name: "Approve" }).click();
  await expect(cashier.getByText("voided", { exact: true }).first()).toBeVisible();
});
