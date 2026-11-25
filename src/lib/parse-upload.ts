import type { TxnInput } from "./ingest.functions";

const ALIASES: Record<keyof TxnInput, string[]> = {
  txn_date: ["date", "transaction date", "txn date", "payment date"],
  amount: ["amount", "value", "total", "amount paid"],
  currency: ["currency", "ccy"],
  direction: ["direction", "type", "in/out"],
  payment_method: ["payment method", "method", "channel"],
  frequency: ["frequency", "recurrence"],
  employee: ["employee", "responsible employee", "captured by", "approver", "user"],
  counterparty: ["supplier", "customer", "supplier/customer", "counterparty", "payee", "vendor", "name"],
  counterparty_type: ["counterparty type", "party type"],
  invoice_ref: ["invoice", "invoice number", "invoice no", "invoice ref", "invoice reference", "inv"],
  reference: ["reference", "ref", "transaction reference"],
  description: ["description", "details", "narrative", "memo"],
};

const key = (h: string) => h.toLowerCase().replace(/[_\-.#]/g, " ").replace(/\s+/g, " ").trim();

function toDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // DD/MM/YYYY (South African convention)
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function mapRows(raw: Record<string, unknown>[], defaultCurrency: string): { rows: TxnInput[]; errors: string[] } {
  const errors: string[] = [];
  const rows: TxnInput[] = [];
  raw.forEach((r, i) => {
    const get = (f: keyof TxnInput) => {
      for (const [h, v] of Object.entries(r)) if (ALIASES[f].includes(key(h))) return v;
      return undefined;
    };
    const date = toDate(get("txn_date"));
    const amtRaw = get("amount");
    const amount = typeof amtRaw === "number" ? amtRaw : Number(String(amtRaw ?? "").replace(/[^0-9.-]/g, ""));
    const cp = String(get("counterparty") ?? "").trim();
    if (!date || !Number.isFinite(amount) || !cp) { errors.push(`Row ${i + 2}: needs a date, amount and supplier/customer`); return; }
    const dir = String(get("direction") ?? "").toLowerCase();
    const s = (f: keyof TxnInput) => { const v = get(f); return v == null || v === "" ? null : String(v).trim(); };
    rows.push({
      txn_date: date, amount: Math.abs(amount), currency: (s("currency") ?? defaultCurrency).toUpperCase(),
      direction: dir.startsWith("in") || dir === "receipt" || dir === "credit" ? "inflow" : "outflow",
      payment_method: s("payment_method"), frequency: s("frequency") ?? "once", employee: s("employee"), counterparty: cp,
      counterparty_type: (s("counterparty_type") ?? "").toLowerCase().startsWith("cust") ? "customer" : "supplier",
      invoice_ref: s("invoice_ref"), reference: s("reference"), description: s("description"),
    });
  });
  return { rows, errors };
}
