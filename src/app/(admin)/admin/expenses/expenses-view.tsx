"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Paperclip, Plus } from "lucide-react";
import { deleteExpense, saveExpense, saveExpenseCategory } from "@/lib/actions/expenses";
import { uploadImage } from "@/lib/actions/uploads";
import { formatPKR } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

type Exp = { id: string; date: string; categoryId: string; amount: number; source: string; description: string; receiptUrl: string };
const sel = "min-h-12 w-full rounded-xl border border-border bg-surface-2 px-3";

export function ExpensesView({ month, today, can, categories, expenses }: { month: string; today: string; can: { approve: boolean }; categories: { id: string; name: string }[]; expenses: Exp[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Partial<Exp> | null>(null);
  const [msg, setMsg] = useState("");
  const [, start] = useTransition();
  const total = expenses.reduce((a, e) => a + e.amount, 0);
  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center gap-3"><h1 className="text-3xl font-bold">Expenses</h1>
        <input type="month" value={month} onChange={(e) => router.push(`/admin/expenses?month=${e.target.value}`)} className="h-12 rounded-xl border border-border bg-surface px-3" />
        <span className="text-muted">Total <b className="text-foreground">{formatPKR(total)}</b></span>
        {can.approve && <Button variant="secondary" className="ml-auto" onClick={() => { const n = prompt("New expense category"); if (n) start(async () => { const r = await saveExpenseCategory(n); setMsg(r.ok ? "" : r.error); router.refresh(); }); }}>+ Category</Button>}
        <Button className={can.approve ? "" : "ml-auto"} onClick={() => setEdit({ date: today, source: "cash", categoryId: categories[0]?.id })}><Plus size={18} />Add expense</Button></div>
      {msg && <p className="mb-3 text-danger">{msg}</p>}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {expenses.map((e) => (
          <div key={e.id} className="flex min-h-14 items-center gap-3 border-b border-border px-4 last:border-0">
            <span className="w-24 text-sm text-muted">{e.date}</span><span className="w-36 font-medium">{categories.find((c) => c.id === e.categoryId)?.name}</span><span className="flex-1 truncate text-sm text-muted">{e.description}</span>
            {e.receiptUrl && <a href={e.receiptUrl} target="_blank" aria-label="Receipt photo" className="text-muted"><Paperclip size={18} /></a>}
            <span className="w-20 rounded bg-surface-2 px-2 py-0.5 text-center text-xs uppercase">{e.source}</span><span className="w-28 text-right font-bold tabular-nums">{formatPKR(e.amount)}</span>
            {can.approve && <><Button variant="ghost" className="min-h-10" onClick={() => setEdit(e)}>Edit</Button><Button variant="ghost" className="min-h-10 text-danger" onClick={() => confirm("Delete this expense?") && start(async () => { await deleteExpense(e.id); router.refresh(); })}>Delete</Button></>}
          </div>
        ))}
        {!expenses.length && <p className="p-8 text-center text-muted">No expenses this month</p>}
      </div>
      {edit && <ExpenseForm initial={edit} categories={categories} onClose={() => setEdit(null)} onDone={() => { setEdit(null); router.refresh(); }} />}
    </div>
  );
}

function ExpenseForm({ initial, categories, onClose, onDone }: { initial: Partial<Exp>; categories: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ categoryId: initial.categoryId ?? "", date: initial.date ?? "", amount: initial.amount ? String(initial.amount / 100) : "", source: initial.source ?? "cash", description: initial.description ?? "", receiptUrl: initial.receiptUrl ?? "" });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const upload = async (f?: File) => { if (!f) return; const fd = new FormData(); fd.set("file", f); const r = await uploadImage(fd); if (r.ok) setV((x) => ({ ...x, receiptUrl: r.url })); else setError(r.error); };
  return (
    <Modal title={initial.id ? "Edit expense" : "New expense"} onClose={onClose} width="max-w-md">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3"><div><Label>Category</Label><select className={sel} value={v.categoryId} onChange={(e) => setV({ ...v, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><Label>Date</Label><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></div></div>
        <div className="grid grid-cols-2 gap-3"><div><Label>Amount (Rs)</Label><Input aria-label="Amount (Rs)" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} autoFocus /></div>
          <div><Label>Paid from</Label><select className={sel} value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })}><option value="cash">Cash</option><option value="bank">Bank</option><option value="card">Card</option><option value="wallet">Wallet</option></select></div></div>
        <Input placeholder="Description" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface-2 px-4 py-3 text-sm font-semibold"><Paperclip size={18} />{v.receiptUrl ? "Receipt attached — replace" : "Attach receipt photo"}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => upload(e.target.files?.[0])} /></label>
        {error && <p className="text-danger">{error}</p>}
        <Button size="lg" className="w-full" disabled={pending} onClick={() => start(async () => { const r = await saveExpense({ id: initial.id, categoryId: v.categoryId, date: v.date, amountRupees: Number(v.amount), source: v.source, description: v.description || undefined, receiptUrl: v.receiptUrl || undefined }); if (r.ok) onDone(); else setError(r.error); })}>Save</Button>
      </div>
    </Modal>
  );
}
