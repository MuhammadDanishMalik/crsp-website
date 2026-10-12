import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { Db } from "./client";
import * as s from "./schema";
import { PERMISSIONS, ROLE_DEFAULTS, type Permission } from "../domain/permissions";

const R = (rupees: number) => rupees * 100;

const ROLE_NAMES: Record<string, string> = {
  owner: "Owner / Super Admin", branch_manager: "Branch Manager", cashier: "Cashier",
  order_taker: "Order Taker", kitchen: "Kitchen Staff", rider: "Rider", accountant: "Accountant",
};

export const SEED_LOGINS = {
  backOffice: { email: "owner@crsp.test", password: "admin123" },
  terminalCode: "POS1-DEV",
  pins: { owner: "1111", branch_manager: "2222", cashier: "3333", order_taker: "4444", kitchen: "5555", rider: "6666", accountant: "7777" },
};

const URDU: Record<string, string> = {
  "Chicken Injected Broast": "چکن انجیکٹڈ بروسٹ", "Chicken Strips": "چکن اسٹرپس", "Chicken Popcorn": "چکن پاپ کارن", "Fried Wings": "فرائیڈ ونگز",
  "Grill Chicken Wrap": "گرل چکن ریپ", "Beef Wrap": "بیف ریپ", "Zinger Wrap": "زنگر ریپ", "Chicken Grill Burger": "چکن گرل برگر", "Zinger Burger": "زنگر برگر",
  "Double Zinger Burger": "ڈبل زنگر برگر", "Beef Grill Burger": "بیف گرل برگر", "Beef Smash Burger": "بیف سمیش برگر", "Fries": "فرائز", "Crispy Fries": "کرسپی فرائز",
  "Curly Fries": "کرلی فرائز", "Beef Smash Fries": "بیف سمیش فرائز", "Zinger Fries": "زنگر فرائز", "Coleslaw": "کول سلا", "Potato Wedges": "پوٹیٹو ویجز",
  "Honey Mustard Sauce": "ہنی مسٹرڈ ساس", "Cheese Sauce": "چیز ساس", "Garlic Sauce": "گارلک ساس", "Spicy Garlic Sauce": "اسپائسی گارلک ساس", "Ranch Sauce": "رینچ ساس",
};

/** Idempotent: does nothing if a business already exists. */
export async function seedIfEmpty(db: Db) {
  const existing = await db.select({ id: s.business.id }).from(s.business).limit(1);
  if (existing.length) return false;

  const [biz] = await db.insert(s.business).values({
    name: "CRSP", legalName: "CRSP Foods", ntn: "0000000-0", strn: "00-00-0000-000-00",
    settings: { serviceChargeBps: 0, receiptFooter: "Thank you for choosing CRSP!", receiptFooterUr: "CRSP کا انتخاب کرنے کا شکریہ!" },
  }).returning();

  const branches = await db.insert(s.branches).values([
    { businessId: biz.id, code: "WKC", name: "CRSP Watta Khail Chowk", address: "Watta Khail Chowk, Mianwali, Punjab", city: "Mianwali", phone: "0459-000000", taxAuthority: "pra" },
  ]).returning();

  await db.insert(s.terminals).values([
    { branchId: branches[0].id, name: "POS-1", orderNoPrefix: "A", deviceKeyHash: await bcrypt.hash(SEED_LOGINS.terminalCode, 8) },
    { branchId: branches[0].id, name: "POS-2", orderNoPrefix: "B", deviceKeyHash: await bcrypt.hash("POS2-DEV", 8) },
  ]);

  // Roles + permissions
  const roleRows: Record<string, string> = {};
  for (const [key, perms] of Object.entries(ROLE_DEFAULTS)) {
    const [role] = await db.insert(s.roles).values({
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
  const passwordHash = await bcrypt.hash(SEED_LOGINS.backOffice.password, 8);
  const staffIds: Record<string, string> = {};
  for (const [fullName, roleKey, pinKey] of staffSeed) {
    const [st] = await db.insert(s.staff).values({
      businessId: biz.id, roleId: roleRows[roleKey], fullName, phone: "0300-0000000",
      email: roleKey === "owner" ? SEED_LOGINS.backOffice.email : `${roleKey}@crsp.test`,
      passwordHash, pinHash: await bcrypt.hash(SEED_LOGINS.pins[pinKey], 8),
    }).returning();
    staffIds[roleKey] = st.id;
    await db.insert(s.staffBranches).values(branches.map((b) => ({ staffId: st.id, branchId: b.id })));
    if (roleKey !== "owner" && roleKey !== "accountant") await db.insert(s.shiftSchedules).values([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ branchId: branches[0].id, staffId: st.id, weekday, startsAt: "10:00", endsAt: "22:00" })));
  }

  // Tax (placeholder rate — editable; replace with PRA/FBR rates)
  await db.insert(s.taxRules).values({ name: "Sales Tax (placeholder)", rateBps: 1600, priority: 0 });
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

  // Menu — names from the CRSP menu card. PRICES ARE PLACEHOLDERS: set real prices in Admin → Menu.
  const cats = await db.insert(s.categories).values([
    { businessId: biz.id, name: "Chicken", nameUr: "چکن", icon: "Drumstick", sortOrder: 1 },
    { businessId: biz.id, name: "Wraps", nameUr: "ریپس", icon: "Wheat", sortOrder: 2 },
    { businessId: biz.id, name: "Sando", nameUr: "سینڈو", icon: "Sandwich", sortOrder: 3 },
    { businessId: biz.id, name: "Sides", nameUr: "سائیڈز", icon: "Soup", sortOrder: 4 },
    { businessId: biz.id, name: "Sauce", nameUr: "ساس", icon: "Droplet", sortOrder: 5 },
  ]).returning();
  const cat = Object.fromEntries(cats.map((c) => [c.name, c.id]));

  const [spice, sauce] = await db.insert(s.modifierGroups).values([
    { businessId: biz.id, name: "Spice Level", minSelect: 1, maxSelect: 1 },
    { businessId: biz.id, name: "Extra Sauce", minSelect: 0, maxSelect: 3 },
  ]).returning();
  const SAUCES = ["Honey Mustard Sauce", "Cheese Sauce", "Garlic Sauce", "Spicy Garlic Sauce", "Ranch Sauce"];
  await db.insert(s.modifiers).values([
    { groupId: spice.id, name: "Regular", isDefault: true, sortOrder: 1 }, { groupId: spice.id, name: "Spicy", sortOrder: 2 },
    ...SAUCES.map((name, i) => ({ groupId: sauce.id, name, priceDelta: R(50), sortOrder: i + 1 })),
  ]);

  type Item = [string, string, number, string[], string, boolean?]; // category, name, price, groups, emoji, favourite
  const G = { spice: spice.id, sauce: sauce.id };
  const items: Item[] = [
    ["Chicken", "Chicken Injected Broast", 650, [G.spice, G.sauce], "🍗", true], ["Chicken", "Chicken Strips", 550, [G.spice, G.sauce], "🍗"],
    ["Chicken", "Chicken Popcorn", 450, [G.spice, G.sauce], "🍿"], ["Chicken", "Fried Wings", 500, [G.spice, G.sauce], "🔥"],
    ["Wraps", "Grill Chicken Wrap", 450, [G.sauce], "🌯"], ["Wraps", "Beef Wrap", 520, [G.sauce], "🌯"], ["Wraps", "Zinger Wrap", 480, [G.spice, G.sauce], "🌯", true],
    ["Sando", "Chicken Grill Burger", 480, [G.sauce], "🍔"], ["Sando", "Zinger Burger", 520, [G.spice, G.sauce], "🍔", true],
    ["Sando", "Double Zinger Burger", 780, [G.spice, G.sauce], "🍔"], ["Sando", "Beef Grill Burger", 560, [G.sauce], "🍔"], ["Sando", "Beef Smash Burger", 620, [G.sauce], "🍔"],
    ["Sides", "Fries", 220, [G.sauce], "🍟", true], ["Sides", "Crispy Fries", 260, [G.sauce], "🍟"], ["Sides", "Curly Fries", 300, [G.sauce], "🍟"],
    ["Sides", "Beef Smash Fries", 420, [G.sauce], "🍟"], ["Sides", "Zinger Fries", 380, [G.spice, G.sauce], "🍟"],
    ["Sides", "Coleslaw", 120, [], "🥗"], ["Sides", "Potato Wedges", 280, [G.sauce], "🥔"],
    ...SAUCES.map((n): Item => ["Sauce", n, 50, [], "🥫"]),
  ];
  // Kitchen stations + KOT printers (main branch). Printer IPs are placeholders.
  const kotPrinters = await db.insert(s.printers).values([
    { branchId: branches[0].id, name: "KOT Fryer", role: "kot", connection: "lan", address: "192.168.1.51", port: 9100, paperWidthMm: 80 },
    { branchId: branches[0].id, name: "KOT Grill", role: "kot", connection: "lan", address: "192.168.1.52", port: 9100, paperWidthMm: 80 },
  ]).returning();
  const stations = await db.insert(s.kitchenStations).values([
    { branchId: branches[0].id, name: "Fryer", printerId: kotPrinters[0].id },
    { branchId: branches[0].id, name: "Grill & Burgers", printerId: kotPrinters[1].id },
    { branchId: branches[0].id, name: "Sides & Sauce", printerId: kotPrinters[0].id },
  ]).returning();
  const stationFor: Record<string, string> = { Chicken: stations[0].id, Wraps: stations[1].id, Sando: stations[1].id, Sides: stations[2].id, Sauce: stations[2].id };
  await db.insert(s.discounts).values([
    { businessId: biz.id, name: "Welcome 10%", code: "WELCOME10", kind: "percent", value: 1000 },
    { businessId: biz.id, name: "Staff meal 50%", code: "STAFF", kind: "percent", value: 5000, isStaffMeal: true },
  ]);
  let order = 0;
  const itemIds: Record<string, string> = {};
  for (const [c, name, price, groups, emoji, fav] of items) {
    const [it] = await db.insert(s.menuItems).values({
      businessId: biz.id, categoryId: cat[c], name, nameUr: URDU[name] ?? null, basePrice: R(price), imageUrl: `emoji:${emoji}`, sortOrder: order++, isFavourite: !!fav, kitchenStationId: stationFor[c],
    }).returning();
    itemIds[name] = it.id;
    if (groups.length) await db.insert(s.itemModifierGroups).values(groups.map((groupId, i) => ({ itemId: it.id, groupId, sortOrder: i })));
  }

  await seedInventory(db, { bizId: biz.id, branches: branches.map((b) => b.id), itemIds, sauceGroup: sauce.id, staffId: staffIds.owner });

  await db.insert(s.printers).values({
    branchId: branches[0].id, name: "Receipt Printer", role: "receipt", connection: "lan", address: "192.168.1.50", port: 9100, openDrawer: true,
  });
  if (process.env.CRSP_NO_DEMO_HISTORY !== "1") await seedHistory(db);
  return true;
}

export async function resetBusiness(db: Db) {
  await db.delete(s.business).where(eq(s.business.name, "CRSP"));
}


/** Units, ingredients, recipes, opening stock, suppliers and expense categories. Costs are placeholders. */
async function seedInventory(db: Db, c: { bizId: string; branches: string[]; itemIds: Record<string, string>; sauceGroup: string; staffId: string }) {
  const [kg, g, l, ml, pc] = await db.insert(s.units).values([
    { code: "kg", name: "Kilogram" }, { code: "g", name: "Gram" }, { code: "l", name: "Litre" }, { code: "ml", name: "Millilitre" }, { code: "pc", name: "Piece" },
  ]).returning();
  await db.insert(s.unitConversions).values([
    { fromUnitId: kg.id, toUnitId: g.id, factor: "1000" }, { fromUnitId: l.id, toUnitId: ml.id, factor: "1000" },
  ]);
  // [name, base unit, avg cost paisa per base unit, imported?, reorder level]
  type Ing = [string, typeof g, number, boolean, number];
  const defs: Ing[] = [
    ["Chicken (raw)", g, 60, false, 8000], ["Beef (minced)", g, 90, false, 4000], ["Zinger fillet", pc, 9500, false, 40], ["Burger bun", pc, 2500, false, 60],
    ["Tortilla wrap", pc, 2000, false, 60], ["Potato (fries)", g, 12, false, 10000], ["Cooking oil", ml, 45, false, 8000], ["Breading mix", g, 20, false, 5000],
    ["Broast seasoning", g, 150, true, 1000], ["Coleslaw mix", g, 10, false, 3000], ["Cheese slice", pc, 2000, false, 50], ["Packaging box", pc, 1500, false, 100],
    ["Honey mustard sauce", ml, 20, false, 1500], ["Cheese sauce", ml, 25, false, 1500], ["Garlic sauce", ml, 15, false, 2000], ["Spicy garlic sauce", ml, 18, false, 1500], ["Ranch sauce", ml, 20, false, 1500],
  ];
  const ings = await db.insert(s.ingredients).values(defs.map(([name, u, avgCost, imp]) => ({ businessId: c.bizId, name, baseUnitId: u.id, avgCost, isImported: imp, originCountry: imp ? "Saudi Arabia" : null }))).returning();
  const I = Object.fromEntries(ings.map((i) => [i.name, i.id]));
  for (const b of c.branches) {
    await db.insert(s.ingredientStock).values(defs.map(([name, , , , reorder]) => ({
      branchId: b, ingredientId: I[name], quantity: String(name === "Cheese slice" ? 55 : reorder * 6), reorderLevel: String(reorder), // cheese slices start near the alert level
    })));
  }
  const [local, importer] = await db.insert(s.suppliers).values([
    { businessId: c.bizId, name: "Mianwali Poultry Traders", phone: "0300-1112223" },
    { businessId: c.bizId, name: "Al-Riyadh Foods (Saudi importer)", phone: "+966-500000000", isImporter: true, balance: 750_000 },
  ]).returning();
  void local;
  const exp = new Date(Date.now() + 120 * 86_400_000).toISOString().slice(0, 10);
  await db.insert(s.stockBatches).values({
    branchId: c.branches[0], ingredientId: I["Broast seasoning"], batchNo: "SA-114", expiryDate: exp, quantityRemaining: "6000",
    unitCost: 100, landedUnitCost: 150, freightCost: 100_000, dutyCost: 150_000,
  });
  void importer;

  // Recipes: [menu item, [ingredient, qty, unit]...]
  type R = [string, [string, number, typeof g][]];
  const chickenBase = (grams: number, oil: number, season: number): [string, number, typeof g][] => [["Chicken (raw)", grams, g], ["Breading mix", 40, g], ["Cooking oil", oil, ml], ["Broast seasoning", season, g], ["Packaging box", 1, pc]];
  const recipes: R[] = [
    ["Chicken Injected Broast", chickenBase(350, 30, 8)], ["Chicken Strips", chickenBase(200, 25, 4)], ["Chicken Popcorn", chickenBase(180, 25, 0).filter((x) => x[1] > 0)], ["Fried Wings", chickenBase(250, 25, 5)],
    ["Grill Chicken Wrap", [["Chicken (raw)", 150, g], ["Tortilla wrap", 1, pc], ["Coleslaw mix", 40, g], ["Garlic sauce", 20, ml], ["Packaging box", 1, pc]]],
    ["Beef Wrap", [["Beef (minced)", 130, g], ["Tortilla wrap", 1, pc], ["Coleslaw mix", 40, g], ["Garlic sauce", 20, ml], ["Packaging box", 1, pc]]],
    ["Zinger Wrap", [["Zinger fillet", 1, pc], ["Tortilla wrap", 1, pc], ["Coleslaw mix", 30, g], ["Garlic sauce", 15, ml], ["Packaging box", 1, pc]]],
    ["Chicken Grill Burger", [["Chicken (raw)", 150, g], ["Burger bun", 1, pc], ["Garlic sauce", 15, ml], ["Packaging box", 1, pc]]],
    ["Zinger Burger", [["Zinger fillet", 1, pc], ["Burger bun", 1, pc], ["Coleslaw mix", 30, g], ["Garlic sauce", 15, ml], ["Packaging box", 1, pc]]],
    ["Double Zinger Burger", [["Zinger fillet", 2, pc], ["Burger bun", 1, pc], ["Cheese slice", 1, pc], ["Garlic sauce", 20, ml], ["Packaging box", 1, pc]]],
    ["Beef Grill Burger", [["Beef (minced)", 130, g], ["Burger bun", 1, pc], ["Cheese slice", 1, pc], ["Packaging box", 1, pc]]],
    ["Beef Smash Burger", [["Beef (minced)", 160, g], ["Burger bun", 1, pc], ["Cheese slice", 1, pc], ["Packaging box", 1, pc]]],
    ["Fries", [["Potato (fries)", 200, g], ["Cooking oil", 20, ml]]], ["Crispy Fries", [["Potato (fries)", 220, g], ["Breading mix", 20, g], ["Cooking oil", 25, ml]]],
    ["Curly Fries", [["Potato (fries)", 220, g], ["Cooking oil", 25, ml]]], ["Beef Smash Fries", [["Potato (fries)", 200, g], ["Beef (minced)", 60, g], ["Cheese sauce", 30, ml], ["Cooking oil", 20, ml]]],
    ["Zinger Fries", [["Potato (fries)", 200, g], ["Chicken (raw)", 60, g], ["Cooking oil", 25, ml]]], ["Coleslaw", [["Coleslaw mix", 100, g]]], ["Potato Wedges", [["Potato (fries)", 250, g], ["Cooking oil", 25, ml]]],
    ["Honey Mustard Sauce", [["Honey mustard sauce", 30, ml]]], ["Cheese Sauce", [["Cheese sauce", 30, ml]]], ["Garlic Sauce", [["Garlic sauce", 30, ml]]],
    ["Spicy Garlic Sauce", [["Spicy garlic sauce", 30, ml]]], ["Ranch Sauce", [["Ranch sauce", 30, ml]]],
  ];
  for (const [name, lines] of recipes) {
    if (!c.itemIds[name]) continue;
    await db.insert(s.recipes).values(lines.map(([ing, qty, u]) => ({ itemId: c.itemIds[name], ingredientId: I[ing], quantity: String(qty), unitId: u.id })));
  }
  // The "Extra Sauce" modifiers also consume sauce stock
  const sauceMods = await db.select().from(s.modifiers).where(eq(s.modifiers.groupId, c.sauceGroup));
  const sauceIng: Record<string, string> = { "Honey Mustard Sauce": "Honey mustard sauce", "Cheese Sauce": "Cheese sauce", "Garlic Sauce": "Garlic sauce", "Spicy Garlic Sauce": "Spicy garlic sauce", "Ranch Sauce": "Ranch sauce" };
  for (const m of sauceMods) if (sauceIng[m.name]) await db.insert(s.recipes).values({ modifierId: m.id, ingredientId: I[sauceIng[m.name]], quantity: "30", unitId: ml.id });

  await db.insert(s.expenseCategories).values(["Gas", "Electricity", "Rent", "Salaries", "Packaging & supplies", "Transport", "Maintenance", "Miscellaneous"].map((name) => ({ businessId: c.bizId, name })));
  await db.insert(s.reasonCodes).values([
    { businessId: c.bizId, kind: "wastage", label: "Expired" }, { businessId: c.bizId, kind: "wastage", label: "Dropped / spoiled" }, { businessId: c.bizId, kind: "wastage", label: "Overcooked / burnt" },
    { businessId: c.bizId, kind: "wastage", label: "Staff meal" }, { businessId: c.bizId, kind: "wastage", label: "Wrong order remake" },
  ]);
  void c.staffId;
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
