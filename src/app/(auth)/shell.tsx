import { Logo } from "@/components/brand/logo";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="pos-root flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 shadow-xl">
        <div className="mb-6 text-center">
          <Logo height={72} className="mx-auto mb-3" priority />
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
