import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { businessDate } from "@/lib/domain/dates";
import { ExpensesView } from "./expenses-view";

export default async function ExpensesPage({ searchParams }: PageProps<"/admin/expenses">) {
  const session = await requireSession({ permission: "expense.create", kind: "admin" });
  const sp = await searchParams;
  const today = businessDate();
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const db = await getDb();
  const [cats, rows] = await Promise.all([
    db.select().from(s.expenseCategories).orderBy(asc(s.expenseCategories.name)),
    db.select().from(s.expenses).where(and(eq(s.expenses.branchId, session.branchId), gte(s.expenses.expenseDate, `${month}-01`), lte(s.expenses.expenseDate, `${month}-31`))).orderBy(desc(s.expenses.expenseDate), desc(s.expenses.createdAt)),
  ]);
  return (
    <ExpensesView month={month} today={today} can={{ approve: session.can("expense.approve") }} categories={cats.map((c) => ({ id: c.id, name: c.name }))}
      expenses={rows.map((e) => ({ id: e.id, date: e.expenseDate, categoryId: e.categoryId, amount: e.amount, source: e.paymentSource, description: e.description ?? "", receiptUrl: e.receiptUrl ?? "" }))} />
  );
}
