import "server-only";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { csvEscape } from "@/lib/domain/payroll";
import { formatPKR } from "@/lib/domain/money";
import type { Col, ReportResult, Row } from "./engine";

export const fmtCell = (c: Col, v: string | number | null | undefined): string => {
  if (v === null || v === undefined || v === "") return "";
  if (c.type === "money") return formatPKR(Number(v));
  if (c.type === "pct") return `${v}%`;
  if (c.type === "int") return Math.round(Number(v)).toLocaleString("en-PK");
  if (c.type === "num") return Number(v).toLocaleString("en-PK");
  return String(v);
};
const raw = (c: Col, v: string | number | null | undefined) => (v === null || v === undefined ? "" : c.type === "money" ? Number(v) / 100 : v);

export function toCsv(r: ReportResult): string {
  const lines = [r.columns.map((c) => csvEscape(c.label)).join(",")];
  for (const row of r.rows) lines.push(r.columns.map((c) => csvEscape(raw(c, row[c.key]))).join(","));
  if (r.totals) lines.push(r.columns.map((c) => csvEscape(raw(c, r.totals![c.key]))).join(","));
  return "﻿" + lines.join("\n");
}

export async function toXlsx(title: string, subtitle: string, r: ReportResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title.slice(0, 31));
  ws.addRow([title]).font = { bold: true, size: 14 };
  ws.addRow([subtitle]).font = { color: { argb: "FF666666" } };
  ws.addRow([]);
  const head = ws.addRow(r.columns.map((c) => c.label));
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE30E1F" } }; });
  const add = (row: Row, bold = false) => { const x = ws.addRow(r.columns.map((c) => raw(c, row[c.key]))); if (bold) x.font = { bold: true }; };
  r.rows.forEach((row) => add(row));
  if (r.totals) add(r.totals, true);
  r.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.max(12, c.label.length + 4);
    if (c.type === "money") { col.numFmt = "#,##0.00"; col.alignment = { horizontal: "right" }; }
    if (c.type === "int" || c.type === "num" || c.type === "pct") col.alignment = { horizontal: "right" };
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Landscape A4 table. Built-in Helvetica only, so Urdu text is not supported in PDF exports (use Excel). */
export function toPdf(title: string, subtitle: string, r: ReportResult): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
    const W = doc.page.width - 72, colW = W / r.columns.length;
    const header = () => {
      doc.fillColor("#e30e1f").rect(36, doc.y, W, 20).fill();
      const y = doc.y + 5;
      r.columns.forEach((c, i) => doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold").text(c.label, 36 + i * colW + 3, y, { width: colW - 6, align: c.type === "text" ? "left" : "right", lineBreak: false }));
      doc.y += 24;
    };
    doc.fillColor("#000000").font("Helvetica-Bold").fontSize(16).text(`CRSP — ${title}`);
    doc.font("Helvetica").fontSize(9).fillColor("#666666").text(subtitle).moveDown(0.6);
    header();
    const line = (row: Row, bold: boolean) => {
      if (doc.y > doc.page.height - 60) { doc.addPage(); header(); }
      const y = doc.y;
      r.columns.forEach((c, i) => doc.fillColor("#111111").font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8).text(fmtCell(c, row[c.key]), 36 + i * colW + 3, y, { width: colW - 6, align: c.type === "text" ? "left" : "right", lineBreak: false, ellipsis: true }));
      doc.y = y + 14;
      doc.strokeColor("#e5e5e5").moveTo(36, doc.y - 2).lineTo(36 + W, doc.y - 2).stroke();
    };
    r.rows.forEach((row) => line(row, false));
    if (r.totals) line(r.totals, true);
    if (!r.rows.length) doc.fillColor("#666666").fontSize(10).text("No data for this range.");
    doc.end();
  });
}
