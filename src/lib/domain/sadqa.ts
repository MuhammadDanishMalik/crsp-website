/** Sadqa set aside on a sale line: percentage (basis points) of the line total before tax and discounts. */
export const sadqaFor = (lineTotal: number, percentBps: number) => Math.round((lineTotal * percentBps) / 10_000);
