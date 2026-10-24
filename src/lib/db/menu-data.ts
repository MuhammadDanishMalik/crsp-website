/**
 * The CRSP menu card (Spicy Injected Broast, Wraps, Wings, Nuggets, Beverages, Burgers, Fries, Extras + Deals 1–10).
 * One place for the menu: used by the first-run seed AND by `npm run update:menu` (which swaps the menu on an existing database).
 * Recipes and nutrition below are ESTIMATES so stock, food cost and calories work from day one; replace them with your real figures.
 */
export type GroupKey = "spice" | "sauce" | "addons" | "drink" | "kid" | "kidDrink" | "drinkFlavor";
export type MenuItemDef = { cat: string; name: string; price: number; groups: GroupKey[]; emoji: string; fav: boolean; combo: boolean; desc: string | null };
type Unit = "g" | "ml" | "pc";
export type RecipeLine = [ingredient: string, qty: number, unit: Unit];

export const CATEGORIES = [
  { name: "Broast", nameUr: "اسپائسی انجیکٹڈ بروسٹ", icon: "Drumstick" }, { name: "Burgers", nameUr: "برگرز", icon: "Sandwich" }, { name: "Wraps", nameUr: "ریپس", icon: "Wheat" },
  { name: "Wings", nameUr: "ونگز", icon: "Drumstick" }, { name: "Nuggets & Strips", nameUr: "نگٹس اور دیگر", icon: "UtensilsCrossed" }, { name: "Fries", nameUr: "فرائز", icon: "Soup" },
  { name: "Beverages", nameUr: "مشروبات اور ڈرنکس", icon: "CupSoda" }, { name: "Extras", nameUr: "ایکسٹراز اور ساس", icon: "Droplet" }, { name: "Deals", nameUr: "ڈیلز", icon: "BadgePercent" },
];

export const STATION_OF: Record<string, string> = { Broast: "Fryer", Wings: "Fryer", "Nuggets & Strips": "Fryer", Fries: "Fryer", Deals: "Fryer", Burgers: "Grill & Burgers", Wraps: "Grill & Burgers", Beverages: "Sides & Sauce", Extras: "Sides & Sauce" };

/** Modifier groups. Sauce and add-on prices are the menu card's. */
export const GROUPS: Record<GroupKey, { name: string; nameUr: string; min: number; max: number; options: { name: string; nameUr: string; price?: number; isDefault?: boolean }[] }> = {
  spice: { name: "Spice Level", nameUr: "مرچ کی شدت", min: 1, max: 1, options: [{ name: "Regular", nameUr: "درمیانہ", isDefault: true }, { name: "Spicy", nameUr: "تیز مرچ" }] },
  sauce: { name: "Extra Sauce", nameUr: "اضافی ساس", min: 0, max: 5, options: [{ name: "Chipotle Sauce", nameUr: "چپوٹلے ساس", price: 100 }, { name: "Garlic Sauce", nameUr: "گارلک ساس", price: 100 }, { name: "Honey Mustard", nameUr: "ہنی مسٹرڈ ساس", price: 100 }] },
  addons: { name: "Burger Add-ons", nameUr: "برگر ایڈ آنز", min: 0, max: 3, options: [{ name: "Extra beef patty", nameUr: "اضافی بیف پیٹی", price: 295 }, { name: "Make it meal (Fries + drink)", nameUr: "میک اٹ میل (فرائز + ڈرنک)", price: 300 }, { name: "Extra Cheese Slice", nameUr: "اضافی چیز سلائس", price: 80 }] },
  drink: { name: "Drink (deal)", nameUr: "ڈرنک (ڈیل)", min: 0, max: 4, options: [{ name: "Coca-Cola", nameUr: "کوکا کولا" }, { name: "Sprite", nameUr: "اسپرائٹ" }, { name: "Fanta", nameUr: "فینٹا" }] },
  drinkFlavor: { name: "Drink Flavor", nameUr: "ڈرنک کا فلیور", min: 1, max: 1, options: [{ name: "Coca-Cola", nameUr: "کوکا کولا", isDefault: true }, { name: "Sprite", nameUr: "اسپرائٹ" }, { name: "Fanta", nameUr: "فینٹا" }, { name: "Diet Coke", nameUr: "ڈائیٹ کوک" }] },
  kid: { name: "Kid's burger", nameUr: "بچوں کا برگر", min: 1, max: 1, options: [{ name: "Krunch Burger", nameUr: "کرنچ برگر", isDefault: true }, { name: "Chicken Patty", nameUr: "چکن پیٹی" }] },
  kidDrink: { name: "Milo / Drink + Toy", nameUr: "ملو / ڈرنک + کھلونا", min: 1, max: 1, options: [{ name: "Milo", nameUr: "ملو", isDefault: true }, { name: "Drink", nameUr: "ڈرنک" }] },
};

type Row = [cat: string, name: string, price: number, groups: GroupKey[], emoji: string, fav?: boolean, combo?: boolean, desc?: string];
const ROWS: Row[] = [

    // Broast
    ["Broast", "Spicy Injected Broast (Quarter)", 650, ["spice", "sauce"], "🍗", true, false, "1x Leg Piece, 1x Thigh Piece, 1x Sauce Dip, 1x Fries, 1x Bun"],
    ["Broast", "Spicy Injected Broast (Half)", 1200, ["spice", "sauce"], "🍗", false, false, "1x Leg Piece, 1x Thigh Piece, 1x Chest Piece, 1x Wings, 2x Sauce Dip, 1x Fries + 2x Bun"],
    ["Broast", "Spicy Injected Broast (Full)", 2350, ["spice", "sauce"], "🍗", false, false, "2x Leg Piece, 2x Thigh Piece, 2x Chest Piece, 2x Wings, 2x Sauce Dip, 1x Fries + 2x Bun"],
    // Burgers
    ["Burgers", "CRSP (Zinger)", 450, ["spice", "addons", "sauce"], "🍔", true, false, "Crispy chicken zinger fillet topped with sauce and fresh lettuce"],
    ["Burgers", "Double CRSP (Zinger)", 650, ["spice", "addons", "sauce"], "🍔", false, false, "Double crispy chicken zinger fillet, melted cheese and sauce"],
    ["Burgers", "Hunter Burger", 500, ["spice", "addons", "sauce"], "🍔", false, false, "Juicy spicy hunter chicken patty with signature hot sauce"],
    ["Burgers", "Fillet Burger", 450, ["spice", "addons", "sauce"], "🍔", false, false, "Tender chicken breast fillet in soft toasted sesame bun"],
    ["Burgers", "Patty Burger", 400, ["spice", "addons", "sauce"], "🍔", false, false, "Crispy fried chicken patty burger"],
    ["Burgers", "Rallish Burger (Grill)", 550, ["spice", "addons", "sauce"], "🍔", false, false, "Flame-grilled chicken breast with relish sauce"],
    ["Burgers", "Beef Smash", 795, ["addons", "sauce"], "🍔", false, false, "100% smashed beef patty, melted cheddar & special sauce"],
    ["Burgers", "Beef Oklahoma Smash", 850, ["addons", "sauce"], "🍔", false, false, "Beef smashed with caramelized thinly sliced onions & cheese"],
    ["Burgers", "Beef Mushroom Smash", 850, ["addons", "sauce"], "🍔", false, false, "Juicy smash beef patty with creamy sautéed mushrooms & cheese"],
    ["Burgers", "Beef Jalapeno Smash", 870, ["addons", "sauce"], "🍔", false, false, "Smash beef with fiery pickled jalapenos and melted cheese"],
    // Wraps
    ["Wraps", "CRSP (Zinger) Wrap", 600, ["spice", "sauce"], "🌯", true, false, "Crispy zinger chicken strips wrapped in warm tortilla"],
    ["Wraps", "Rallish (Grill) Wrap", 600, ["spice", "sauce"], "🌯", false, false, "Grilled chicken strips, fresh veggies & relish sauce in tortilla"],
    // Wings
    ["Wings", "Simple Wings (10 pcs)", 500, ["sauce"], "🍗", false, false, "10 pcs crispy golden wings seasoned to perfection"],
    ["Wings", "Hot Buffalo Wings (10 pcs)", 550, ["sauce"], "🔥", false, false, "10 pcs wings tossed in tangy hot buffalo glaze"],
    ["Wings", "Sweet Thai Wings (10 pcs)", 550, ["sauce"], "🍗", false, false, "10 pcs wings coated in sweet & spicy Thai chili glaze"],
    ["Wings", "Masala Wings (10 pcs)", 550, ["sauce"], "🔥", false, false, "10 pcs wings dusted in signature spicy desi masala"],
    // Nuggets & Strips
    ["Nuggets & Strips", "Injected Nuggets (6 pcs)", 400, ["sauce"], "🍿", false, false, "6 pcs tender chicken nuggets injected with savory spice"],
    ["Nuggets & Strips", "Chicken Strips (6 pcs)", 450, ["sauce"], "🍗", false, false, "6 pcs crunchy breaded boneless chicken tender strips"],
    ["Nuggets & Strips", "Chicken Fries (6 pcs)", 400, ["sauce"], "🍟", false, false, "6 pcs tender fried chicken cut in fry-style fingers"],
    ["Nuggets & Strips", "Hot Shot (12 pcs)", 500, ["sauce"], "🔥", false, false, "12 pcs bite-sized fiery crunchy chicken popcorn bites"],
    // Fries
    ["Fries", "Simple Fries (Small)", 150, ["sauce"], "🍟", false, false, "Crispy golden potato fries - Small portion"],
    ["Fries", "Simple Fries (Medium)", 200, ["sauce"], "🍟", false, false, "Crispy golden potato fries - Medium portion"],
    ["Fries", "Simple Fries (Large)", 400, ["sauce"], "🍟", false, false, "Crispy golden potato fries - Large portion"],
    ["Fries", "Masala Fries", 430, ["sauce"], "🍟", false, false, "Fries tossed in zesty chatpata masala spice"],
    ["Fries", "CRSP Loaded Fries", 550, ["sauce"], "🍟", true, false, "Fries loaded with crispy chicken chunks, melted cheese & sauces"],
    ["Fries", "Grill Loaded Fries", 600, ["sauce"], "🍟", false, false, "Fries topped with grilled chicken, jalapenos & smoky sauce"],
    // Beverages
    ["Beverages", "Soft Drink (Can 250 ml)", 120, ["drinkFlavor"], "🥤", true, false, "Chilled canned soft drink (Coca-Cola, Sprite, Fanta, Diet Coke)"],
    ["Beverages", "Soft Drink (Bottle 350 ml)", 100, ["drinkFlavor"], "🥤", true, false, "Chilled bottle soft drink"],
    ["Beverages", "Soft Drink (Bottle 1 L)", 170, ["drinkFlavor"], "🥤", false, false, "1 Litre sharing bottle"],
    ["Beverages", "Soft Drink (Bottle 1.5 L)", 200, ["drinkFlavor"], "🥤", false, false, "1.5 Litre jumbo bottle"],
    ["Beverages", "Mineral Water (500 ml)", 60, [], "💧", true, false, "500ml cold mineral water"],
    // Extras
    ["Extras", "Chipotle Sauce", 100, [], "🥫"],
    ["Extras", "Garlic Sauce", 100, [], "🥫"],
    ["Extras", "Honey Mustard", 100, [], "🥫"],
    ["Extras", "Extra Cheese Slice", 80, [], "🧀"],
    ["Extras", "Buns", 50, [], "🍞"],
    ["Extras", "Chicken Piece", 300, [], "🍗"],
    ["Extras", "Coleslaw", 150, [], "🥗"],
    // Deals
    ["Deals", "Deal 1", 950, ["drink"], "🎁", true, true, "1 CRSP Burger, 1 Chicken piece, 1 Fries, 1 Drink"],
    ["Deals", "Deal 2", 1750, ["drink"], "🎁", true, true, "2 CRSP Burger, 2 Chicken piece, 2 Fries, 2 Drink"],
    ["Deals", "Deal 3", 1700, ["drink"], "🎁", false, true, "2 CRSP Burger, 1 Hot Wings (10), 2 Fries, 2 Drink"],
    ["Deals", "Deal 4", 1999, ["drink"], "🎁", false, true, "2 Double CRSP Burger, 2 Fries, 2 Chicken Piece, 2 Drinks"],
    ["Deals", "Deal 5", 2999, ["drink"], "🎁", false, true, "4 CRSP Burger, 4 Chicken piece, 4 Fries, 1.5L Drink"],
    ["Deals", "Deal 6", 1499, ["drink"], "🎁", false, true, "2 Fillet Burger, 2 Chicken Piece, 2 Drinks"],
    ["Deals", "Deal 7", 650, ["drink"], "🎁", false, true, "6 Nuggets, 1 Fries, 1 Drink"],
    ["Deals", "Deal 8", 1050, ["drink"], "🎁", false, true, "1 Wrap CRSP, 1 Wrap Grill, 1 Fries, 2 drinks"],
    ["Deals", "Deal 9", 1899, ["drink"], "🎁", false, true, "3 Double CRSP, 1L Drink"],
    ["Deals", "Kid's Deal 10", 699, ["kid", "kidDrink"], "🧸", false, true, "1 Krunch Burger / 1 Chicken Patty, 1 Fries, 1 Milo/Drink+Toy"]
];
export const ITEMS: MenuItemDef[] = ROWS.map(([cat, name, price, groups, emoji, fav, combo, desc]) => ({ cat, name, price, groups, emoji, fav: !!fav, combo: !!combo, desc: desc ?? null }));

export const URDU: Record<string, string> = {
  "Spicy Injected Broast (Quarter)": "اسپائسی انجیکٹڈ بروسٹ (کوارٹر)", "Spicy Injected Broast (Half)": "اسپائسی انجیکٹڈ بروسٹ (آدھا)", "Spicy Injected Broast (Full)": "اسپائسی انجیکٹڈ بروسٹ (فل)",
  "CRSP (Zinger)": "کرسپ (زنگر) برگر", "Double CRSP (Zinger)": "ڈبل کرسپ (زنگر) برگر", "Hunter Burger": "ہنٹر برگر", "Fillet Burger": "فلیٹ برگر", "Patty Burger": "پیٹی برگر",
  "Rallish Burger (Grill)": "ریلش برگر (گرل)", "Beef Smash": "بیف سمیش", "Beef Oklahoma Smash": "بیف اوکلاہوما سمیش", "Beef Mushroom Smash": "بیف مشروم سمیش", "Beef Jalapeno Smash": "بیف ہالاپینو سمیش",
  "CRSP (Zinger) Wrap": "کرسپ (زنگر) ریپ", "Rallish (Grill) Wrap": "ریلش (گرل) ریپ",
  "Simple Wings (10 pcs)": "سمپل ونگز (10 پیس)", "Hot Buffalo Wings (10 pcs)": "ہاٹ بفیلو ونگز (10 پیس)", "Sweet Thai Wings (10 pcs)": "سویٹ تھائی ونگز (10 پیس)", "Masala Wings (10 pcs)": "مصالحہ ونگز (10 پیس)",
  "Injected Nuggets (6 pcs)": "انجیکٹڈ نگٹس (6 پیس)", "Chicken Strips (6 pcs)": "چکن اسٹرپس (6 پیس)", "Chicken Fries (6 pcs)": "چکن فرائز (6 پیس)", "Hot Shot (12 pcs)": "ہاٹ شاٹ (12 پیس)",
  "Simple Fries (Small)": "سادہ فرائز (چھوٹے)", "Simple Fries (Medium)": "سادہ فرائز (درمیانے)", "Simple Fries (Large)": "سادہ فرائز (بڑے)", "Masala Fries": "مصالحہ فرائز", "CRSP Loaded Fries": "کرسپ لوڈڈ فرائز", "Grill Loaded Fries": "گرل لوڈڈ فرائز",
  "Soft Drink (Can 250 ml)": "سوفٹ ڈرنک (ٹن 250 ملی لیٹر)", "Soft Drink (Bottle 350 ml)": "سوفٹ ڈرنک (بوتل 350 ملی لیٹر)", "Soft Drink (Bottle 1 L)": "سوفٹ ڈرنک (بوتل 1 لیٹر)", "Soft Drink (Bottle 1.5 L)": "سوفٹ ڈرنک (بوتل 1.5 لیٹر)", "Mineral Water (500 ml)": "منرل واٹر (500 ملی لیٹر)",
  "Chipotle Sauce": "چپوٹلے ساس", "Garlic Sauce": "گارلک ساس", "Honey Mustard": "ہنی مسٹرڈ", "Extra Cheese Slice": "اضافی چیز سلائس", "Buns": "بنز", "Chicken Piece": "چکن پیس", "Coleslaw": "کول سلا",
  "Deal 1": "ڈیل 1", "Deal 2": "ڈیل 2", "Deal 3": "ڈیل 3", "Deal 4": "ڈیل 4", "Deal 5": "ڈیل 5", "Deal 6": "ڈیل 6", "Deal 7": "ڈیل 7", "Deal 8": "ڈیل 8", "Deal 9": "ڈیل 9", "Kid's Deal 10": "بچوں کی ڈیل 10",
};

/** Owner's sadqa pledge: % of the price of each broast size set aside (Quarter 5%, Half 10%, Full 20%). */
export const SADQA: Record<string, number> = { "Spicy Injected Broast (Quarter)": 500, "Spicy Injected Broast (Half)": 1000, "Spicy Injected Broast (Full)": 2000 };

/** [name, unit, cost in paisa per unit, imported, reorder level, nutrition per 100 g/ml (per piece for pc): kcal, protein, carbs, fat] */
export const INGREDIENTS: [string, Unit, number, boolean, number, [number, number, number, number]][] = [
  ["Chicken (raw)", "g", 60, false, 8000, [165, 31, 0, 3.6]], ["Beef (minced)", "g", 90, false, 4000, [250, 26, 0, 15]], ["Zinger fillet", "pc", 9500, false, 40, [300, 20, 15, 17]],
  ["Burger bun", "pc", 2500, false, 60, [150, 5, 28, 2]], ["Tortilla wrap", "pc", 2000, false, 60, [140, 4, 24, 3]], ["Potato (fries)", "g", 12, false, 10000, [77, 2, 17, 0.1]],
  ["Cooking oil", "ml", 45, false, 8000, [220, 0, 0, 25]], /* only ~25% of the frying oil used ends up in the food */ ["Breading mix", "g", 20, false, 5000, [350, 10, 72, 1.5]],
  ["Broast seasoning", "g", 150, true, 1000, [250, 10, 40, 5]], ["Coleslaw mix", "g", 10, false, 3000, [60, 1, 6, 4]], ["Cheese slice", "pc", 2000, false, 50, [70, 4, 1, 6]],
  ["Packaging box", "pc", 1500, false, 100, [0, 0, 0, 0]], ["Honey mustard sauce", "ml", 20, false, 1500, [300, 1, 25, 22]], ["Cheese sauce", "ml", 25, false, 1500, [250, 6, 10, 20]],
  ["Garlic sauce", "ml", 15, false, 2000, [450, 1, 3, 48]], ["Spicy garlic sauce", "ml", 18, false, 1500, [440, 1, 4, 46]], ["Ranch sauce", "ml", 20, false, 1500, [430, 1, 6, 45]],
  ["Chipotle sauce", "ml", 20, false, 1500, [250, 1, 12, 22]],
  ["Soft drink can 250 ml", "pc", 6000, false, 48, [105, 0, 27, 0]], ["Soft drink bottle 350 ml", "pc", 5500, false, 48, [147, 0, 37, 0]], ["Soft drink bottle 1 L", "pc", 10000, false, 24, [420, 0, 105, 0]],
  ["Soft drink bottle 1.5 L", "pc", 12500, false, 24, [630, 0, 158, 0]], ["Mineral water 500 ml", "pc", 3000, false, 48, [0, 0, 0, 0]],
];

// ---- recipes (per portion) ----
const merge = (...parts: RecipeLine[][]): RecipeLine[] => {
  const m = new Map<string, RecipeLine>();
  for (const [n, q, u] of parts.flat()) { const k = `${n}|${u}`; const cur = m.get(k); m.set(k, [n, (cur?.[1] ?? 0) + q, u]); }
  return [...m.values()].map(([n, q, u]) => [n, Math.round(q * 100) / 100, u]);
};
const times = (lines: RecipeLine[], n: number): RecipeLine[] => lines.map(([i, q, u]) => [i, q * n, u]);
const chicken = (grams: number, seasoning = 0.03): RecipeLine[] => [["Chicken (raw)", grams, "g"], ["Breading mix", Math.round(grams * 0.16), "g"], ["Cooking oil", Math.round(grams * 0.12), "ml"], ...(seasoning ? [["Broast seasoning", Math.round(grams * seasoning), "g"] as RecipeLine] : [])];
const fries = (g: number): RecipeLine[] => [["Potato (fries)", g, "g"], ["Cooking oil", Math.round(g * 0.1), "ml"]];
const box: RecipeLine[] = [["Packaging box", 1, "pc"]];
const dip = (n: number): RecipeLine[] => [["Garlic sauce", 30 * n, "ml"]];
const bun = (n: number): RecipeLine[] => [["Burger bun", n, "pc"]];

const R: Record<string, RecipeLine[]> = {};
R["Spicy Injected Broast (Quarter)"] = merge(chicken(240), dip(1), fries(200), bun(1), box);
R["Spicy Injected Broast (Half)"] = merge(chicken(500), dip(2), fries(200), bun(2), box);
R["Spicy Injected Broast (Full)"] = merge(chicken(1000), dip(2), fries(200), bun(2), times(box, 2));
const zinger: RecipeLine[] = [["Zinger fillet", 1, "pc"], ["Burger bun", 1, "pc"], ["Coleslaw mix", 30, "g"], ["Garlic sauce", 15, "ml"], ["Packaging box", 1, "pc"]];
R["CRSP (Zinger)"] = zinger;
R["Double CRSP (Zinger)"] = merge(times([["Zinger fillet", 1, "pc"]], 2), bun(1), [["Cheese slice", 1, "pc"], ["Garlic sauce", 20, "ml"]], box);
R["Hunter Burger"] = merge(zinger, [["Chipotle sauce", 20, "ml"]]);
R["Fillet Burger"] = merge(chicken(150, 0), bun(1), dip(1).map(([n, , u]) => [n, 15, u] as RecipeLine), box);
R["Patty Burger"] = merge(chicken(120, 0), bun(1), [["Garlic sauce", 15, "ml"]], box);
R["Rallish Burger (Grill)"] = merge([["Chicken (raw)", 150, "g"]], bun(1), [["Garlic sauce", 15, "ml"], ["Coleslaw mix", 20, "g"]], box);
const smash = (patty = 150, cheese = 1): RecipeLine[] => merge([["Beef (minced)", patty, "g"], ["Cheese slice", cheese, "pc"]], bun(1), box);
R["Beef Smash"] = smash(); R["Beef Oklahoma Smash"] = smash(150, 2); R["Beef Mushroom Smash"] = smash(150, 2); R["Beef Jalapeno Smash"] = smash(150, 2);
R["CRSP (Zinger) Wrap"] = [["Zinger fillet", 1, "pc"], ["Tortilla wrap", 1, "pc"], ["Coleslaw mix", 30, "g"], ["Garlic sauce", 15, "ml"], ["Packaging box", 1, "pc"]];
R["Rallish (Grill) Wrap"] = [["Chicken (raw)", 150, "g"], ["Tortilla wrap", 1, "pc"], ["Coleslaw mix", 30, "g"], ["Garlic sauce", 15, "ml"], ["Packaging box", 1, "pc"]];
for (const w of ["Simple Wings", "Hot Buffalo Wings", "Sweet Thai Wings", "Masala Wings"]) R[`${w} (10 pcs)`] = merge(chicken(600, 0.02), [["Garlic sauce", 20, "ml"]], box);
R["Injected Nuggets (6 pcs)"] = merge(chicken(180), box); R["Chicken Strips (6 pcs)"] = merge(chicken(240), box); R["Chicken Fries (6 pcs)"] = merge(chicken(180), box); R["Hot Shot (12 pcs)"] = merge(chicken(240), box);
R["Simple Fries (Small)"] = fries(120); R["Simple Fries (Medium)"] = fries(200); R["Simple Fries (Large)"] = fries(350);
R["Masala Fries"] = merge(fries(200), [["Broast seasoning", 5, "g"]]);
R["CRSP Loaded Fries"] = merge(fries(200), [["Zinger fillet", 1, "pc"], ["Cheese sauce", 40, "ml"], ["Garlic sauce", 20, "ml"]]);
R["Grill Loaded Fries"] = merge(fries(200), [["Chicken (raw)", 100, "g"], ["Cheese sauce", 40, "ml"]]);
R["Soft Drink (Can 250 ml)"] = [["Soft drink can 250 ml", 1, "pc"]]; R["Soft Drink (Bottle 350 ml)"] = [["Soft drink bottle 350 ml", 1, "pc"]];
R["Soft Drink (Bottle 1 L)"] = [["Soft drink bottle 1 L", 1, "pc"]]; R["Soft Drink (Bottle 1.5 L)"] = [["Soft drink bottle 1.5 L", 1, "pc"]]; R["Mineral Water (500 ml)"] = [["Mineral water 500 ml", 1, "pc"]];
R["Chipotle Sauce"] = [["Chipotle sauce", 30, "ml"]]; R["Garlic Sauce"] = [["Garlic sauce", 30, "ml"]]; R["Honey Mustard"] = [["Honey mustard sauce", 30, "ml"]];
R["Extra Cheese Slice"] = [["Cheese slice", 1, "pc"]]; R["Buns"] = bun(1); R["Chicken Piece"] = chicken(150); R["Coleslaw"] = [["Coleslaw mix", 100, "g"]];
const bottle = R["Soft Drink (Bottle 350 ml)"], piece = R["Chicken Piece"], medFries = R["Simple Fries (Medium)"];
R["Deal 1"] = merge(R["CRSP (Zinger)"], piece, medFries, bottle);
R["Deal 2"] = times(R["Deal 1"], 2);
R["Deal 3"] = merge(times(R["CRSP (Zinger)"], 2), R["Hot Buffalo Wings (10 pcs)"], times(medFries, 2), times(bottle, 2));
R["Deal 4"] = merge(times(R["Double CRSP (Zinger)"], 2), times(medFries, 2), times(piece, 2), times(bottle, 2));
R["Deal 5"] = merge(times(R["CRSP (Zinger)"], 4), times(piece, 4), times(medFries, 4), R["Soft Drink (Bottle 1.5 L)"]);
R["Deal 6"] = merge(times(R["Fillet Burger"], 2), times(piece, 2), times(bottle, 2));
R["Deal 7"] = merge(R["Injected Nuggets (6 pcs)"], medFries, bottle);
R["Deal 8"] = merge(R["CRSP (Zinger) Wrap"], R["Rallish (Grill) Wrap"], medFries, times(bottle, 2));
R["Deal 9"] = merge(times(R["Double CRSP (Zinger)"], 3), R["Soft Drink (Bottle 1 L)"]);
R["Kid's Deal 10"] = merge(R["Patty Burger"], fries(120), bottle);
export const RECIPES = R;

/** Add-on / sauce options also use stock. */
export const MODIFIER_RECIPES: Record<string, RecipeLine[]> = {
  "Chipotle Sauce": [["Chipotle sauce", 30, "ml"]], "Garlic Sauce": [["Garlic sauce", 30, "ml"]], "Honey Mustard": [["Honey mustard sauce", 30, "ml"]],
  "Extra beef patty": [["Beef (minced)", 100, "g"]], "Make it meal (Fries + drink)": merge(fries(200), bottle), "Extra Cheese Slice": [["Cheese slice", 1, "pc"]],
};
