import type { PrinterTarget } from "@/lib/adapters/printers/bridge-client";

/** Everything the POS needs to ring up, print and queue an order with no internet. Built on the server, kept in the page. */
export type OfflineConfig = {
  prefix: string; shiftId: string; staffId: string; staffName: string; terminalName: string;
  info: { businessName: string; ntn: string | null; header: string; footer: string; footerUr: string; branchName: string; address: string | null; phone: string | null };
  receiptPrinter: { target: PrinterTarget; paperMm: 58 | 80; openDrawer: boolean } | null;
  kotPrinters: { id: string; name: string; target: PrinterTarget; paperMm: 58 | 80 }[];
  stationPrinter: Record<string, string | null>; // kitchen station → printer
  stationName: Record<string, string>;
};

export type OutboxRow = {
  clientId: string; localNo: string; createdAt: string; status: "queued" | "failed"; error: string; attempts: number;
  payload: unknown; total: number; summary: string; // summary: "2× Zinger Burger, 1× Fries" for the attention list
};
