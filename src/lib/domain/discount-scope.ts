import type { CartLine } from "./pricing";

/** Categories that sell other companies' products (cold drinks, water): no discount of any kind applies to them. */
const NO_DISCOUNT_CATEGORIES = ["beverages"];

export const isNoDiscountCategory = (name: string | null | undefined) => !!name && NO_DISCOUNT_CATEGORIES.includes(name.trim().toLowerCase());

/** Marks the lines whose category is excluded from discounts. */
export function markNoDiscount<T extends CartLine>(lines: T[], categoryNameOf: (itemId: string) => string | null | undefined): T[] {
  return lines.map((l) => (isNoDiscountCategory(categoryNameOf(l.itemId)) ? { ...l, noDiscount: true } : l));
}
