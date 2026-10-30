import { runtimeEnv } from "@/lib/env";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { Db } from "./client";
import * as s from "./schema";
import { installMenu } from "./install-menu";
import { PERMISSIONS, ROLE_DEFAULTS, type Permission } from "../domain/permissions";

const R = (rupees: number) => rupees * 100;

const ROLE_NAMES: Record<string, string> = {
  owner: "Owner / Super Admin", branch_manager: "Branch Manager", cashier: "Cashier",
  order_taker: "Order Taker", kitchen: "Kitchen Staff", rider: "Rider", accountant: "Accountant",
};

/**
 * The repository is public, so the real admin password is NOT in the code. Set ADMIN_EMAIL / ADMIN_PASSWORD in the environment
 * (.env.local on your computer, Environment Variables on Vercel). Without them: development uses admin@crsp.com / admin123;
 * production creates a random password and prints it once in the server log.
 */
const generatedPassword = Array.from(crypto.getRandomValues(new Uint8Array(14)), (b) => "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 54]).join("");
if (process.env.NODE_ENV === "production" && !runtimeEnv("ADMIN_PASSWORD") && process.env.CRSP_NO_SEED !== "1") console.warn(`[seed] ADMIN_PASSWORD not set: if the database is empty the owner password will be ${generatedPassword}`);

export const SEED_LOGINS = {
  backOffice: { email: runtimeEnv("ADMIN_EMAIL") ?? "admin@crsp.com", password: runtimeEnv("ADMIN_PASSWORD") ?? (process.env.NODE_ENV === "production" ? generatedPassword : "admin123") }, // owner
  otherStaffPassword: "admin123", // manager@/cashier@/accountant@crsp.test
  terminalCode: "POS1-DEV",
  pins: { owner: "1111", branch_manager: "2222", cashier: "3333", order_taker: "4444", kitchen: "5555", rider: "6666", accountant: "7777" },
};


export const SEED_IDS = {
  business: "a0000000-0000-4000-8000-000000000001",
  branch: "a0000000-0000-4000-8000-000000000002",
  terminal1: "a0000000-0000-4000-8000-000000000003",
  terminal2: "a0000000-0000-4000-8000-000000000004",
  roles: {
    owner: "a0000000-0000-4000-8000-000000000010",
    branch_manager: "a0000000-0000-4000-8000-000000000011",
    cashier: "a0000000-0000-4000-8000-000000000012",
    order_taker: "a0000000-0000-4000-8000-000000000013",
    kitchen: "a0000000-0000-4000-8000-000000000014",
    rider: "a0000000-0000-4000-8000-000000000015",
    accountant: "a0000000-0000-4000-8000-000000000016",
  } as Record<string, string>,
  staff: {
    owner: "a0000000-0000-4000-8000-000000000020",
    branch_manager: "a0000000-0000-4000-8000-000000000021",
    cashier: "a0000000-0000-4000-8000-000000000022",
    order_taker: "a0000000-0000-4000-8000-000000000023",
    kitchen: "a0000000-0000-4000-8000-000000000024",
    rider: "a0000000-0000-4000-8000-000000000025",
    accountant: "a0000000-0000-4000-8000-000000000026",
  } as Record<string, string>,
};

/** Idempotent: does nothing if a business already exists. */
export async function seedIfEmpty(db: Db) {
  const existing = await db.select({ id: s.business.id }).from(s.business).limit(1);
  if (existing.length) return false;

  const [biz] = await db.insert(s.business).values({
    id: SEED_IDS.business,
    name: "CRSP", legalName: "CRSP Foods", ntn: "0000000-0", strn: "00-00-0000-000-00",
    settings: { serviceChargeBps: 0, receiptFooter: "Thank you for choosing CRSP!", receiptFooterUr: "CRSP کا انتخاب کرنے کا شکریہ!" },
  }).returning();

  const branches = await db.insert(s.branches).values([
    { id: SEED_IDS.branch, businessId: biz.id, code: "WKC", name: "CRSP Watta Khail Chowk", address: "Watta Khail Chowk, Mianwali, Punjab", city: "Mianwali", phone: "0459-000000", taxAuthority: "pra" },
  ]).returning();

  await db.insert(s.terminals).values([
    { id: SEED_IDS.terminal1, branchId: branches[0].id, name: "POS-1", orderNoPrefix: "A", deviceKeyHash: await bcrypt.hash(SEED_LOGINS.terminalCode, 8) },
    { id: SEED_IDS.terminal2, branchId: branches[0].id, name: "POS-2", orderNoPrefix: "B", deviceKeyHash: await bcrypt.hash("POS2-DEV", 8) },
  ]);

  // Roles + permissions
  const roleRows: Record<string, string> = {};
  for (const [key, perms] of Object.entries(ROLE_DEFAULTS)) {
    const roleId = SEED_IDS.roles[key];
    const [role] = await db.insert(s.roles).values({
      id: roleId,
      businessId: biz.id, key, name: ROLE_NAMES[key], isSystem: true,
      discountLimitBps: key === "owner" ? 10_000 : key === "branch_manager" ? 5000 : 1000,
    }).returning();
    roleRows[key] = role.id;
    const list = perms === "ALL" ? (Object.keys(PERMISSIONS) as Permission[]) : perms;
    await db.insert(s.rolePermissions).values(list.map((permission) => ({ roleId: role.id, permission })));
  }

  // Staff, one per role
  const staffSeed: [string, string, keyof typeof SEED_LOGINS.pins][] = [
    ["Danish Awan", "owner", "owner"], ["Ali Raza", "branch_manager", "branch_manager"],
    ["Bilal Khan", "cashier", "cashier"], ["Hamza Malik", "order_taker", "order_taker"],
    ["Usman Ahmed", "kitchen", "kitchen"], ["Imran Shah", "rider", "rider"], ["Sana Iqbal", "accountant", "accountant"],
  ];
  const ownerHash = await bcrypt.hash(SEED_LOGINS.backOffice.password, 8), otherHash = await bcrypt.hash(SEED_LOGINS.otherStaffPassword, 8);
  const staffIds: Record<string, string> = {};
  for (const [fullName, roleKey, pinKey] of staffSeed) {
    const staffId = SEED_IDS.staff[roleKey];
    const [st] = await db.insert(s.staff).values({
      id: staffId,
      businessId: biz.id, roleId: roleRows[roleKey], fullName, phone: "0300-0000000",
      email: roleKey === "owner" ? SEED_LOGINS.backOffice.email : `${roleKey}@crsp.test`,
      passwordHash: roleKey === "owner" ? ownerHash : otherHash, pinHash: await bcrypt.hash(SEED_LOGINS.pins[pinKey], 8),
    }).returning();
    staffIds[roleKey] = st.id;
    await db.insert(s.staffBranches).values(branches.map((b) => ({ staffId: st.id, branchId: b.id })));
    if (roleKey !== "owner" && roleKey !== "accountant") await db.insert(s.shiftSchedules).values([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ branchId: branches[0].id, staffId: st.id, weekday, startsAt: "10:00", endsAt: "22:00" })));
  }

  // No tax rule is seeded: bills carry no tax.
  for (const b of branches) {
    await db.insert(s.paymentMethodSettings).values(
      (["cash", "card", "jazzcash", "easypaisa", "raast", "bank_transfer"] as const).map((method) => ({ branchId: b.id, method, isEnabled: true })),
    );
    await db.insert(s.deliveryZones).values({ branchId: b.id, name: "City Centre", charge: R(100) });
  }
  await db.insert(s.loyaltyRules).values({ businessId: biz.id, earnPerRupee: "0.01", pointValuePaisa: 100, minRedeemPoints: 100 }); // 1 point per Rs 100; 1 point = Rs 1; redeem from 100 points
  await db.insert(s.reasonCodes).values([
    { businessId: biz.id, kind: "void", label: "Customer changed mind" }, { businessId: biz.id, kind: "void", label: "Wrong item entered" },
    { businessId: biz.id, kind: "void", label: "Kitchen error" }, { businessId: biz.id, kind: "refund", label: "Quality complaint" },
  ]);

  // Menu (menu-data.ts): categories, items, options, recipes, ingredients, kitchen stations, sadqa pledge.
  await installMenu(db, biz.id, branches.map((b) => b.id));
  await db.insert(s.discounts).values([
    { businessId: biz.id, name: "Welcome 10%", code: "WELCOME10", kind: "percent", value: 1000 },
    { businessId: biz.id, name: "Staff meal 50%", code: "STAFF", kind: "percent", value: 5000, isStaffMeal: true },
  ]);
  await seedInventory(db, { bizId: biz.id });

  await db.insert(s.printers).values({
    branchId: branches[0].id, name: "Receipt Printer", role: "receipt", connection: "lan", address: "192.168.1.50", port: 9100, openDrawer: true,
  });
  if (process.env.CRSP_DEMO_HISTORY === "1") await seedHistory(db); // off by default: a fresh install starts with zero orders
  return true;
}

export async function resetBusiness(db: Db) {
  await db.delete(s.business).where(eq(s.business.name, "CRSP"));
}


/** Suppliers, expense categories and wastage reasons. (Ingredients and recipes come with the menu: see install-menu.ts.) */
async function seedInventory(db: Db, c: { bizId: string }) {
  await db.insert(s.suppliers).values([
    { businessId: c.bizId, name: "Mianwali Poultry Traders", phone: "0300-1112223" },
    { businessId: c.bizId, name: "Al-Riyadh Foods (Saudi importer)", phone: "+966-500000000", isImporter: true },
  ]);
  await db.insert(s.expenseCategories).values(["Gas", "Electricity", "Rent", "Salaries", "Packaging & supplies", "Transport", "Maintenance", "Miscellaneous"].map((name) => ({ businessId: c.bizId, name })));
  await db.insert(s.reasonCodes).values([
    { businessId: c.bizId, kind: "wastage", label: "Expired" }, { businessId: c.bizId, kind: "wastage", label: "Dropped / spoiled" }, { businessId: c.bizId, kind: "wastage", label: "Overcooked / burnt" },
    { businessId: c.bizId, kind: "wastage", label: "Staff meal" }, { businessId: c.bizId, kind: "wastage", label: "Wrong order remake" },
  ]);
}

/** 30 days of believable demo orders (completed, paid) + closed shifts + expenses so dashboards and reports are not empty. */
async function seedHistory(db: Db) {
  let seed = 20260901;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const [items, terms, staffRows, roles, [tax], branches, cats, expCats] = await Promise.all([
    db.select().from(s.menuItems), db.select().from(s.terminals), db.select().from(s.staff), db.select().from(s.roles), db.select().from(s.taxRules).limit(1),
    db.select().from(s.branches), db.select().from(s.categories), db.select().from(s.expenseCategories),
  ]);
  const roleId = (k: string) => roles.find((r) => r.key === k)!.id;
  const cashiers = staffRows.filter((x) => x.roleId === roleId("cashier") || x.roleId === roleId("branch_manager"));
  const sellable = items.filter((i) => cats.find((c) => c.id === i.categoryId)?.name !== "Sauce");
  const ratio: Record<string, number> = { Chicken: 0.34, Wraps: 0.3, Sando: 0.32, Sides: 0.26 }; // typical food-cost shares
  const types = ["dine_in", "takeaway", "takeaway", "delivery", "drive_thru"] as const;
  const methods = ["cash", "cash", "cash", "card", "jazzcash", "easypaisa"] as const;
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(d);
  const chunk = async <T,>(rows: T[], n: number, fn: (c: T[]) => Promise<unknown>) => { for (let i = 0; i < rows.length; i += n) await fn(rows.slice(i, i + n)); };

  for (const [bi, branch] of branches.entries()) {
    const term = terms.find((x) => x.branchId === branch.id)!;
    const orders: (typeof s.orders.$inferInsert)[] = [], oitems: (typeof s.orderItems.$inferInsert)[] = [], pays: (typeof s.payments.$inferInsert)[] = [], taxl: (typeof s.orderTaxLines.$inferInsert)[] = [];
    const shiftRows: (typeof s.shifts.$inferInsert)[] = [], exps: (typeof s.expenses.$inferInsert)[] = [];
    const nowHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", hour12: false }).format(new Date())) % 24;
    for (let back = 30; back >= 0; back--) {
      const day = new Date(Date.now() - back * 86_400_000), date = fmt(day), dow = day.getUTCDay();
      const today = back === 0;
      const hours = [11, 12, 12, 13, 13, 14, 15, 17, 18, 19, 19, 20, 20, 21, 21, 22].filter((h) => !today || h <= nowHour);
      const target = hours.length ? Math.round((bi === 0 ? 46 : 24) * (dow === 5 || dow === 6 ? 1.35 : dow === 1 ? 0.8 : 1) * (0.85 + rnd() * 0.3) * (today ? 0.5 : 1)) : 0;
      if (!target) continue;
      const cashier = today ? staffRows.find((x) => x.roleId === roleId("branch_manager"))! : pick(cashiers); // today's demo shift belongs to the manager, so cashier logins still start a fresh shift
      const shiftId = crypto.randomUUID();
      let cashTotal = 0;
      for (let n = 1; n <= target; n++) {
        const hour = pick(hours);
        const at = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}:00+05:00`);
        const id = crypto.randomUUID(), type = pick([...types]), method = pick([...methods]);
        const lines = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => { const it = pick(sellable); const cname = cats.find((c) => c.id === it.categoryId)!.name; return { it, qty: 1 + (rnd() < 0.25 ? 1 : 0), cost: Math.round(it.basePrice * ((ratio[cname] ?? 0.3) + (rnd() - 0.5) * 0.06)) }; });
        const subtotal = lines.reduce((a, l) => a + l.it.basePrice * l.qty, 0), discount = rnd() < 0.07 ? Math.round(subtotal * 0.1) : 0;
        const taxable = subtotal - discount, taxAmt = Math.round(taxable * 0.16), total = taxable + taxAmt;
        if (method === "cash") cashTotal += total;
        orders.push({ id, branchId: branch.id, terminalId: term.id, shiftId, businessDate: date, orderNo: String(n).padStart(3, "0"), type, status: "completed", subtotal, discountTotal: discount, taxTotal: taxAmt, total, amountPaid: total, createdBy: cashier.id, createdAt: at, updatedAt: at, completedAt: at, readyAt: new Date(at.getTime() + (4 + Math.floor(rnd() * 9)) * 60_000) });
        for (const l of lines) oitems.push({ orderId: id, itemId: l.it.id, nameSnapshot: l.it.name, unitPrice: l.it.basePrice, quantity: l.qty, lineTotal: l.it.basePrice * l.qty, costSnapshot: l.cost, kdsStatus: "bumped", sentAt: at });
        pays.push({ orderId: id, branchId: branch.id, shiftId, method, status: "confirmed", amount: total, tendered: method === "cash" ? Math.ceil(total / 10000) * 10000 : null, changeGiven: method === "cash" ? Math.ceil(total / 10000) * 10000 - total : null, provider: "manual", approvalCode: method === "cash" ? null : String(100000 + Math.floor(rnd() * 899999)), createdBy: cashier.id, createdAt: at, confirmedAt: at });
        if (tax) taxl.push({ orderId: id, taxRuleId: tax.id, name: tax.name, rateBps: 1600, amount: taxAmt });
      }
      const open = new Date(`${date}T10:00:00+05:00`), close = new Date(`${date}T23:15:00+05:00`), diff = Math.round((rnd() - 0.6) * 4) * 500 * (rnd() < 0.3 ? 1 : 0);
      shiftRows.push(today
        ? { id: shiftId, branchId: branch.id, terminalId: term.id, staffId: cashier.id, status: "open", openedAt: open, openingFloat: 500000 }
        : { id: shiftId, branchId: branch.id, terminalId: term.id, staffId: cashier.id, status: "closed", openedAt: open, closedAt: close, openingFloat: 500000, expectedCash: 500000 + cashTotal, countedCash: 500000 + cashTotal + diff, overShort: diff });
      if (rnd() < 0.5) exps.push({ branchId: branch.id, categoryId: pick(expCats).id, expenseDate: date, amount: (1 + Math.floor(rnd() * 20)) * 50000, paymentSource: "cash", description: "Daily running cost", createdBy: cashier.id });
    }
    await chunk(shiftRows, 100, (c) => db.insert(s.shifts).values(c));
    await chunk(orders, 400, (c) => db.insert(s.orders).values(c));
    await chunk(oitems, 800, (c) => db.insert(s.orderItems).values(c));
    await chunk(pays, 800, (c) => db.insert(s.payments).values(c));
    await chunk(taxl, 800, (c) => db.insert(s.orderTaxLines).values(c));
    if (exps.length) await chunk(exps, 100, (c) => db.insert(s.expenses).values(c));
    // continue today's numbering after the demo orders
    const todayStr = fmt(new Date());
    await db.insert(s.orderCounters).values({ branchId: branch.id, businessDate: todayStr, lastNumber: orders.filter((o) => o.businessDate === todayStr).length }).onConflictDoNothing();
  }
}
