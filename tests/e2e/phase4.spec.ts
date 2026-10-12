import { expect, test, type Browser, type Page } from "@playwright/test";

async function terminal(browser: Browser, width = 1366) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("/terminal");
  await page.getByPlaceholder("e.g. POS1-DEV").fill("POS1-DEV");
  await page.getByRole("button", { name: "Register" }).click();
  await page.waitForURL(/\/pin/);
  return page;
}
async function pin(page: Page, digits: string) {
  for (const d of digits) await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: "OK" }).click();
}
async function openShiftIfNeeded(page: Page) {
  await page.getByText(/Open shift|Current order/).first().waitFor();
  if (await page.getByText("Open shift").first().isVisible()) {
    for (const d of "5000") await page.getByRole("button", { name: d, exact: true }).click();
    await page.getByRole("button", { name: "Open shift" }).click();
  }
  await page.getByText("Current order").waitFor();
}
async function owner(browser: Browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@crsp.test");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin/);
  return page;
}
const addBurger = async (p: Page) => { await p.getByRole("button", { name: /Zinger Burger Rs 520/ }).click(); await p.getByRole("button", { name: /^Add ·/ }).click(); };

test("loyalty redeem, cash-on-delivery → rider → settlement, reports + exports, dashboard, branches", async ({ browser }) => {
  test.setTimeout(180_000);
  const admin = await owner(browser);

  // --- Customer exists with points (manual adjustment) ---
  await admin.goto("/admin/customers");
  await admin.getByRole("button", { name: "Add customer" }).click();
  await admin.getByRole("dialog").locator("input").nth(0).fill("03001234567");
  await admin.getByRole("dialog").locator("input").nth(1).fill("Test Customer");
  await admin.getByRole("button", { name: "Save", exact: true }).click();
  await admin.getByRole("button", { name: /Test Customer/ }).click();
  await admin.getByPlaceholder("+50 / -20").fill("300");
  await admin.getByPlaceholder("Reason").fill("welcome bonus");
  await admin.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(admin.getByRole("dialog")).toBeHidden();
  await expect(admin.getByText("300 pts")).toBeVisible(); // list refreshed
  await admin.getByRole("button", { name: /Test Customer/ }).click();
  await expect(admin.getByText("300", { exact: true }).first()).toBeVisible();
  await admin.keyboard.press("Escape");

  // --- Cashier: takeaway with loyalty redemption ---
  const cashier = await terminal(browser);
  await pin(cashier, "3333");
  await openShiftIfNeeded(cashier);
  await cashier.getByRole("button", { name: "Takeaway", exact: true }).click();
  await addBurger(cashier);
  await cashier.getByRole("button", { name: "PAY" }).click(); // takeaway needs no details; set phone first via dialog instead
  await cashier.keyboard.press("Escape");
  await cashier.getByRole("button", { name: /Set table|Add address|Platform/ }).count(); // none for takeaway
  // Open order details through delivery type to enter phone, then switch back
  await cashier.getByRole("button", { name: "Delivery", exact: true }).click();
  await cashier.getByRole("button", { name: "Add address" }).click();
  const dlg = cashier.getByRole("dialog");
  await dlg.getByPlaceholder("03xx-xxxxxxx").fill("03001234567");
  await dlg.getByRole("button", { name: "Find" }).click();
  await expect(dlg.getByText(/Found Test Customer · 300 pts/)).toBeVisible();
  await dlg.locator("input").nth(2).fill("Street 5, Mianwali");
  await dlg.getByRole("button", { name: /City Centre/ }).click();
  await dlg.getByRole("button", { name: "Done" }).click();

  // Delivery order paid by cash on delivery, with 100 points redeemed (Rs 100 off)
  await cashier.getByRole("button", { name: "PAY" }).click();
  await cashier.getByText(/Redeem points \(300 available\)/).click();
  await expect(cashier.getByText(/using 300 = Rs 300 off/)).toBeVisible();
  await cashier.getByRole("button", { name: /Cash on delivery/ }).click();
  const paid = await cashier.getByText(/Order #\d+ paid/).textContent();
  const no = paid!.match(/#(\d+)/)![1];
  await cashier.getByRole("button", { name: "New order" }).click();

  // Customer balance: 300 − 300 redeemed + earned on the new total
  await admin.goto("/admin/customers");
  await admin.getByRole("button", { name: /Test Customer/ }).click();
  await expect(admin.getByText(/Redeemed/)).toBeVisible();
  await admin.keyboard.press("Escape");

  // --- Manager assigns the rider ---
  const mgr = await terminal(browser);
  await pin(mgr, "2222");
  await openShiftIfNeeded(mgr);
  await mgr.getByRole("button", { name: "Deliveries", exact: true }).click();
  await expect(mgr.getByText(`#${no}`)).toBeVisible();
  await mgr.locator("select").first().selectOption({ label: "Imran Shah" });
  await expect(mgr.getByText("🛵 Imran Shah")).toBeVisible();

  // --- Rider (mobile width): picked up → delivered with cash ---
  const rider = await terminal(browser, 390);
  await pin(rider, "6666");
  await rider.waitForURL(/\/rider/);
  await expect(rider.getByText(`#${no}`)).toBeVisible();
  await rider.getByRole("button", { name: "Picked up" }).click();
  await rider.getByRole("button", { name: "Delivered", exact: true }).click();
  await rider.getByRole("button", { name: "Confirm delivered" }).click();
  await expect(rider.getByText(/Cash with me/)).toBeVisible();
  await expect(rider.getByText("Rs 0", { exact: true })).toHaveCount(0);

  // --- Manager settles the rider's cash ---
  await expect(mgr.getByText(/Imran Shah · Rs .* → Receive/)).toBeVisible({ timeout: 20_000 });
  await mgr.getByRole("button", { name: /Imran Shah · .* → Receive/ }).click();
  await mgr.getByRole("button", { name: "Confirm received" }).click();
  await expect(mgr.getByText("Exact")).toBeVisible();

  // --- Reports + exports ---
  await admin.goto("/admin/reports?report=sales-summary");
  await expect(admin.getByRole("heading", { name: "Sales summary" })).toBeVisible();
  await expect(admin.getByText("Total", { exact: true }).first()).toBeVisible();
  for (const [fmt, type] of [["xlsx", "spreadsheetml"], ["pdf", "application/pdf"], ["csv", "text/csv"]] as const) {
    const res = await admin.request.get(`/api/reports/sales-summary?from=2020-01-01&to=2099-12-31&branch=all&format=${fmt}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain(type);
    expect((await res.body()).length).toBeGreaterThan(100);
  }
  await admin.goto("/admin/reports?report=delivery&from=2020-01-01&to=2099-12-31&branch=all");
  await expect(admin.getByText("Imran Shah")).toBeVisible();

  // --- Dashboard ---
  await admin.goto("/admin");
  await expect(admin.getByText("Sales by hour")).toBeVisible();
  await expect(admin.getByText("Top items (units)")).toBeVisible();

  // --- Branches: create one and switch into it ---
  await admin.goto("/admin/branches");
  await admin.getByRole("button", { name: "Add branch" }).click();
  await admin.getByPlaceholder("MW3").fill("MW3");
  await admin.getByRole("dialog").locator("input").nth(1).fill("CRSP Test Branch");
  await admin.getByRole("button", { name: "Save", exact: true }).click();
  await expect(admin.getByText(/Terminal "POS-1" code:/)).toBeVisible();
  await admin.locator("select[aria-label='Branch']").selectOption({ label: "CRSP Test Branch" });
  await admin.waitForTimeout(1500); // switchBranch re-signs the session cookie
  await admin.goto("/admin");
  await expect(admin.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(admin.getByText("No sales yet").first()).toBeVisible();
});
