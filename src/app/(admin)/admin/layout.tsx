import { requireSession } from "@/lib/auth/session";
import { accessibleBranches } from "@/lib/queries/branches";
import { Logo } from "@/components/brand/logo";
import { NavLink } from "./nav-link";
import { BranchSwitcher } from "./branch-switcher";
import { ThemeToggle } from "./theme-toggle";
import {
  LayoutDashboard,
  Receipt,
  UtensilsCrossed,
  BookOpen,
  Boxes,
  Truck,
  Users,
  Clock,
  Banknote,
  HeartHandshake,
  CreditCard,
  Landmark,
  ShieldCheck,
  TrendingUp,
  Printer,
  KeyRound,
  Store,
  Settings,
  ShoppingBag,
  LogOut,
} from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession({ kind: "admin" });
  const branches = await accessibleBranches(session);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-border bg-surface">
        {/* Brand & Branch Switcher */}
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Logo height={32} />
            <span className="rounded bg-brand/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand">
              Admin
            </span>
          </div>
          <BranchSwitcher
            branches={branches.map((b) => ({ id: b.id, name: b.name }))}
            current={session.branchId}
          />
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3 scroll-thin">
          <NavLink href="/admin" label="Dashboard" icon={<LayoutDashboard size={18} />} />
          <NavLink href="/admin/orders" label="Orders Record" icon={<Receipt size={18} />} />
          <NavLink href="/admin/menu" label="Menu" icon={<UtensilsCrossed size={18} />} />
          <NavLink href="/admin/recipes" label="Recipes" icon={<BookOpen size={18} />} />
          <NavLink href="/admin/inventory" label="Inventory" icon={<Boxes size={18} />} />
          <NavLink href="/admin/purchasing" label="Purchasing" icon={<Truck size={18} />} />
          <NavLink href="/admin/staff" label="Staff" icon={<Users size={18} />} />
          <NavLink href="/admin/attendance" label="Attendance" icon={<Clock size={18} />} />
          <NavLink href="/admin/payroll" label="Payroll" icon={<Banknote size={18} />} />
          <NavLink href="/admin/customers" label="Customers" icon={<HeartHandshake size={18} />} />
          <NavLink href="/admin/expenses" label="Expenses" icon={<CreditCard size={18} />} />
          <NavLink href="/admin/accounts" label="Accounts" icon={<Landmark size={18} />} />
          <NavLink href="/admin/tax-invoices" label="Tax Invoices" icon={<ShieldCheck size={18} />} />
          <NavLink href="/admin/reports" label="Reports" icon={<TrendingUp size={18} />} />
          <NavLink href="/admin/printers" label="Printers & Kitchen" icon={<Printer size={18} />} />
          <NavLink href="/admin/roles" label="Roles" icon={<KeyRound size={18} />} />
          <NavLink href="/admin/branches" label="Branches" icon={<Store size={18} />} />
          <NavLink href="/admin/settings" label="Settings" icon={<Settings size={18} />} />
        </nav>

        {/* Bottom controls */}
        <div className="border-t border-border p-3 space-y-2">
          <ThemeToggle />
          <a
            href="/order"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-xs font-bold text-brand-fg shadow hover:opacity-90"
          >
            <ShoppingBag size={16} /> Open POS Cashier
          </a>
          <div className="flex items-center justify-between px-2 pt-1 text-xs text-muted">
            <span className="truncate">{session.name}</span>
            <a href="/login" className="hover:text-danger" title="Sign out">
              <LogOut size={14} />
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 scroll-thin">
        {children}
      </main>
    </div>
  );
}
