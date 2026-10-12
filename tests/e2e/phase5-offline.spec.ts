import { expect, test, type Page } from "@playwright/test";

async function pin(page: Page, digits: string) {
  for (const d of digits) await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: "OK" }).click();
}

test("offline: sell with no internet, receipt data kept, uploads once online, no duplicates", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("/terminal");
  await page.getByPlaceholder("e.g. POS1-DEV").fill("POS1-DEV");
  await page.getByRole("button", { name: "Register" }).click();
  await page.waitForURL(/\/pin/);
  await pin(page, "3333");
  await page.getByText(/Open shift|Current order/).first().waitFor();
  if (await page.getByText("Open shift").first().isVisible()) {
    for (const d of "5000") await page.getByRole("button", { name: d, exact: true }).click();
    await page.getByRole("button", { name: "Open shift" }).click();
  }
  await page.getByText("Current order").waitFor();

  // Lose the internet, then ring up a cash sale
  await ctx.setOffline(true);
  await page.getByRole("button", { name: /Zinger Burger Rs 520/ }).click();
  await page.getByRole("button", { name: /^Add ·/ }).click();
  await page.getByRole("button", { name: "PAY" }).click();
  await page.getByRole("button", { name: "Exact" }).click();
  await page.getByRole("button", { name: "Complete order" }).click();
  await expect(page.getByText(/Order #A\d{3} saved offline/)).toBeVisible();
  await expect(page.getByText(/will upload by itself/)).toBeVisible();
  const no = (await page.getByText(/Order #A\d{3} saved offline/).textContent())!.match(/#(A\d{3})/)![1];
  await page.getByRole("button", { name: "New order" }).click();
  await expect(page.getByRole("button", { name: /1 waiting/ })).toBeVisible();

  // A second offline sale gets the next number
  await page.getByRole("button", { name: /Zinger Burger Rs 520/ }).click();
  await page.getByRole("button", { name: /^Add ·/ }).click();
  await page.getByRole("button", { name: "PAY" }).click();
  await page.getByRole("button", { name: "Exact" }).click();
  await page.getByRole("button", { name: "Complete order" }).click();
  const no2 = (await page.getByText(/Order #A\d{3} saved offline/).textContent())!.match(/#(A\d{3})/)![1];
  expect(no2).not.toBe(no);
  await page.getByRole("button", { name: "New order" }).click();
  await expect(page.getByRole("button", { name: /2 waiting/ })).toBeVisible();

  // Internet returns → both upload, exactly once
  await ctx.setOffline(false);
  await expect(page.getByText("2 offline orders uploaded")).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("button", { name: /waiting/ })).toHaveCount(0);

  await page.goto("/orders");
  await expect(page.getByText(`#${no}`, { exact: true })).toHaveCount(1);
  await expect(page.getByText(`#${no2}`, { exact: true })).toHaveCount(1);
});

test("tax invoice + QR on receipt, Urdu switch, idle lock, backup", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  await page.clock.install(); // lets us "wait 6 minutes" instantly for the lock screen
  await page.goto("/terminal");
  await page.getByPlaceholder("e.g. POS1-DEV").fill("POS1-DEV");
  await page.getByRole("button", { name: "Register" }).click();
  await page.waitForURL(/\/pin/);

  // Urdu on the PIN screen, and back
  await page.getByRole("button", { name: "اردو" }).click();
  await expect(page.getByText("اپنا پن درج کریں")).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByText("Enter your PIN")).toBeVisible();

  await pin(page, "3333");
  await page.getByText(/Open shift|Current order/).first().waitFor();
  if (await page.getByText("Open shift").first().isVisible()) {
    for (const d of "5000") await page.getByRole("button", { name: d, exact: true }).click();
    await page.getByRole("button", { name: "Open shift" }).click();
  }
  await page.getByText("Current order").waitFor();

  // Sale → authority invoice (mock in dev) with QR on the receipt page
  await page.getByRole("button", { name: /Zinger Burger Rs 520/ }).click();
  await page.getByRole("button", { name: /^Add ·/ }).click();
  await page.getByRole("button", { name: "PAY" }).click();
  await page.getByRole("button", { name: "Exact" }).click();
  await page.getByRole("button", { name: "Complete order" }).click();
  await expect(page.getByText(/Order #\d+ paid/)).toBeVisible();
  const href = await page.getByRole("link", { name: "Browser print" }).getAttribute("href");
  const receipt = await page.request.get(href!.replace("?print=1", ""));
  const html = await receipt.text();
  expect(html).toContain("MOCK-WKC-"); // React splits "Tax invoice: " and the number into separate text nodes
  expect(html).toContain("<svg"); // QR code
  await page.getByRole("button", { name: "New order" }).click();

  // Idle lock after 5 min, wrong PIN refused, right PIN unlocks, cart untouched
  await page.getByRole("button", { name: /Fries Rs 220/ }).click();
  await page.getByRole("button", { name: /^Add ·/ }).click();
  await page.clock.fastForward("06:00");
  await expect(page.getByText("Screen locked")).toBeVisible();
  const unlock = async (d: string) => { for (const c of d) await page.getByRole("button", { name: c, exact: true }).click(); await page.getByRole("button", { name: "Unlock" }).click(); };
  await unlock("9999");
  await expect(page.getByText("Wrong PIN")).toBeVisible();
  await unlock("3333");
  await expect(page.getByText("Screen locked")).toBeHidden();
  await expect(page.getByText("Fries").first()).toBeVisible();

  // Backup job
  const b = await page.request.get("/api/cron/backup");
  expect(b.status()).toBe(200);
  const j = await b.json();
  expect(j.ok).toBe(true);
  expect(j.bytes).toBeGreaterThan(1000);
});
