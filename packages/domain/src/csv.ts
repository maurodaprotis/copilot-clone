import type { CsvColumnMapping } from "./types.js";
import { importFingerprint } from "./fingerprint.js";

export interface ParsedCsvTable { headers: string[]; rows: string[][]; }
export interface MappedCsvRow {
  row_index: number; date: string; description: string; amount: number;
  currency: string | null; raw: Record<string, string>;
}

export function splitCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ""; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false; }
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur); return out.map((c) => c.trim());
}

export function parseCsvText(text: string): ParsedCsvTable {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]!).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    while (cells.length < headers.length) cells.push("");
    return cells.slice(0, headers.length);
  });
  return { headers, rows };
}

const DATE_ALIASES = ["date", "posted", "posted_at", "transaction date", "fecha"];
const DESC_ALIASES = ["description", "desc", "name", "memo", "payee", "detalle", "concepto"];
const AMOUNT_ALIASES = ["amount", "importe", "monto", "value"];
const DEBIT_ALIASES = ["debit", "withdrawal", "debe"];
const CREDIT_ALIASES = ["credit", "deposit", "haber"];
const CURRENCY_ALIASES = ["currency", "ccy", "moneda"];

function normHeader(h: string): string { return h.trim().toLowerCase().replace(/[_-]+/g, " "); }
function findHeader(headers: string[], aliases: string[]): string | null {
  const normalized = headers.map((h) => ({ raw: h, n: normHeader(h) }));
  for (const alias of aliases) { const hit = normalized.find((h) => h.n === alias); if (hit) return hit.raw; }
  for (const alias of aliases) { const hit = normalized.find((h) => h.n.includes(alias)); if (hit) return hit.raw; }
  return null;
}

export function suggestCsvMapping(headers: string[]): CsvColumnMapping {
  const date = findHeader(headers, DATE_ALIASES) ?? headers[0] ?? "date";
  const description = findHeader(headers, DESC_ALIASES) ?? headers[1] ?? "description";
  const amount = findHeader(headers, AMOUNT_ALIASES);
  const debit = findHeader(headers, DEBIT_ALIASES);
  const credit = findHeader(headers, CREDIT_ALIASES);
  const currency = findHeader(headers, CURRENCY_ALIASES) ?? undefined;
  if (amount) return { date, description, amount, currency };
  if (debit || credit) return { date, description, debit: debit ?? undefined, credit: credit ?? undefined, currency };
  return { date, description, amount: headers[2] ?? "amount", currency };
}

function cell(headers: string[], row: string[], col: string | undefined): string {
  if (!col) return ""; const idx = headers.findIndex((h) => h === col); if (idx < 0) return ""; return (row[idx] ?? "").trim();
}

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  let s = raw.replace(/\s/g, "").replace(/\$/g, "");
  if (/\d\.\d{3},\d/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\d,\d{3}\.\d/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const n = Number(s); return Number.isFinite(n) ? n : null;
}

function normalizeDate(raw: string): string | null {
  const t = raw.trim(); if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const mdy = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (mdy) {
    const a = Number(mdy[1]); const b = Number(mdy[2]); const y = mdy[3]!;
    let month: number; let day: number;
    if (a > 12) { day = a; month = b; } else if (b > 12) { month = a; day = b; } else { month = a; day = b; }
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const d = new Date(t); if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10); return null;
}

export function applyCsvMapping(table: ParsedCsvTable, mapping: CsvColumnMapping): MappedCsvRow[] {
  const out: MappedCsvRow[] = [];
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i]!; const raw: Record<string, string> = {};
    for (let j = 0; j < table.headers.length; j++) raw[table.headers[j]!] = row[j] ?? "";
    const dateRaw = cell(table.headers, row, mapping.date);
    const desc = cell(table.headers, row, mapping.description);
    const ccyRaw = mapping.currency ? cell(table.headers, row, mapping.currency) : "";
    let signed: number | null = null;
    if (mapping.amount) signed = parseAmount(cell(table.headers, row, mapping.amount));
    else {
      const debit = parseAmount(cell(table.headers, row, mapping.debit)) ?? 0;
      const credit = parseAmount(cell(table.headers, row, mapping.credit)) ?? 0;
      if (debit === 0 && credit === 0) signed = null; else signed = credit - debit;
    }
    const date = normalizeDate(dateRaw);
    if (!date || signed === null || !Number.isFinite(signed)) continue;
    out.push({ row_index: i, date, description: desc, amount: signed, currency: ccyRaw ? ccyRaw.toUpperCase() : null, raw });
  }
  return out;
}

export function signedAmountToTxn(signed: number): { amount: number; type: "regular" | "income"; is_refund: boolean } {
  if (signed < 0) return { amount: Math.abs(signed), type: "regular", is_refund: false };
  if (signed > 0) return { amount: signed, type: "income", is_refund: false };
  return { amount: 0, type: "regular", is_refund: false };
}

export function fingerprintMappedRow(input: { account_id: string; date: string; amount: number; description: string; currency: string; }): string {
  return importFingerprint(input);
}
