export type PayrollInput = {
  salaryType: "monthly" | "hourly"; salaryAmount: number; // monthly: per month; hourly: per hour (paisa)
  daysWorked: number; minutesWorked: number; lateCount: number; absentCount: number;
  advances: number; deductions: number; bonuses?: number;
};
export type PayrollRow = PayrollInput & { gross: number; net: number };

export function computePayroll(p: PayrollInput): PayrollRow {
  const gross = p.salaryType === "monthly" ? p.salaryAmount : Math.round((p.minutesWorked / 60) * p.salaryAmount);
  const net = gross + (p.bonuses ?? 0) - p.advances - p.deductions;
  return { ...p, gross, net };
}

/** Late if clocked in more than `graceMin` after the scheduled start. HH:MM[:SS] strings in local business time. */
export function lateMinutes(scheduledStart: string, clockInLocal: string, graceMin = 10): number {
  const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const diff = m(clockInLocal) - m(scheduledStart);
  return diff > graceMin ? diff : 0;
}

export const csvEscape = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
