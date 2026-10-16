import { expect, test, type Browser, type Page } from "@playwright/test";

async function terminal(browser: Browser) {
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
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
async function owner(browser: Browser) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@crsp.com");
  await page.getByLabel("Password").fill("test-admin-pass");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin/);
  return page;
}
const stockOf = async (admin: Page, name: string) => {
  await admin.goto("/admin/inventory");
  const cell = admin.locator("tr", { hasText: name }).locator("td").nth(1);
  return Number((await cell.innerText()).replace(/[^\d.-]/g, ""));
};

test("recipe stock deduction + void restore, staff PIN uniqueness, clock-in, expense, P&L", async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await owner(browser);
  const before = await stockOf(admin, "Zinger fillet");

  // Cashier sells a Zinger Burger (recipe uses 1 Zinger fillet)
  const cashier = await terminal(browser);
  await pin(cashier, "3333");
  await cashier.getByText(/Open shift|Current order/).first().waitFor();
  const needsShift = await cashier.getByText("Open shift").first().isVisible();
  if (needsShift) {
    for (const d of "5000") await cashier.getByRole("button", { name: d, exact: true }).click();
    await cashier.getByRole("button", { name: "Open shift" }).click();
  }
  await cashier.getByText("Current order").waitFor();
  await cashier.getByRole("button", { name: /Zinger Burger Rs 520/ }).click();
  await cashier.getByRole("button", { name: /^Add ·/ }).click();
  await cashier.getByRole("button", { name: "PAY" }).click();
  await cashier.getByRole("button", { name: "Exact" }).click();
  await cashier.getByRole("button", { name: "Complete order" }).click();
  const no = (await cashier.getByText(/Order #\d+ paid/).textContent())!.match(/#(\d+)/)![1];
  expect(await stockOf(admin, "Zinger fillet")).toBe(before - 1);

  // Void it with manager approval → stock restored
  await cashier.getByRole("button", { name: "New order" }).click();
  await cashier.goto("/orders");
  await cashier.getByRole("button", { name: "Void", exact: true }).first().click();
  await cashier.getByRole("button", { name: "Void order" }).click();
  for (const d of "2222") await cashier.getByRole("button", { name: d, exact: true }).last().click();
  await cashier.getByRole("button", { name: "Approve" }).click();
  await expect(cashier.locator("div.rounded-2xl", { hasText: `#${no}` }).getByText("voided", { exact: true })).toBeVisible();
  expect(await stockOf(admin, "Zinger fillet")).toBe(before);

  // Staff: duplicate PIN rejected, unique PIN accepted
  await admin.goto("/admin/staff");
  await admin.getByRole("button", { name: "Add staff" }).click();
  await admin.getByRole("dialog").getByLabel("Full name").fill("Test Cashier");
  await admin.getByRole("dialog").getByLabel(/POS PIN/).fill("3333");
  await admin.getByRole("button", { name: "Save", exact: true }).click();
  await expect(admin.getByText("already used")).toBeVisible();
  await admin.getByRole("dialog").getByLabel(/POS PIN/).fill("8888");
  await admin.getByRole("button", { name: "Save", exact: true }).click();
  await expect(admin.getByText("Test Cashier")).toBeVisible();

  // Clock in with PIN on a terminal
  const clock = await terminal(browser);
  await clock.getByRole("button", { name: "Clock in / out" }).click();
  await pin(clock, "8888");
  await expect(clock.getByText(/Test Cashier clocked IN/)).toBeVisible();
  await pin(clock, "8888");
  await expect(clock.getByText(/Test Cashier clocked OUT/)).toBeVisible();

  // Expense and P&L
  await admin.goto("/admin/expenses");
  await admin.getByRole("button", { name: "Add expense" }).click();
  await admin.getByRole("dialog").getByLabel("Amount (Rs)").fill("1500");
  await admin.getByRole("dialog").getByPlaceholder("Description").fill("Gas cylinder");
  await admin.getByRole("button", { name: "Save", exact: true }).click();
  await expect(admin.getByText("Gas cylinder")).toBeVisible();
  await admin.goto("/admin/accounts");
  await expect(admin.getByText("Net profit")).toBeVisible();
  await expect(admin.getByText("Electricity", { exact: true })).toBeVisible();

  // Imported ingredient needs batch + expiry
  await admin.goto("/admin/purchasing");
  await admin.getByRole("button", { name: "New purchase" }).click();
  const dlg = admin.getByRole("dialog");
  await dlg.locator("select").nth(1).selectOption({ label: "Broast seasoning (imported)" });
  await dlg.getByPlaceholder("Qty").fill("1000");
  await dlg.getByPlaceholder("Total Rs").fill("1000");
  await dlg.getByRole("button", { name: "Save & add to stock" }).click();
  await expect(dlg.getByText(/imported: enter batch number and expiry/)).toBeVisible();
});
