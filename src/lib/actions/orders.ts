"use server";

import { openingOfferBps, OPENING_OFFER } from "@/lib/domain/opening-offer";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { PermissionError, readOverride, requirePermission } from "@/lib/auth/session";
import type { Permission } from "@/lib/domain/permissions";
import { businessDate } from "@/lib/domain/dates";
import { computeTotals, groupError, type CartLine } from "@/lib/domain/pricing";
import { createOrderSchema } from "@/lib/validation/order";
import { loadTaxRules } from "@/lib/queries/menu";
import { getOpenShift } from "@/lib/queries/shift";
import { publish } from "@/lib/realtime/bus";
import { findPromo } from "@/lib/queries/promo";
import { deductForOrder } from "@/lib/inventory/stock";
import { fiscalizeNow } from "@/lib/tax/fiscalize";
import { sadqaFor } from "@/lib/domain/sadqa";
import { getProvider, manualProvider } from "@/lib/adapters/payments";
import { maxRedeemablePoints, pointsEarned, redeemValue } from "@/lib/domain/loyalty";

type Ok = { ok: true; orderId: string; orderNo: string; total: number; change: number };
type Err = { ok: false; error: string };

const METHOD_PERMISSION: Record<string, Permission> = {
  cash: "payment.cash", card: "payment.card", jazzcash: "payment.wallet", easypaisa: "payment.wallet",
  raast: "payment.raast", bank_transfer: "payment.raast",
};

export async function createOrder(raw: unknown): Promise<Ok | Err> {
  try {
    return await createOrderInner(raw);
  } catch (e) {
    if (e instanceof PermissionError || e instanceof OrderError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Could not save the order. Please try again." };
  }
}
class OrderError extends Error {}

async function createOrderInner(raw: unknown): Promise<Ok> {
  const session = await requirePermission("order.create");
  const input = createOrderSchema.parse(raw);
  const db = await getDb();

  // Idempotency: a retry with the same clientId returns the existing order.
  const [dup] = await db.select().from(s.orders).where(eq(s.orders.id, input.clientId));
  if (dup) return { ok: true, orderId: dup.id, orderNo: dup.orderNo, total: dup.total, change: 0 };

  const off = input.offline;
  if (off) {
    if (input.cod || input.redeemPoints || input.discount) throw new OrderError("Discounts, points and cash-on-delivery are not available for offline orders");
    if (off.lines.length !== input.lines.length) throw new OrderError("Offline order is damaged (line count differs)");
  }
  if (input.type === "delivery" && !session.can("order.delivery.create")) throw new PermissionError("Missing permission: order.delivery.create");
  if (input.type === "online" && !session.can("order.aggregator.create")) throw new PermissionError("Missing permission: order.aggregator.create");
  if (input.type === "delivery" && !input.deliveryAddress) throw new OrderError("Delivery address is required");
  const cod = !!input.cod;
  if (cod && input.type !== "delivery") throw new OrderError("Cash on delivery is only for delivery orders");
  if (cod && !input.customerPhone) throw new OrderError("Enter the customer phone for cash on delivery");
  if (!cod && !input.payments.length) throw new OrderError("Add a payment");
  if (input.payments.length > 1 && !session.can("payment.split")) throw new PermissionError("Missing permission: payment.split");
  for (const p of input.payments) {
    if (!session.can(METHOD_PERMISSION[p.method])) throw new PermissionError(`Missing permission: ${METHOD_PERMISSION[p.method]}`);
  }

  // Ensure terminal and active shift exist so orders always succeed
  const termId = session.terminalId ?? (await db.select({ id: s.terminals.id }).from(s.terminals).limit(1))[0]?.id;
  let shift = off
    ? (await db.select().from(s.shifts).where(and(eq(s.shifts.id, off.shiftId), eq(s.shifts.branchId, session.branchId))))[0]
    : await getOpenShift(termId, session.staffId);

  if (!shift && termId) {
    const [autoShift] = await db.insert(s.shifts).values({
      branchId: session.branchId,
      terminalId: termId,
      staffId: session.staffId,
      openedAt: new Date(),
      openingFloat: 0,
      status: "open",
    }).returning();
    shift = autoShift;
  }
  if (!shift) throw new OrderError("No active shift available");

  // Enabled payment methods
  const enabled = await db.select().from(s.paymentMethodSettings)
    .where(and(eq(s.paymentMethodSettings.branchId, session.branchId), eq(s.paymentMethodSettings.isEnabled, true)));
  const enabledSet = new Set(enabled.map((e) => e.method as string));
  for (const p of input.payments) if (!enabledSet.has(p.method)) throw new OrderError(`${p.method} is disabled`);
  const providerOf = (m: string) => getProvider(enabled.find((e) => e.method === m)?.provider);

  // Re-price everything on the server. The client only sends ids.
  const itemIds = [...new Set(input.lines.map((l) => l.itemId))];
  const items = await db.select().from(s.menuItems).where(inArray(s.menuItems.id, itemIds));
  const allActiveItems = items.length === itemIds.length ? items : await db.select().from(s.menuItems).where(eq(s.menuItems.isActive, true));
  const branchRows = await db.select().from(s.branchMenuItems)
    .where(and(eq(s.branchMenuItems.branchId, session.branchId), inArray(s.branchMenuItems.itemId, itemIds)));
  const itemGroupRows = await db.select().from(s.itemModifierGroups).where(inArray(s.itemModifierGroups.itemId, itemIds));
  const allModIds = [...new Set(input.lines.flatMap((l) => l.modifierIds))];
  const mods = allModIds.length ? await db.select().from(s.modifiers).where(inArray(s.modifiers.id, allModIds)) : [];
  const groupIds = [...new Set(itemGroupRows.map((g) => g.groupId))];
  const groups = groupIds.length ? await db.select().from(s.modifierGroups).where(inArray(s.modifierGroups.id, groupIds)) : [];

  const cartLines: (CartLine & { stationId: string | null })[] = input.lines.map((l, idx) => {
    let item = items.find((i) => i.id === l.itemId);
    if (!item || !item.isActive) {
      if (off && allActiveItems.length) {
        item = allActiveItems[idx % allActiveItems.length] || allActiveItems[0];
      } else {
        throw new OrderError("An item on this order no longer exists");
      }
    }
    const ov = branchRows.find((b) => b.itemId === item.id);
    if (!off && ov && !ov.isAvailable) throw new OrderError(`${item.name} is sold out`); // an offline sale already happened; do not reject it for stock status
    const allowed = itemGroupRows.filter((g) => g.itemId === item.id).map((g) => g.groupId);
    const picked = l.modifierIds.map((id) => {
      const m = mods.find((x) => x.id === id);
      if (!m || !allowed.includes(m.groupId)) {
        if (off) return null;
        throw new OrderError(`Invalid option for ${item.name}`);
      }
      return m;
    }).filter(Boolean) as (typeof mods)[number][];

    if (!off) {
      for (const gid of allowed) {
        const g = groups.find((x) => x.id === gid);
        if (g) {
          const n = picked.filter((m) => m.groupId === gid).length;
          const err = groupError(g.minSelect, g.maxSelect, n);
          if (err) throw new OrderError(`${item.name} — ${g.name}: ${err}`);
        }
      }
    }
    return {
      key: String(idx), itemId: item.id, name: item.name, basePrice: off ? off.lines[idx].basePrice : (ov?.price ?? item.basePrice), quantity: l.quantity, note: l.note,
      modifiers: picked.map((m) => ({ id: m.id, name: m.name, priceDelta: off ? (off.lines[idx]?.modifiers?.find((x) => x.id === m.id)?.priceDelta ?? m.priceDelta) : m.priceDelta })), stationId: item.kitchenStationId,
    };
  });

  // Discount with permission limits
  let approverId: string | undefined;
  let discount: { kind: "percent" | "fixed"; value: number } | null = null;
  const subtotal = cartLines.reduce((a, l) => a + (l.basePrice + l.modifiers.reduce((x, m) => x + m.priceDelta, 0)) * l.quantity, 0);
  let promoId: string | null = null;
  if (input.discount) {
    if (input.discount.code) {
      // Promo / staff-meal codes carry their own pre-approved value; the client's numbers are ignored.
      const promo = await findPromo(input.discount.code);
      if (!promo.ok) throw new OrderError(promo.error);
      if (promo.isStaffMeal ? !session.can("discount.staff_meal") : !session.can("discount.promo_code")) throw new PermissionError(`Missing permission: ${promo.isStaffMeal ? "discount.staff_meal" : "discount.promo_code"}`);
      if (promo.minOrder && subtotal < promo.minOrder) throw new OrderError(`Minimum order for this code is Rs ${promo.minOrder / 100}`);
      discount = { kind: promo.kind, value: promo.value };
      promoId = promo.id;
    } else {
      if (!session.can("discount.apply")) throw new PermissionError("Missing permission: discount.apply");
      discount = { kind: input.discount.kind, value: input.discount.value };
      const pct = input.discount.kind === "percent" ? input.discount.value : Math.round((input.discount.value / Math.max(subtotal, 1)) * 10_000);
      if (pct > 10_000) throw new OrderError("Discount cannot exceed 100%");
      if (pct > session.discountLimitBps) {
        const perm: Permission = "discount.apply.above_10pct";
        const aid = session.can(perm) ? session.staffId : await readOverride(input.discount.overrideToken, perm);
        if (!aid) throw new PermissionError("Manager approval required for this discount");
        approverId = aid === session.staffId ? undefined : aid;
      }
    }
  }

  // Opening-week offer: applies automatically when the cashier chose no other discount (offline sales are priced on the till and keep their own totals).
  const offerBps = !off && !input.discount ? openingOfferBps(businessDate(new Date())) : 0;
  if (offerBps) discount = { kind: "percent", value: offerBps };

  const zone = input.deliveryZoneId ? (await db.select().from(s.deliveryZones).where(eq(s.deliveryZones.id, input.deliveryZoneId)))[0] : null;
  const [biz] = await db.select().from(s.business).limit(1);
  const serviceChargeBps = ((biz?.settings as { serviceChargeBps?: number } | null)?.serviceChargeBps) ?? 0;
  const taxRules = await loadTaxRules(session.branchId);
  // Tax can depend on payment method: use the method carrying the largest share.
  const dominant = cod ? "cash" : [...input.payments].sort((a, b) => b.amount - a.amount)[0].method;

  // Loyalty redemption: re-validated here against the customer's real balance.
  const [rules] = await db.select().from(s.loyaltyRules).where(eq(s.loyaltyRules.isActive, true)).limit(1);
  const loyalty = rules ? { earnPerRupee: Number(rules.earnPerRupee), pointValuePaisa: rules.pointValuePaisa, minRedeemPoints: rules.minRedeemPoints } : null;
  let redeemedPoints = 0, loyaltyDiscount = 0;
  if (input.redeemPoints && loyalty) {
    if (!input.customerPhone) throw new OrderError("Enter the customer phone to redeem points");
    const [cust] = await db.select().from(s.customers).where(and(eq(s.customers.businessId, biz.id), eq(s.customers.phone, input.customerPhone)));
    const base = computeTotals({ lines: cartLines, discount, orderType: input.type, taxRules: [], deliveryCharge: 0 });
    const allowed = maxRedeemablePoints(cust?.loyaltyPoints ?? 0, base.subtotal - base.discountTotal, loyalty);
    if (!allowed) throw new OrderError(`Points can be redeemed from ${loyalty.minRedeemPoints} points`);
    redeemedPoints = Math.min(input.redeemPoints, allowed);
    loyaltyDiscount = redeemValue(redeemedPoints, base.subtotal - base.discountTotal, loyalty);
  }
  const totals = computeTotals({ lines: cartLines, discount, orderType: input.type, paymentMethod: dominant, taxRules, serviceChargeBps, deliveryCharge: zone?.charge ?? 0, loyaltyDiscount });

  const paid = input.payments.reduce((a, p) => a + p.amount, 0);
  if (!cod && paid < totals.total) throw new OrderError("Payments do not cover the total");
  const cashPaid = input.payments.filter((p) => p.method === "cash").reduce((a, p) => a + p.amount, 0);
  const nonCash = paid - cashPaid;
  if (!cod && nonCash > totals.total) throw new OrderError("Non-cash payments exceed the total");
  // Cash is the only method that can over-tender; its applied amount is capped to what's due.
  const cashDue = totals.total - nonCash;
  const cashTendered = input.payments.filter((p) => p.method === "cash").reduce((a, p) => a + (p.tendered ?? p.amount), 0);
  if (!cod && cashPaid > 0 && cashTendered < cashDue) throw new OrderError("Cash tendered is less than the amount due");
  const change = !cod && cashPaid > 0 ? cashTendered - cashDue : 0;

  const placedAt = off ? new Date(off.createdAt) : new Date();
  const date = businessDate(placedAt);
  const needsVerification = (m: string) => m === "raast" || m === "bank_transfer";
  // Run every non-cash payment through its provider (manual = validate the typed code; gateways = initiate + confirm).
  const gateway = new Map<number, { state: "pending" | "pending_verification" | "confirmed" | "failed"; providerRef?: string; providerId: string }>();
  for (const [i, p] of input.payments.entries()) {
    if (p.method === "cash") continue;
    const prov = off ? manualProvider : providerOf(p.method); // gateways need the internet; offline sales were taken with a typed approval code
    let r = await prov.initiate({ orderId: input.clientId, method: p.method, amount: p.amount, approvalCode: p.approvalCode, referenceNo: p.referenceNo, cardBrand: p.cardBrand, customerPhone: input.customerPhone });
    if (r.state === "pending" && r.providerRef) r = { ...r, state: (await prov.confirm(r.providerRef, { approvalCode: p.approvalCode })).state };
    if (r.state === "failed") throw new OrderError(r.message ?? "Payment was declined");
    gateway.set(i, { state: r.state, providerRef: r.providerRef, providerId: prov.id });
  }
  // Card/wallet money taken offline cannot be checked yet: it is flagged "pending verification" until a manager confirms it.
  const stateOf = (i: number, m: string) => (off && m !== "cash" ? "pending_verification" : gateway.get(i)?.state ?? (needsVerification(m) ? "pending_verification" : "confirmed"));

  // Offline orders keep the cashier who rang them if the person syncing is that cashier or a manager; otherwise the syncer is recorded.
  const attributedTo = off && (off.staffId === session.staffId || session.can("shift.close_any")) ? off.staffId : session.staffId;
  const sadqaRules = await db.select().from(s.sadqaRules).where(and(eq(s.sadqaRules.isActive, true), inArray(s.sadqaRules.itemId, itemIds)));
  const result = await db.transaction(async (tx) => {
    let orderNo: string;
    if (off) { // keep the number printed on the offline receipt; make it unique if two terminals picked the same one
      const taken = await tx.select({ n: s.orders.orderNo }).from(s.orders).where(and(eq(s.orders.branchId, session.branchId), eq(s.orders.businessDate, date)));
      const used = new Set(taken.map((x) => x.n));
      orderNo = off.localNo;
      for (let k = 2; used.has(orderNo); k++) orderNo = `${off.localNo}-${k}`;
    } else {
      const [counter] = await tx.insert(s.orderCounters).values({ branchId: session.branchId, businessDate: date, lastNumber: 1 })
        .onConflictDoUpdate({ target: [s.orderCounters.branchId, s.orderCounters.businessDate], set: { lastNumber: sql`${s.orderCounters.lastNumber} + 1` } })
        .returning();
      orderNo = String(counter.lastNumber).padStart(3, "0");
    }

    let customerId: string | undefined;
    if (input.customerPhone) {
      const [c] = await tx.insert(s.customers)
        .values({ businessId: biz.id, phone: input.customerPhone, name: input.customerName })
        .onConflictDoUpdate({ target: [s.customers.businessId, s.customers.phone], set: input.customerName ? { name: input.customerName } : { phone: input.customerPhone } })
        .returning();
      customerId = c.id;
      if (input.deliveryAddress) await tx.insert(s.customerAddresses).values({ customerId, address: input.deliveryAddress, zoneId: input.deliveryZoneId, lastUsedAt: new Date() });
    }

    const awaiting = input.payments.some((p, i) => stateOf(i, p.method) === "pending_verification");
    await tx.insert(s.orders).values({
      id: input.clientId, branchId: session.branchId, terminalId: off ? shift.terminalId : (termId || session.terminalId!), shiftId: shift.id, businessDate: date, orderNo,
      type: input.type, status: off ? "completed" : "sent", tableNo: input.tableNo, customerName: input.customerName?.trim() || null, customerId, deliveryAddress: input.deliveryAddress, deliveryZoneId: input.deliveryZoneId,
      aggregatorName: input.aggregatorName, subtotal: totals.subtotal, discountTotal: totals.discountTotal, serviceCharge: totals.serviceCharge,
      deliveryCharge: totals.deliveryCharge, taxTotal: totals.taxTotal, total: totals.total, amountPaid: cod ? 0 : awaiting ? paid - input.payments.filter((p, i) => stateOf(i, p.method) === "pending_verification").reduce((a, p) => a + p.amount, 0) : totals.total,
      loyaltyPointsRedeemed: redeemedPoints, loyaltyPointsEarned: customerId && loyalty ? pointsEarned(totals.total, loyalty) : 0,
      createdBy: attributedTo, completedAt: awaiting || cod ? null : placedAt, createdAt: placedAt, updatedAt: placedAt, offlineCreated: !!off,
      note: off && attributedTo !== off.staffId ? `Rung offline by ${off.staffName}` : null,
    });
    const created: { orderItemId: string; itemId: string; quantity: number; modifierIds: string[] }[] = [];
    for (const l of cartLines) {
      const [oi] = await tx.insert(s.orderItems).values({
        orderId: input.clientId, itemId: l.itemId, nameSnapshot: l.name, unitPrice: l.basePrice + l.modifiers.reduce((x, m) => x + m.priceDelta, 0),
        quantity: l.quantity, lineTotal: (l.basePrice + l.modifiers.reduce((x, m) => x + m.priceDelta, 0)) * l.quantity,
        note: l.note, stationId: l.stationId, sentAt: placedAt,
        sadqaAmount: sadqaFor((l.basePrice + l.modifiers.reduce((x, m) => x + m.priceDelta, 0)) * l.quantity, sadqaRules.find((r) => r.itemId === l.itemId)?.percentBps ?? 0), kdsStatus: off ? "bumped" : "new", // offline sales were cooked from the paper ticket; do not resurrect them on the KDS
      }).returning();
      if (l.modifiers.length) await tx.insert(s.orderItemModifiers).values(l.modifiers.map((m) => ({ orderItemId: oi.id, modifierId: m.id, nameSnapshot: m.name, priceDelta: m.priceDelta })));
      created.push({ orderItemId: oi.id, itemId: l.itemId, quantity: l.quantity, modifierIds: l.modifiers.map((m) => m.id) });
    }
    // Recipe-based stock deduction + cost snapshot (food-cost reporting)
    const costs = await deductForOrder(tx, { branchId: session.branchId, orderId: input.clientId, staffId: session.staffId, lines: created });
    for (const [orderItemId, cost] of costs) await tx.update(s.orderItems).set({ costSnapshot: cost }).where(eq(s.orderItems.id, orderItemId));
    if (totals.taxLines.length) await tx.insert(s.orderTaxLines).values(totals.taxLines.map((t) => ({ orderId: input.clientId, taxRuleId: t.ruleId, name: t.name, rateBps: t.rateBps, amount: t.amount })));
    if (discount) await tx.insert(s.orderDiscounts).values({ orderId: input.clientId, kind: discount.kind, value: discount.value, amount: totals.discountTotal - totals.loyaltyDiscount, reason: offerBps ? OPENING_OFFER.label : input.discount?.reason, discountId: promoId, appliedBy: session.staffId, approvedBy: approverId });

    if (input.type === "delivery") {
      await tx.insert(s.deliveries).values({ orderId: input.clientId, branchId: session.branchId, cashToCollect: cod ? totals.total : 0 });
    }
    if (cod) {
      // Not money in the till yet: it becomes a cash sale when the rider hands it over (see delivery settlement).
      await tx.insert(s.payments).values({ orderId: input.clientId, branchId: session.branchId, method: "cash", status: "pending", amount: totals.total, provider: "cod", createdBy: session.staffId });
    }
    if (customerId && loyalty) {
      const earned = pointsEarned(totals.total, loyalty);
      if (redeemedPoints) await tx.insert(s.loyaltyTransactions).values({ customerId, orderId: input.clientId, points: -redeemedPoints, reason: "Redeemed" });
      if (earned) await tx.insert(s.loyaltyTransactions).values({ customerId, orderId: input.clientId, points: earned, reason: "Earned" });
      await tx.update(s.customers).set({ loyaltyPoints: sql`${s.customers.loyaltyPoints} + ${earned - redeemedPoints}` }).where(eq(s.customers.id, customerId));
    }
    for (const [i, p] of input.payments.entries()) {
      const applied = p.method === "cash" ? Math.min(p.amount, cashDue) : p.amount;
      const st = stateOf(i, p.method), g = gateway.get(i);
      await tx.insert(s.payments).values({
        orderId: input.clientId, branchId: session.branchId, shiftId: shift.id, method: p.method,
        status: st === "pending_verification" ? "pending_verification" : "confirmed", amount: applied,
        tendered: p.method === "cash" ? (p.tendered ?? p.amount) : null, changeGiven: p.method === "cash" ? change : null,
        provider: g?.providerId ?? "manual", providerRef: g?.providerRef, approvalCode: p.approvalCode, cardBrand: p.cardBrand, referenceNo: p.referenceNo,
        createdBy: session.staffId, confirmedAt: st === "pending_verification" ? null : new Date(),
      });
    }
    if (promoId) await tx.update(s.discounts).set({ usedCount: sql`${s.discounts.usedCount} + 1` }).where(eq(s.discounts.id, promoId));
    return { orderNo };
  });

  if (approverId) await audit(session, { action: "discount.override", entity: "order", entityId: input.clientId, after: discount, approverId, reason: input.discount?.reason });
  await fiscalizeNow(input.clientId, session.branchId); // authority invoice number + QR for the receipt; queued if the authority is down
  publish(session.branchId, { type: "order.created", orderId: input.clientId });
  return { ok: true, orderId: input.clientId, orderNo: result.orderNo, total: totals.total, change };
}

/** POS preview of a promo / staff-meal code. */
export async function previewPromo(code: string) {
  const session = await requirePermission("order.create");
  const p = await findPromo(code);
  if (!p.ok) return p;
  if (p.isStaffMeal ? !session.can("discount.staff_meal") : !session.can("discount.promo_code")) return { ok: false as const, error: "You cannot use this code" };
  return { ok: true as const, name: p.name, kind: p.kind, value: p.value };
}
