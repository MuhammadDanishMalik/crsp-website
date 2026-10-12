/**
 * CRSP POS — permission catalogue (proposed). Lives at src/lib/domain/permissions.ts.
 * Every key is a toggle on a role (role_permissions table). Custom roles = any subset.
 * `override: true` → action requires manager PIN override when the actor lacks the
 * permission (or exceeds the limit), instead of being hard-denied.
 */
export const PERMISSIONS = {
  // POS / orders
  "order.create": "Create orders",
  "order.hold": "Hold / recall orders",
  "order.merge": "Merge orders",
  "order.transfer_table": "Transfer table",
  "order.edit_sent": "Edit items after sent to kitchen",
  "order.void": "Void order",
  "order.void_item": "Void item",
  "order.view_all": "View other cashiers' orders",
  "order.reprint": "Reprint receipt / KOT",
  "order.price_override": "Override item price",
  "order.delivery.create": "Take delivery orders",
  "order.aggregator.create": "Enter aggregator orders",

  // Discounts
  "discount.apply": "Apply discount (up to limit)",
  "discount.apply.above_10pct": "Apply discount above 10%",
  "discount.apply.any": "Apply any discount",
  "discount.staff_meal": "Apply staff meal",
  "discount.promo_code": "Use promo codes",

  // Payments
  "payment.cash": "Accept cash",
  "payment.card": "Accept card",
  "payment.wallet": "Accept JazzCash / Easypaisa",
  "payment.raast": "Accept Raast / bank transfer",
  "payment.credit_account": "Sell on account",
  "payment.voucher": "Redeem vouchers",
  "payment.split": "Split payment / bill",
  "payment.verify_pending": "Verify pending payments",
  "refund.create": "Create refund",
  "refund.approve": "Approve refund",

  // Drawer & shift
  "drawer.open_no_sale": "Open drawer (no sale)",
  "shift.open": "Open own shift",
  "shift.close": "Close own shift",
  "shift.close_any": "Close any shift",
  "shift.cash_in_out": "Cash in / out",
  "shift.view_x_report": "X-report",
  "shift.view_z_report": "Z-report",

  // Kitchen / delivery
  "kds.view": "Use kitchen display",
  "kds.bump": "Bump tickets",
  "kds.recall": "Recall bumped tickets",
  "delivery.view_assigned": "See assigned deliveries (rider)",
  "delivery.update_status": "Update delivery status",
  "delivery.assign": "Assign riders",
  "delivery.settle": "Settle rider cash",

  // Menu
  "menu.view": "View menu admin",
  "menu.manage": "Edit items, categories, modifiers, deals",
  "menu.price": "Change prices",
  "menu.availability": "Toggle sold-out",
  "menu.import_export": "Excel import / export",

  // Inventory & purchasing
  "inventory.view": "View stock",
  "inventory.adjust": "Stock count / adjustment",
  "inventory.wastage": "Record wastage",
  "inventory.transfer": "Transfer between branches",
  "inventory.recipes": "Manage recipes",
  "purchasing.manage": "Suppliers & purchase orders",
  "purchasing.pay_supplier": "Record supplier payments",

  // Staff
  "staff.view": "View staff",
  "staff.manage": "Add / edit / deactivate staff",
  "staff.set_pin": "Reset staff PIN",
  "staff.salary_view": "View salary data",
  "attendance.clock": "Clock in / out",
  "attendance.manage": "Edit attendance & schedules",
  "payroll.export": "Payroll summary export",

  // Customers
  "customer.view": "View customers",
  "customer.manage": "Edit customers",
  "loyalty.adjust": "Manual points adjustment",

  // Finance
  "expense.create": "Record expenses",
  "expense.approve": "Approve / edit expenses",
  "bank_deposit.manage": "Bank deposits log",
  "report.sales": "Sales reports",
  "report.financial": "P&L, tax, financial reports",
  "report.staff": "Cashier / staff reports",
  "report.inventory": "Inventory reports",
  "report.export": "Export PDF / Excel",
  "dashboard.view": "Live dashboard",

  // Settings & security
  "settings.business": "Business info & tax numbers",
  "settings.payment_methods": "Enable / disable payment methods",
  "settings.tax": "Tax rules",
  "settings.printers": "Printers & routing",
  "settings.receipt": "Receipt template",
  "settings.loyalty": "Loyalty rules",
  "settings.delivery_zones": "Delivery zones",
  "settings.terminals": "Register terminals",
  "settings.tax_authority": "FBR / PRA integration",
  "role.manage": "Manage roles & permissions",
  "branch.manage": "Manage branches",
  "branch.switch": "Access other branches",
  "audit.view": "View audit log",
  "pos.override_pin": "Can authorize PIN overrides for others",
} as const;

export type Permission = keyof typeof PERMISSIONS;

/** Actions that pop the manager-PIN override on the cashier screen. */
export const OVERRIDABLE: Permission[] = [
  "order.void", "order.void_item", "order.edit_sent", "order.price_override",
  "discount.apply.above_10pct", "discount.apply.any", "discount.staff_meal",
  "refund.create", "drawer.open_no_sale", "shift.cash_in_out",
];

/** Default role presets (seed). Owner = all. Owners can clone/edit via role.manage. */
export const ROLE_DEFAULTS: Record<string, Permission[] | "ALL"> = {
  owner: "ALL",
  branch_manager: [
    "order.create","order.hold","order.merge","order.transfer_table","order.edit_sent","order.void","order.void_item",
    "order.view_all","order.reprint","order.price_override","order.delivery.create","order.aggregator.create",
    "discount.apply","discount.apply.above_10pct","discount.apply.any","discount.staff_meal","discount.promo_code",
    "payment.cash","payment.card","payment.wallet","payment.raast","payment.credit_account","payment.voucher",
    "payment.split","payment.verify_pending","refund.create","refund.approve","drawer.open_no_sale",
    "shift.open","shift.close","shift.close_any","shift.cash_in_out","shift.view_x_report","shift.view_z_report",
    "kds.view","kds.bump","kds.recall","delivery.assign","delivery.settle","delivery.update_status",
    "menu.view","menu.availability","inventory.view","inventory.adjust","inventory.wastage","inventory.transfer",
    "purchasing.manage","staff.view","staff.manage","attendance.manage","attendance.clock","customer.view",
    "customer.manage","expense.create","expense.approve","report.sales","report.staff","report.inventory",
    "report.export","dashboard.view","pos.override_pin",
  ],
  cashier: [
    "order.create","order.hold","order.reprint","order.delivery.create","order.aggregator.create",
    "discount.apply","discount.promo_code","payment.cash","payment.card","payment.wallet","payment.raast",
    "payment.voucher","payment.split","shift.open","shift.close","shift.view_x_report","attendance.clock",
    "customer.view","customer.manage","menu.view",
  ],
  order_taker: ["order.create","order.hold","order.delivery.create","customer.view","customer.manage","attendance.clock","menu.view"],
  kitchen: ["kds.view","kds.bump","kds.recall","attendance.clock"],
  rider: ["delivery.view_assigned","delivery.update_status","attendance.clock"],
  accountant: [
    "report.sales","report.financial","report.staff","report.inventory","report.export","dashboard.view",
    "expense.create","expense.approve","bank_deposit.manage","purchasing.pay_supplier","staff.salary_view",
    "payroll.export","order.view_all","audit.view","inventory.view","staff.view","customer.view","menu.view",
  ],
};
