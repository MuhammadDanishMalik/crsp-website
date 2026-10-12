import { z } from "zod";

export const orderTypeSchema = z.enum(["dine_in", "takeaway", "delivery", "drive_thru", "online"]);

export const cartLineSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  modifierIds: z.array(z.string().uuid()).max(30),
  note: z.string().max(200).optional(),
});

export const paymentInputSchema = z.object({
  method: z.enum(["cash", "card", "jazzcash", "easypaisa", "raast", "bank_transfer"]),
  amount: z.number().int().min(1), // paisa applied to the bill
  tendered: z.number().int().min(0).optional(), // cash handed over
  approvalCode: z.string().max(40).optional(),
  cardBrand: z.enum(["visa", "mastercard", "unionpay", "paypak"]).optional(),
  referenceNo: z.string().max(60).optional(),
});

export const createOrderSchema = z.object({
  clientId: z.string().uuid(), // idempotency key, also becomes the order id
  type: orderTypeSchema,
  tableNo: z.string().max(10).optional(),
  customerPhone: z.string().max(20).optional(),
  customerName: z.string().max(80).optional(),
  deliveryAddress: z.string().max(300).optional(),
  deliveryZoneId: z.string().uuid().optional(),
  aggregatorName: z.string().max(40).optional(),
  lines: z.array(cartLineSchema).min(1),
  discount: z.object({ kind: z.enum(["percent", "fixed"]), value: z.number().int().min(1), reason: z.string().max(100).optional(), code: z.string().max(30).optional(), overrideToken: z.string().optional() }).nullable(),
  payments: z.array(paymentInputSchema),
  /** Present only when the order was rung while offline and is being synced later. */
  offline: z.object({
    localNo: z.string().min(1).max(20), createdAt: z.string().datetime(), shiftId: z.string().uuid(), staffId: z.string().uuid(), staffName: z.string().max(80),
    lines: z.array(z.object({ itemId: z.string().uuid(), basePrice: z.number().int().min(0), modifiers: z.array(z.object({ id: z.string().uuid(), priceDelta: z.number().int() })) })),
  }).optional(),
  cod: z.boolean().optional(), // cash on delivery: no payment now, the rider collects it
  redeemPoints: z.number().int().min(0).max(1_000_000).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
