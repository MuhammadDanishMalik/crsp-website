/** Business date (YYYY-MM-DD) in Asia/Karachi. */
export function businessDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
