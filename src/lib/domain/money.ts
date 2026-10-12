/** All money is integer paisa. Rates are basis points (1500 = 15%). */
export const toPaisa = (rupees: number) => Math.round(rupees * 100);

export function formatPKR(paisa: number, opts: { symbol?: boolean } = {}): string {
  const sign = paisa < 0 ? "-" : "";
  const rupees = Math.abs(paisa) / 100;
  const body = Number.isInteger(rupees)
    ? rupees.toLocaleString("en-PK")
    : rupees.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${opts.symbol === false ? "" : "Rs "}${body}`;
}

/** Percentage of an amount, rounded half-up to the paisa. */
export const bps = (amount: number, rateBps: number) => Math.round((amount * rateBps) / 10_000);
