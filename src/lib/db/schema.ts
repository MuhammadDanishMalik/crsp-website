/**
 * CRSP POS — Drizzle schema (proposed, Postgres/Supabase).
 * Will be split into src/lib/db/schema/*.ts at build time; shown here as one file.
 * Conventions: money = integer paisa; rates = integer basis points (1500 = 15%);
 * ids = uuid (client-generatable for offline); timestamps = timestamptz (UTC, display Asia/Karachi);
 * every operational table carries branch_id for RLS.
 */
import {
  pgTable, pgEnum, uuid, text, integer, boolean, timestamp, date, time, jsonb, numeric,
  uniqueIndex, index, primaryKey, smallint,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const paisa = (name: string) => integer(name).notNull().default(0);

/* ───────────── Enums ───────────── */
export const orderType = pgEnum("order_type", ["dine_in", "takeaway", "delivery", "drive_thru", "online"]);
export const orderStatus = pgEnum("order_status", ["open", "held", "sent", "preparing", "ready", "served", "completed", "voided", "refunded"]);
export const kdsStatus = pgEnum("kds_status", ["new", "preparing", "ready", "bumped", "recalled"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "card", "jazzcash", "easypaisa", "raast", "bank_transfer", "credit_account", "voucher", "gift_card", "loyalty"]);
export const paymentStatus = pgEnum("payment_status", ["pending", "pending_verification", "confirmed", "failed", "refunded", "partially_refunded"]);
export const discountKind = pgEnum("discount_kind", ["percent", "fixed"]);
export const discountScope = pgEnum("discount_scope", ["item", "order"]);
export const shiftStatus = pgEnum("shift_status", ["open", "closed"]);
export const cashMoveType = pgEnum("cash_move_type", ["float", "cash_in", "cash_out", "drop", "no_sale", "rider_settlement"]);
export const deliveryStatus = pgEnum("delivery_status", ["unassigned", "assigned", "picked", "delivered", "failed", "cancelled"]);
export const taxAuthority = pgEnum("tax_authority", ["fbr", "pra", "none"]);
export const syncState = pgEnum("sync_state", ["pending", "sent", "failed"]);
export const stockMoveType = pgEnum("stock_move_type", ["purchase", "sale", "transfer_in", "transfer_out", "wastage", "adjustment", "count"]);
export const salaryType = pgEnum("salary_type", ["monthly", "hourly"]);
export const poStatus = pgEnum("po_status", ["draft", "ordered", "partial", "received", "cancelled"]);
export const printerConn = pgEnum("printer_conn", ["usb", "lan", "bluetooth", "serial"]);
export const attendanceStatus = pgEnum("attendance_status", ["present", "late", "absent", "leave"]);

/* ───────────── Tenancy: business, branches, terminals ───────────── */
export const business = pgTable("business", {
  id: id(), name: text("name").notNull(), legalName: text("legal_name"), ntn: text("ntn"), strn: text("strn"),
  logoUrl: text("logo_url"), currency: text("currency").notNull().default("PKR"),
  timezone: text("timezone").notNull().default("Asia/Karachi"), defaultLocale: text("default_locale").notNull().default("en"),
  settings: jsonb("settings").notNull().default({}), createdAt: createdAt(),
});

export const branches = pgTable("branches", {
  id: id(), businessId: uuid("business_id").notNull().references(() => business.id),
  code: text("code").notNull(), name: text("name").notNull(), address: text("address"), city: text("city"),
  phone: text("phone"), taxAuthority: taxAuthority("tax_authority").notNull().default("none"),
  taxRegistrationNo: text("tax_registration_no"), posId: text("pos_id"),       // authority-issued POS ID
  isActive: boolean("is_active").notNull().default(true), settings: jsonb("settings").notNull().default({}),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("branches_code_uq").on(t.businessId, t.code)]);

export const terminals = pgTable("terminals", {
  id: id(), branchId: uuid("branch_id").notNull().references(() => branches.id),
  name: text("name").notNull(), kind: text("kind").notNull().default("pos"), // pos | tablet | kds | display | status_tv
  deviceKeyHash: text("device_key_hash").notNull(), orderNoPrefix: text("order_no_prefix"), // offline number blocks
  isActive: boolean("is_active").notNull().default(true), lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/* ───────────── Auth, roles, staff ───────────── */
export const roles = pgTable("roles", {
  id: id(), businessId: uuid("business_id").notNull().references(() => business.id),
  key: text("key").notNull(), name: text("name").notNull(), isSystem: boolean("is_system").notNull().default(false),
  discountLimitBps: integer("discount_limit_bps").notNull().default(1000), // max % without override
  createdAt: createdAt(),
}, (t) => [uniqueIndex("roles_key_uq").on(t.businessId, t.key)]);

export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permission: text("permission").notNull(),                                   // key from permissions.ts
}, (t) => [primaryKey({ columns: [t.roleId, t.permission] })]);

export const staff = pgTable("staff", {
  id: id(), businessId: uuid("business_id").notNull().references(() => business.id),
  authUserId: uuid("auth_user_id").unique(),                                  // Supabase auth.users (back-office login)
  roleId: uuid("role_id").notNull().references(() => roles.id),
  fullName: text("full_name").notNull(), photoUrl: text("photo_url"), cnic: text("cnic"), phone: text("phone"),
  email: text("email"), passwordHash: text("password_hash"), pinHash: text("pin_hash"), pinFailedCount: smallint("pin_failed_count").notNull().default(0),
  pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true }),
  salaryType: salaryType("salary_type").notNull().default("monthly"), salaryAmount: paisa("salary_amount"),
  hireDate: date("hire_date"), isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(), updatedAt: updatedAt(),
});

export const staffBranches = pgTable("staff_branches", {
  staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.staffId, t.branchId] })]);

export const posSessions = pgTable("pos_sessions", {                          // PIN-login sessions bound to a terminal
  id: id(), staffId: uuid("staff_id").notNull().references(() => staff.id),
  terminalId: uuid("terminal_id").notNull().references(() => terminals.id),
  tokenHash: text("token_hash").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true }), createdAt: createdAt(),
});

export const attendance = pgTable("attendance", {
  id: id(), branchId: uuid("branch_id").notNull().references(() => branches.id),
  staffId: uuid("staff_id").notNull().references(() => staff.id), workDate: date("work_date").notNull(),
  clockIn: timestamp("clock_in", { withTimezone: true }), clockOut: timestamp("clock_out", { withTimezone: true }),
  status: attendanceStatus("status").notNull().default("present"), minutesWorked: integer("minutes_worked"),
  note: text("note"), terminalId: uuid("terminal_id").references(() => terminals.id),
}, (t) => [index("attendance_staff_date").on(t.staffId, t.workDate)]);

export const shiftSchedules = pgTable("shift_schedules", {
  id: id(), branchId: uuid("branch_id").notNull().references(() => branches.id),
  staffId: uuid("staff_id").notNull().references(() => staff.id), weekday: smallint("weekday").notNull(),
  startsAt: time("starts_at").notNull(), endsAt: time("ends_at").notNull(),
});

export const payrollAdjustments = pgTable("payroll_adjustments", {            // advances & deductions
  id: id(), staffId: uuid("staff_id").notNull().references(() => staff.id), branchId: uuid("branch_id").notNull().references(() => branches.id),
  kind: text("kind").notNull(), amount: paisa("amount"), forMonth: date("for_month").notNull(), note: text("note"), createdAt: createdAt(),
});

/* ───────────── Menu ───────────── */
export const categories = pgTable("categories", {
  id: id(), businessId: uuid("business_id").notNull().references(() => business.id),
  name: text("name").notNull(), nameUr: text("name_ur"), icon: text("icon"), sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const menuItems = pgTable("menu_items", {
  id: id(), businessId: uuid("business_id").notNull().references(() => business.id),
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  name: text("name").notNull(), nameUr: text("name_ur"), description: text("description"), imageUrl: text("image_url"),
  sku: text("sku"), barcode: text("barcode"), basePrice: paisa("base_price"), isCombo: boolean("is_combo").notNull().default(false),
  kitchenStationId: uuid("kitchen_station_id"), isFavourite: boolean("is_favourite").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0), isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index("menu_items_barcode").on(t.barcode)]);

export const branchMenuItems = pgTable("branch_menu_items", {                // per-branch price + availability
  branchId: uuid("branch_id").notNull().references(() => branches.id),
  itemId: uuid("item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  price: integer("price"), isAvailable: boolean("is_available").notNull().default(true),
  soldOutReason: text("sold_out_reason"), updatedAt: updatedAt(),
}, (t) => [primaryKey({ columns: [t.branchId, t.itemId] })]);

export const itemSizes = pgTable("item_sizes", {                              // e.g. Regular / Large with price delta
  id: id(), itemId: uuid("item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  name: text("name").notNull(), priceDelta: paisa("price_delta"), isDefault: boolean("is_default").notNull().default(false),
});

export const modifierGroups = pgTable("modifier_groups", {
  id: id(), businessId: uuid("business_id").notNull().references(() => business.id),
  name: text("name").notNull(), nameUr: text("name_ur"), minSelect: smallint("min_select").notNull().default(0),
  maxSelect: smallint("max_select").notNull().default(1),                      // min>=1 ⇒ required
});

export const modifiers = pgTable("modifiers", {
  id: id(), groupId: uuid("group_id").notNull().references(() => modifierGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(), nameUr: text("name_ur"), priceDelta: paisa("price_delta"),
  linkedItemId: uuid("linked_item_id").references(() => menuItems.id),         // e.g. "choose drink" → real item for stock
  isDefault: boolean("is_default").notNull().default(false), sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const itemModifierGroups = pgTable("item_modifier_groups", {
  itemId: uuid("item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").notNull().references(() => modifierGroups.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.itemId, t.groupId] })]);

export const comboComponents = pgTable("combo_components", {                  // a combo = menu_item(isCombo) + slots
  id: id(), comboItemId: uuid("combo_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  slotName: text("slot_name").notNull(), quantity: smallint("quantity").notNull().default(1),
  fixedItemId: uuid("fixed_item_id").references(() => menuItems.id),           // fixed item, or…
  choiceCategoryId: uuid("choice_category_id").references(() => categories.id), // …pick any from category
  priceDelta: paisa("price_delta"), pricingMode: text("pricing_mode").notNull().default("fixed"), // fixed | calculated
});

export const menuSchedules = pgTable("menu_schedules", {                      // breakfast/lunch/late-night & timed deals
  id: id(), businessId: uuid("business_id").notNull().references(() => business.id),
  name: text("name").notNull(), startsAt: time("starts_at").notNull(), endsAt: time("ends_at").notNull(),
  weekdays: jsonb("weekdays").notNull().default([0,1,2,3,4,5,6]), isActive: boolean("is_active").notNull().default(true),
});
export const menuScheduleItems = pgTable("menu_schedule_items", {
  scheduleId: uuid("schedule_id").notNull().references(() => menuSchedules.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  priceOverride: integer("price_override"),
}, (t) => [primaryKey({ columns: [t.scheduleId, t.itemId] })]);

/* ───────────── Customers & loyalty ───────────── */
export const customers = pgTable("customers", {
  id: id(), businessId: uuid("business_id").notNull().references(() => business.id),
  phone: text("phone").notNull(), name: text("name"), notes: text("notes"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0), accountBalance: integer("account_balance").notNull().default(0),
  creditLimit: paisa("credit_limit"), isCorporate: boolean("is_corporate").notNull().default(false), createdAt: createdAt(),
}, (t) => [uniqueIndex("customers_phone_uq").on(t.businessId, t.phone)]);

export const customerAddresses = pgTable("customer_addresses", {
  id: id(), customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  label: text("label"), address: text("address").notNull(), landmark: text("landmark"), zoneId: uuid("zone_id"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const loyaltyRules = pgTable("loyalty_rules", {
  id: id(), businessId: uuid("business_id").notNull().references(() => business.id),
  earnPerRupee: numeric("earn_per_rupee", { precision: 8, scale: 4 }).notNull().default("0.01"),
  pointValuePaisa: integer("point_value_paisa").notNull().default(100), minRedeemPoints: integer("min_redeem_points").notNull().default(100),
  isActive: boolean("is_active").notNull().default(true),
});

export const loyaltyTransactions = pgTable("loyalty_transactions", {
  id: id(), customerId: uuid("customer_id").notNull().references(() => customers.id),
  orderId: uuid("order_id"), points: integer("points").notNull(), reason: text("reason").notNull(), createdAt: createdAt(),
});

/* ───────────── Shifts & drawer ───────────── */
export const shifts = pgTable("shifts", {
  id: id(), branchId: uuid("branch_id").notNull().references(() => branches.id),
  terminalId: uuid("terminal_id").notNull().references(() => terminals.id), staffId: uuid("staff_id").notNull().references(() => staff.id),
  status: shiftStatus("status").notNull().default("open"), openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }), openingFloat: paisa("opening_float"),
  countedCash: integer("counted_cash"),                                        // blind count entered at close
  expectedCash: integer("expected_cash"), overShort: integer("over_short"), closeNote: text("close_note"),
  denominations: jsonb("denominations"),
});

export const cashMovements = pgTable("cash_movements", {
  id: id(), shiftId: uuid("shift_id").notNull().references(() => shifts.id), branchId: uuid("branch_id").notNull().references(() => branches.id),
  type: cashMoveType("type").notNull(), amount: paisa("amount"), reason: text("reason"),
  approvedBy: uuid("approved_by").references(() => staff.id), createdBy: uuid("created_by").notNull().references(() => staff.id), createdAt: createdAt(),
});

export const dayClosures = pgTable("day_closures", {                          // Z-report
  id: id(), branchId: uuid("branch_id").notNull().references(() => branches.id), businessDate: date("business_date").notNull(),
  totals: jsonb("totals").notNull(), closedBy: uuid("closed_by").notNull().references(() => staff.id), closedAt: createdAt(),
}, (t) => [uniqueIndex("day_closure_uq").on(t.branchId, t.businessDate)]);

/* ───────────── Delivery ───────────── */
export const deliveryZones = pgTable("delivery_zones", {
  id: id(), branchId: uuid("branch_id").notNull().references(() => branches.id),
  name: text("name").notNull(), charge: paisa("charge"), minOrder: paisa("min_order"), etaMinutes: integer("eta_minutes"),
  isActive: boolean("is_active").notNull().default(true),
});

/* ───────────── Tax & discounts ───────────── */
export const taxRules = pgTable("tax_rules", {                                // never hard-coded; editable
  id: id(), branchId: uuid("branch_id").references(() => branches.id), name: text("name").notNull(),
  rateBps: integer("rate_bps").notNull(), appliesToOrderTypes: jsonb("applies_to_order_types").notNull().default([]),
  appliesToPaymentMethods: jsonb("applies_to_payment_methods").notNull().default([]), // e.g. lower rate for cash/card per PRA
  appliesToServiceCharge: boolean("applies_to_service_charge").notNull().default(false),
  isInclusive: boolean("is_inclusive").notNull().default(false), priority: integer("priority").notNull().default(0),
  validFrom: date("valid_from"), validTo: date("valid_to"), isActive: boolean("is_active").notNull().default(true),
});

export const discounts = pgTable("discounts", {                               // promo codes & preset discounts
  id: id(), businessId: uuid("business_id").notNull().references(() => business.id),
  name: text("name").notNull(), code: text("code"), kind: discountKind("kind").notNull(), value: integer("value").notNull(), // bps or paisa
  scope: discountScope("scope").notNull().default("order"), isStaffMeal: boolean("is_staff_meal").notNull().default(false),
  minOrder: paisa("min_order"), maxUses: integer("max_uses"), usedCount: integer("used_count").notNull().default(0),
  validFrom: timestamp("valid_from", { withTimezone: true }), validTo: timestamp("valid_to", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => [uniqueIndex("discount_code_uq").on(t.businessId, t.code)]);

export const vouchers = pgTable("vouchers", {
  id: id(), businessId: uuid("business_id").notNull().references(() => business.id), code: text("code").notNull().unique(),
  balance: paisa("balance"), initialValue: paisa("initial_value"), expiresAt: timestamp("expires_at", { withTimezone: true }),
  customerId: uuid("customer_id").references(() => customers.id), isActive: boolean("is_active").notNull().default(true),
});

/* ───────────── Orders ───────────── */
export const orderCounters = pgTable("order_counters", {                      // daily reset per branch
  branchId: uuid("branch_id").notNull().references(() => branches.id), businessDate: date("business_date").notNull(),
  lastNumber: integer("last_number").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.branchId, t.businessDate] })]);

export const orders = pgTable("orders", {
  id: id(),                                                                   // client-generated UUID for offline idempotency
  branchId: uuid("branch_id").notNull().references(() => branches.id), terminalId: uuid("terminal_id").notNull().references(() => terminals.id),
  shiftId: uuid("shift_id").references(() => shifts.id), businessDate: date("business_date").notNull(),
  orderNo: text("order_no").notNull(), type: orderType("type").notNull(), status: orderStatus("status").notNull().default("open"),
  tableNo: text("table_no"), customerId: uuid("customer_id").references(() => customers.id),
  deliveryAddress: text("delivery_address"), deliveryZoneId: uuid("delivery_zone_id").references(() => deliveryZones.id),
  aggregatorName: text("aggregator_name"), aggregatorRef: text("aggregator_ref"), guestCount: smallint("guest_count"),
  subtotal: paisa("subtotal"), discountTotal: paisa("discount_total"), serviceCharge: paisa("service_charge"),
  deliveryCharge: paisa("delivery_charge"), taxTotal: paisa("tax_total"), roundingAdj: integer("rounding_adj").notNull().default(0),
  total: paisa("total"), amountPaid: paisa("amount_paid"), note: text("note"),
  loyaltyPointsEarned: integer("loyalty_points_earned").notNull().default(0), loyaltyPointsRedeemed: integer("loyalty_points_redeemed").notNull().default(0),
  createdBy: uuid("created_by").notNull().references(() => staff.id), createdAt: createdAt(), updatedAt: updatedAt(),
  completedAt: timestamp("completed_at", { withTimezone: true }), readyAt: timestamp("ready_at", { withTimezone: true }), voidedBy: uuid("voided_by").references(() => staff.id),
  voidReason: text("void_reason"), offlineCreated: boolean("offline_created").notNull().default(false),
}, (t) => [
  uniqueIndex("orders_no_uq").on(t.branchId, t.businessDate, t.orderNo),
  index("orders_branch_date").on(t.branchId, t.businessDate), index("orders_status").on(t.branchId, t.status),
]);

export const orderItems = pgTable("order_items", {
  id: id(), orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").notNull().references(() => menuItems.id), parentLineId: uuid("parent_line_id"), // combo children
  nameSnapshot: text("name_snapshot").notNull(), sizeName: text("size_name"), unitPrice: paisa("unit_price"), quantity: smallint("quantity").notNull().default(1),
  discountAmount: paisa("discount_amount"), taxAmount: paisa("tax_amount"), lineTotal: paisa("line_total"),
  costSnapshot: paisa("cost_snapshot"), note: text("note"), stationId: uuid("station_id"),
  kdsStatus: kdsStatus("kds_status").notNull().default("new"), sentAt: timestamp("sent_at", { withTimezone: true }),
  bumpedAt: timestamp("bumped_at", { withTimezone: true }), isVoided: boolean("is_voided").notNull().default(false),
  voidReason: text("void_reason"), voidedBy: uuid("voided_by").references(() => staff.id),
}, (t) => [index("order_items_order").on(t.orderId)]);

export const orderItemModifiers = pgTable("order_item_modifiers", {
  id: id(), orderItemId: uuid("order_item_id").notNull().references(() => orderItems.id, { onDelete: "cascade" }),
  modifierId: uuid("modifier_id").references(() => modifiers.id), nameSnapshot: text("name_snapshot").notNull(),
  priceDelta: paisa("price_delta"), isRemoval: boolean("is_removal").notNull().default(false),
});

export const orderDiscounts = pgTable("order_discounts", {
  id: id(), orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  orderItemId: uuid("order_item_id").references(() => orderItems.id), discountId: uuid("discount_id").references(() => discounts.id),
  kind: discountKind("kind").notNull(), value: integer("value").notNull(), amount: paisa("amount"), reason: text("reason"),
  appliedBy: uuid("applied_by").notNull().references(() => staff.id), approvedBy: uuid("approved_by").references(() => staff.id),
});

export const orderTaxLines = pgTable("order_tax_lines", {
  id: id(), orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  taxRuleId: uuid("tax_rule_id").references(() => taxRules.id), name: text("name").notNull(), rateBps: integer("rate_bps").notNull(), amount: paisa("amount"),
});

export const orderSplits = pgTable("order_splits", {                          // split bill: which items/share belong to which payer
  id: id(), orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  label: text("label").notNull(), mode: text("mode").notNull(), itemIds: jsonb("item_ids"), amount: paisa("amount"),
});

/* ───────────── Payments ───────────── */
export const payments = pgTable("payments", {
  id: id(), orderId: uuid("order_id").notNull().references(() => orders.id), branchId: uuid("branch_id").notNull().references(() => branches.id),
  shiftId: uuid("shift_id").references(() => shifts.id), splitId: uuid("split_id").references(() => orderSplits.id),
  method: paymentMethod("method").notNull(), status: paymentStatus("status").notNull().default("pending"),
  amount: paisa("amount"), tendered: integer("tendered"), changeGiven: integer("change_given"),
  provider: text("provider").notNull().default("manual"), providerRef: text("provider_ref"), approvalCode: text("approval_code"),
  cardBrand: text("card_brand"), cardLast4: text("card_last4"), referenceNo: text("reference_no"),
  providerPayload: jsonb("provider_payload"), createdBy: uuid("created_by").notNull().references(() => staff.id),
  confirmedBy: uuid("confirmed_by").references(() => staff.id), createdAt: createdAt(), confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
}, (t) => [index("payments_order").on(t.orderId), index("payments_status").on(t.branchId, t.status)]);

export const refunds = pgTable("refunds", {
  id: id(), orderId: uuid("order_id").notNull().references(() => orders.id), paymentId: uuid("payment_id").references(() => payments.id),
  branchId: uuid("branch_id").notNull().references(() => branches.id), shiftId: uuid("shift_id").references(() => shifts.id),
  kind: text("kind").notNull().default("refund"), method: text("method"), amount: paisa("amount"),
  reasonCode: text("reason_code").notNull(), note: text("note"), items: jsonb("items"),
  requestedBy: uuid("requested_by").notNull().references(() => staff.id), approvedBy: uuid("approved_by").references(() => staff.id),
  providerRef: text("provider_ref"), createdAt: createdAt(),
});

export const reasonCodes = pgTable("reason_codes", {
  id: id(), businessId: uuid("business_id").notNull().references(() => business.id),
  kind: text("kind").notNull(), label: text("label").notNull(), labelUr: text("label_ur"), isActive: boolean("is_active").notNull().default(true), // void | refund | wastage | discount
});

export const paymentMethodSettings = pgTable("payment_method_settings", {
  branchId: uuid("branch_id").notNull().references(() => branches.id), method: paymentMethod("method").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true), provider: text("provider").notNull().default("manual"), config: jsonb("config").notNull().default({}),
}, (t) => [primaryKey({ columns: [t.branchId, t.method] })]);

/* ───────────── Tax authority (FBR / PRA) ───────────── */
export const taxInvoices = pgTable("tax_invoices", {
  id: id(), orderId: uuid("order_id").notNull().unique().references(() => orders.id), branchId: uuid("branch_id").notNull().references(() => branches.id),
  authority: taxAuthority("authority").notNull(), authorityInvoiceNo: text("authority_invoice_no"), qrPayload: text("qr_payload"),
  state: syncState("state").notNull().default("pending"), attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"), nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  requestPayload: jsonb("request_payload"), responsePayload: jsonb("response_payload"), createdAt: createdAt(), sentAt: timestamp("sent_at", { withTimezone: true }),
}, (t) => [index("tax_invoices_retry").on(t.state, t.nextRetryAt)]);

/* ───────────── Hardware: printers, stations, receipts ───────────── */
export const kitchenStations = pgTable("kitchen_stations", {
  id: id(), branchId: uuid("branch_id").notNull().references(() => branches.id), name: text("name").notNull(),   // fryer, burger, drinks
  printerId: uuid("printer_id"), warnSeconds: integer("warn_seconds").notNull().default(300), lateSeconds: integer("late_seconds").notNull().default(600),
});

export const printers = pgTable("printers", {
  id: id(), branchId: uuid("branch_id").notNull().references(() => branches.id), terminalId: uuid("terminal_id").references(() => terminals.id),
  name: text("name").notNull(), role: text("role").notNull().default("receipt"), // receipt | kot
  connection: printerConn("connection").notNull(), address: text("address"), port: integer("port").default(9100),
  paperWidthMm: smallint("paper_width_mm").notNull().default(80), codepage: text("codepage").default("CP437"),
  openDrawer: boolean("open_drawer").notNull().default(false), isActive: boolean("is_active").notNull().default(true),
});

export const printRoutes = pgTable("print_routes", {                          // item/category → station/printer
  id: id(), branchId: uuid("branch_id").notNull().references(() => branches.id), printerId: uuid("printer_id").notNull().references(() => printers.id),
  categoryId: uuid("category_id").references(() => categories.id), itemId: uuid("item_id").references(() => menuItems.id),
  orderType: orderType("order_type"), copies: smallint("copies").notNull().default(1),
});

export const receiptTemplates = pgTable("receipt_templates", {
  id: id(), branchId: uuid("branch_id").references(() => branches.id), name: text("name").notNull(),
  showLogo: boolean("show_logo").notNull().default(true), header: text("header"), footer: text("footer"), footerUr: text("footer_ur"),
  layout: jsonb("layout").notNull().default({}), copiesByOrderType: jsonb("copies_by_order_type").notNull().default({}),
});

export const printJobs = pgTable("print_jobs", {                              // queue → retry, reprint audit
  id: id(), branchId: uuid("branch_id").notNull().references(() => branches.id), printerId: uuid("printer_id").references(() => printers.id),
  orderId: uuid("order_id").references(() => orders.id), kind: text("kind").notNull(), payload: jsonb("payload").notNull(),
  state: syncState("state").notNull().default("pending"), attempts: integer("attempts").notNull().default(0), createdAt: createdAt(),
});

/* ───────────── Inventory & purchasing ───────────── */
export const units = pgTable("units", {
  id: id(), code: text("code").notNull().unique(), name: text("name").notNull(),                         // kg, g, l, ml, pc
});
export const unitConversions = pgTable("unit_conversions", {
  fromUnitId: uuid("from_unit_id").notNull().references(() => units.id), toUnitId: uuid("to_unit_id").notNull().references(() => units.id),
  factor: numeric("factor", { precision: 14, scale: 6 }).notNull(),
}, (t) => [primaryKey({ columns: [t.fromUnitId, t.toUnitId] })]);

export const ingredients = pgTable("ingredients", {
  id: id(), businessId: uuid("business_id").notNull().references(() => business.id), name: text("name").notNull(), sku: text("sku"),
  baseUnitId: uuid("base_unit_id").notNull().references(() => units.id), isImported: boolean("is_imported").notNull().default(false),
  originCountry: text("origin_country"), avgCost: paisa("avg_cost"), // per base unit
  isActive: boolean("is_active").notNull().default(true),
});

export const ingredientStock = pgTable("ingredient_stock", {
  branchId: uuid("branch_id").notNull().references(() => branches.id), ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull().default("0"),
  reorderLevel: numeric("reorder_level", { precision: 14, scale: 4 }).notNull().default("0"),
}, (t) => [primaryKey({ columns: [t.branchId, t.ingredientId] })]);

export const stockBatches = pgTable("stock_batches", {                        // imported items: batch, expiry, landed cost
  id: id(), branchId: uuid("branch_id").notNull().references(() => branches.id), ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id),
  batchNo: text("batch_no"), expiryDate: date("expiry_date"), quantityRemaining: numeric("quantity_remaining", { precision: 14, scale: 4 }).notNull(),
  unitCost: paisa("unit_cost"), landedUnitCost: paisa("landed_unit_cost"), freightCost: paisa("freight_cost"), dutyCost: paisa("duty_cost"),
  otherCost: paisa("other_cost"), purchaseOrderId: uuid("purchase_order_id"), receivedAt: createdAt(),
}, (t) => [index("batches_expiry").on(t.branchId, t.expiryDate)]);

export const recipes = pgTable("recipes", {
  id: id(), itemId: uuid("item_id").references(() => menuItems.id, { onDelete: "cascade" }),
  modifierId: uuid("modifier_id").references(() => modifiers.id, { onDelete: "cascade" }),     // modifiers can deduct stock too
  sizeId: uuid("size_id").references(() => itemSizes.id),
  ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id), quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
  unitId: uuid("unit_id").notNull().references(() => units.id),
});

export const stockMovements = pgTable("stock_movements", {
  id: id(), branchId: uuid("branch_id").notNull().references(() => branches.id), ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id),
  type: stockMoveType("type").notNull(), quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),    // signed
  unitCost: paisa("unit_cost"), batchId: uuid("batch_id").references(() => stockBatches.id), orderId: uuid("order_id").references(() => orders.id),
  transferBranchId: uuid("transfer_branch_id").references(() => branches.id), reasonCodeId: uuid("reason_code_id").references(() => reasonCodes.id),
  note: text("note"), createdBy: uuid("created_by").references(() => staff.id), createdAt: createdAt(),
}, (t) => [index("stock_mv_ing").on(t.branchId, t.ingredientId, t.createdAt)]);

export const suppliers = pgTable("suppliers", {
  id: id(), businessId: uuid("business_id").notNull().references(() => business.id), name: text("name").notNull(),
  phone: text("phone"), address: text("address"), isImporter: boolean("is_importer").notNull().default(false),
  balance: integer("balance").notNull().default(0), isActive: boolean("is_active").notNull().default(true),
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: id(), branchId: uuid("branch_id").notNull().references(() => branches.id), supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
  poNo: text("po_no").notNull(), status: poStatus("status").notNull().default("draft"), expectedDate: date("expected_date"),
  total: paisa("total"), note: text("note"), createdBy: uuid("created_by").references(() => staff.id), createdAt: createdAt(),
});
export const purchaseOrderLines = pgTable("purchase_order_lines", {
  id: id(), poId: uuid("po_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(), receivedQty: numeric("received_qty", { precision: 14, scale: 4 }).notNull().default("0"),
  unitCost: paisa("unit_cost"),
});
export const supplierPayments = pgTable("supplier_payments", {
  id: id(), supplierId: uuid("supplier_id").notNull().references(() => suppliers.id), branchId: uuid("branch_id").notNull().references(() => branches.id),
  amount: paisa("amount"), method: text("method").notNull(), reference: text("reference"), paidFromDrawer: boolean("paid_from_drawer").notNull().default(false),
  createdBy: uuid("created_by").references(() => staff.id), createdAt: createdAt(),
});

/* ───────────── Delivery ops ───────────── */
export const deliveries = pgTable("deliveries", {
  id: id(), orderId: uuid("order_id").notNull().unique().references(() => orders.id), branchId: uuid("branch_id").notNull().references(() => branches.id),
  riderId: uuid("rider_id").references(() => staff.id), status: deliveryStatus("status").notNull().default("unassigned"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }), pickedAt: timestamp("picked_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }), cashToCollect: paisa("cash_to_collect"), cashCollected: paisa("cash_collected"),
  settlementId: uuid("settlement_id"), failureReason: text("failure_reason"),
});
export const riderSettlements = pgTable("rider_settlements", {
  id: id(), branchId: uuid("branch_id").notNull().references(() => branches.id), riderId: uuid("rider_id").notNull().references(() => staff.id),
  shiftId: uuid("shift_id").references(() => shifts.id), expectedCash: paisa("expected_cash"), receivedCash: paisa("received_cash"),
  settledBy: uuid("settled_by").notNull().references(() => staff.id), createdAt: createdAt(),
});

/* ───────────── Expenses & accounts ───────────── */
export const expenseCategories = pgTable("expense_categories", {
  id: id(), businessId: uuid("business_id").notNull().references(() => business.id), name: text("name").notNull(), // gas, electricity, rent, salaries, misc
});
export const expenses = pgTable("expenses", {
  id: id(), branchId: uuid("branch_id").notNull().references(() => branches.id), categoryId: uuid("category_id").notNull().references(() => expenseCategories.id),
  expenseDate: date("expense_date").notNull(), amount: paisa("amount"), paymentSource: text("payment_source").notNull().default("cash"),
  shiftId: uuid("shift_id").references(() => shifts.id), description: text("description"), receiptUrl: text("receipt_url"),
  createdBy: uuid("created_by").notNull().references(() => staff.id), approvedBy: uuid("approved_by").references(() => staff.id), createdAt: createdAt(),
});
export const bankDeposits = pgTable("bank_deposits", {
  id: id(), branchId: uuid("branch_id").notNull().references(() => branches.id), depositDate: date("deposit_date").notNull(),
  amount: paisa("amount"), bankName: text("bank_name"), reference: text("reference"), slipUrl: text("slip_url"),
  createdBy: uuid("created_by").notNull().references(() => staff.id),
});

/* ───────────── Audit, sync, notifications ───────────── */
export const auditLogs = pgTable("audit_logs", {
  id: id(), businessId: uuid("business_id").notNull(), branchId: uuid("branch_id"), terminalId: uuid("terminal_id"),
  actorId: uuid("actor_id"), approverId: uuid("approver_id"),                 // approver = manager who PIN-overrode
  action: text("action").notNull(), entity: text("entity").notNull(), entityId: text("entity_id"),
  before: jsonb("before"), after: jsonb("after"), reason: text("reason"), ip: text("ip"), createdAt: createdAt(),
}, (t) => [index("audit_entity").on(t.entity, t.entityId), index("audit_actor").on(t.actorId, t.createdAt)]);
// RLS: INSERT-only for app roles; no UPDATE/DELETE policy → immutable.

export const syncReceipts = pgTable("sync_receipts", {                        // idempotency for offline outbox
  clientOpId: uuid("client_op_id").primaryKey(), terminalId: uuid("terminal_id").notNull(), kind: text("kind").notNull(),
  result: jsonb("result"), receivedAt: createdAt(),
});

export const notificationLog = pgTable("notification_log", {
  id: id(), channel: text("channel").notNull(), recipient: text("recipient").notNull(), template: text("template").notNull(),
  payload: jsonb("payload"), state: syncState("state").notNull().default("pending"), error: text("error"), createdAt: createdAt(),
});

export const scheduledReports = pgTable("scheduled_reports", {
  id: id(), businessId: uuid("business_id").notNull().references(() => business.id), kind: text("kind").notNull().default("daily_summary"),
  channel: text("channel").notNull(), recipient: text("recipient").notNull(), sendAt: time("send_at").notNull().default("23:30"),
  lastSentOn: date("last_sent_on"),
  isActive: boolean("is_active").notNull().default(true),
});

/* RLS notes (rls.sql): every table with branch_id gets
   USING (branch_id = ANY (auth.jwt() -> 'branches') OR auth.jwt() ->> 'role' = 'owner').
   Staff PINs / pin_hash never exposed to the client (column-level revoke). */
