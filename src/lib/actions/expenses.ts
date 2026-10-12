"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/auth/audit";
import { requirePermission } from "@/lib/auth/session";
import { guard, UserError, type R } from "./_guard";

const reval = () => { revalidatePath("/admin/expenses"); revalidatePath("/admin/accounts"); };

export async function saveExpense(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("expense.create");
    const v = z.object({
      id: z.string().uuid().optional(), categoryId: z.string().uuid("Choose a category"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
      amountRupees: z.number().positive("Enter an amount").max(100_000_000), source: z.enum(["cash", "bank", "card", "wallet"]), description: z.string().trim().max(200).optional(), receiptUrl: z.string().max(200).optional(),
    }).parse(raw);
    const db = await getDb();
    const values = { categoryId: v.categoryId, expenseDate: v.date, amount: Math.round(v.amountRupees * 100), paymentSource: v.source, description: v.description || null, receiptUrl: v.receiptUrl || null };
    if (v.id) {
      await requirePermission("expense.approve"); // editing an existing expense is a manager/accountant action
      const [before] = await db.select().from(s.expenses).where(eq(s.expenses.id, v.id));
      await db.update(s.expenses).set(values).where(eq(s.expenses.id, v.id));
      await audit(session, { action: "expense.update", entity: "expense", entityId: v.id, before, after: values });
    } else {
      const [e] = await db.insert(s.expenses).values({ ...values, branchId: session.branchId, createdBy: session.staffId, approvedBy: session.can("expense.approve") ? session.staffId : null }).returning();
      await audit(session, { action: "expense.create", entity: "expense", entityId: e.id, after: values });
    }
    reval();
    return { ok: true };
  });
}

export async function deleteExpense(id: string): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("expense.approve");
    const db = await getDb();
    const [before] = await db.select().from(s.expenses).where(eq(s.expenses.id, id));
    if (!before) throw new UserError("Expense not found");
    await db.delete(s.expenses).where(eq(s.expenses.id, id));
    await audit(session, { action: "expense.delete", entity: "expense", entityId: id, before });
    reval();
    return { ok: true };
  });
}

export async function saveExpenseCategory(name: string): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("expense.approve");
    const n = z.string().trim().min(1, "Name is required").max(40).parse(name);
    const db = await getDb();
    const [b] = await db.select().from(s.business).limit(1);
    await db.insert(s.expenseCategories).values({ businessId: b.id, name: n });
    await audit(session, { action: "expense.category.create", entity: "expense_category", after: { name: n } });
    reval();
    return { ok: true };
  });
}

export async function saveBankDeposit(raw: unknown): Promise<R> {
  return guard(async () => {
    const session = await requirePermission("bank_deposit.manage");
    const v = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), amountRupees: z.number().positive("Enter an amount"), bankName: z.string().trim().max(60).optional(), reference: z.string().trim().max(60).optional(), slipUrl: z.string().max(200).optional() }).parse(raw);
    const db = await getDb();
    const [d] = await db.insert(s.bankDeposits).values({ branchId: session.branchId, depositDate: v.date, amount: Math.round(v.amountRupees * 100), bankName: v.bankName, reference: v.reference, slipUrl: v.slipUrl, createdBy: session.staffId }).returning();
    await audit(session, { action: "bank_deposit.create", entity: "bank_deposit", entityId: d.id, after: v });
    reval();
    return { ok: true };
  });
}
