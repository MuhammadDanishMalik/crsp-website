"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setDiscountLimit, setRolePermission } from "@/lib/actions/settings";

type Role = { id: string; key: string; name: string; discountLimit: number; granted: string[] };

export function RoleMatrix({ roles, groups }: { roles: Role[]; groups: Record<string, [string, string][]> }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [error, setError] = useState("");
  const toggle = (r: Role, p: string, on: boolean) =>
    start(async () => { const res = await setRolePermission(r.id, p, on); setError(res.ok ? "" : res.error); router.refresh(); });
  return (
    <div>
      <h1 className="mb-1 text-3xl font-bold">Roles & permissions</h1>
      <p className="mb-4 text-muted">Every toggle takes effect on the user&apos;s next action. Owner always has everything.</p>
      {error && <p className="mb-3 rounded-xl bg-danger/15 p-3 text-danger">{error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-2">
            <tr><th className="p-3 text-left">Permission</th>{roles.map((r) => <th key={r.id} className="p-3 text-center">{r.name}</th>)}</tr>
            <tr className="border-t border-border"><td className="p-3 text-muted">Discount limit without approval (%)</td>
              {roles.map((r) => <td key={r.id} className="p-2 text-center"><input defaultValue={r.discountLimit} disabled={r.key === "owner"} inputMode="decimal" className="h-10 w-20 rounded-lg bg-background text-center"
                onBlur={(e) => start(async () => { await setDiscountLimit(r.id, Number(e.target.value)); router.refresh(); })} /></td>)}</tr>
          </thead>
          <tbody>
            {Object.entries(groups).map(([g, list]) => (
              <>
                <tr key={g} className="bg-surface-2"><td colSpan={roles.length + 1} className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted">{g}</td></tr>
                {list.map(([k, label]) => (
                  <tr key={k} className="border-t border-border">
                    <td className="p-3"><span className="font-medium">{label}</span> <span className="ml-1 font-mono text-xs text-muted">{k}</span></td>
                    {roles.map((r) => {
                      const on = r.key === "owner" || r.granted.includes(k);
                      return <td key={r.id} className="p-2 text-center"><input type="checkbox" className="h-6 w-6 accent-[var(--brand)]" checked={on} disabled={r.key === "owner"} onChange={(e) => toggle(r, k, e.target.checked)} /></td>;
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
