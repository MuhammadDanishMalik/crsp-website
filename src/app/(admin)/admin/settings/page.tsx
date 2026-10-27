import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { providersFor, type PayMethod } from "@/lib/adapters/payments";
import { SettingsPanel } from "./settings-panel";

export default async function SettingsPage() {
  const session = await requireSession({ kind: "admin" });
  const db = await getDb();
  const [methods, taxes, terminals, [loyalty], reports, [biz]] = await Promise.all([
    db.select().from(s.paymentMethodSettings).where(eq(s.paymentMethodSettings.branchId, session.branchId)),
    db.select().from(s.taxRules),
    db.select().from(s.terminals).where(eq(s.terminals.branchId, session.branchId)),
    db.select().from(s.loyaltyRules).limit(1),
    db.select().from(s.scheduledReports),
    db.select().from(s.business).limit(1),
  ]);
  const bs = (biz?.settings ?? {}) as { serviceChargeBps?: number; lockMinutes?: number; receiptHeader?: string; receiptFooter?: string; receiptFooterUr?: string };
  return (
    <SettingsPanel
      can={{ payments: session.can("settings.payment_methods"), tax: session.can("settings.tax"), terminals: session.can("settings.terminals"), loyalty: session.can("settings.loyalty"), business: session.can("settings.business") }}
      receipt={session.can("settings.receipt") ? { header: bs.receiptHeader ?? "", footer: bs.receiptFooter ?? "", footerUr: bs.receiptFooterUr ?? "" } : null}
      website={session.can("settings.business") ? { open: (bs as { websiteOrdersOpen?: boolean }).websiteOrdersOpen === true, message: (bs as { websiteClosedMessage?: string }).websiteClosedMessage ?? "" } : null}
      business={session.can("settings.business") ? { name: biz?.name ?? "", ntn: biz?.ntn ?? "", strn: biz?.strn ?? "", serviceChargePercent: (bs.serviceChargeBps ?? 0) / 100, lockMinutes: bs.lockMinutes ?? 5 } : null}
      loyalty={loyalty ? { earnPer100: Number(loyalty.earnPerRupee) * 100, pointValueRupees: loyalty.pointValuePaisa / 100, minRedeem: loyalty.minRedeemPoints, active: loyalty.isActive } : { earnPer100: 1, pointValueRupees: 1, minRedeem: 100, active: false }}
      reports={reports.map((r) => ({ id: r.id, channel: r.channel, recipient: r.recipient, sendAt: String(r.sendAt).slice(0, 5), lastSentOn: r.lastSentOn ?? "" }))}
      methods={methods.map((m) => ({ method: m.method, enabled: m.isEnabled, provider: m.provider, options: providersFor(m.method as PayMethod).map((p) => ({ id: p.id, label: p.label })) }))}
      taxes={taxes.map((t) => ({ id: t.id, name: t.name, ratePercent: t.rateBps / 100, orderTypes: t.appliesToOrderTypes as string[], paymentMethods: t.appliesToPaymentMethods as string[], isInclusive: t.isInclusive, isActive: t.isActive }))}
      terminals={terminals.map((t) => ({ id: t.id, name: t.name, lastSeen: t.lastSeenAt?.toISOString() ?? null }))}
    />
  );
}
