import { z } from "zod";

const money = z.coerce.number().finite().nonnegative().max(1e12);
const optionalMoney = z.preprocess(v => v === "" || v === undefined ? null : v, money.nullable());
const text = z.string().trim().max(300).default("");
const approval = z.enum(["unknown", "yes", "no"]).default("unknown");
export const payloadSchemas = {
  expense: z.object({ category: text, employee: text, amount: money, claim_ref: text, reason: text }),
  budget: z.object({ category: z.string().trim().min(1).max(120), amount: money }),
  cash: z.object({ cash_sales: money, electronic_sales: money, cash_received: money, electronic_received: money, cash_deposited: money, electronic_deposited: money, refunds: money, reason: text }),
  supplier: z.object({ registration: text, bank_account: text, bank_approved: approval, reason: text }),
  inventory: z.object({ sku: z.string().trim().min(1).max(120), opening: money, purchased: money, sold: money, adjustment: z.coerce.number().finite().min(-1e12).max(1e12), transfer_in: money, transfer_out: money, physical: money, unit_cost: money, reason: text }),
  control: z.object({ purpose: z.enum(["payment", "expense_claim", "refund", "cash_withdrawal"]), authorised: approval, purchase_order: text, employee_limit: optionalMoney, reason: text }),
};
export type RecordKind = keyof typeof payloadSchemas;
export interface MonitorRecord {
  id: string; kind: string; label: string; record_date: string; currency: string;
  transaction_id: string | null; replaces_id: string | null;
  payload: unknown;
}
export const recordSchema = z.object({
  orgId: z.string().uuid(), kind: z.enum(["expense", "budget", "cash", "supplier", "inventory", "control"]),
  label: z.string().trim().min(1).max(160), record_date: z.iso.date(), currency: z.string().regex(/^[A-Z]{3}$/),
  transaction_id: z.string().uuid().nullable().default(null), replaces_id: z.string().uuid().nullable().default(null),
  payload: z.unknown(),
}).transform(r => ({ ...r, payload: payloadSchemas[r.kind].parse(r.payload) }));
export const KIND_LABEL: Record<RecordKind, string> = { expense: "Expense", budget: "Monthly budget", cash: "Daily reconciliation", supplier: "Supplier", inventory: "Stock count", control: "Transaction control" };
export interface FieldDef { key: string; label: string; type: "text" | "number" | "approval" | "purpose" }
const f = (key: string, label: string, type: FieldDef["type"] = "text"): FieldDef => ({ key, label, type });
export const FIELDS: Record<RecordKind, FieldDef[]> = {
  expense: [f("category", "Category"), f("employee", "Employee"), f("amount", "Claim amount", "number"), f("claim_ref", "Claim reference"), f("reason", "Business purpose")],
  budget: [f("category", "Category"), f("amount", "Monthly budget", "number")],
  cash: [f("cash_sales", "Recorded cash sales", "number"), f("electronic_sales", "Recorded electronic sales", "number"), f("cash_received", "Cash received", "number"), f("electronic_received", "Electronic receipts", "number"), f("cash_deposited", "Cash deposited", "number"), f("electronic_deposited", "Electronic deposits", "number"), f("refunds", "Refunds (already deducted from recorded sales)", "number"), f("reason", "Reconciliation explanation")],
  supplier: [f("registration", "Registration / tax number"), f("bank_account", "Bank account identifier"), f("bank_approved", "Bank details approved", "approval"), f("reason", "Change explanation")],
  inventory: [f("sku", "SKU"), f("opening", "Opening stock", "number"), f("purchased", "Units purchased", "number"), f("sold", "Units sold", "number"), f("adjustment", "Adjustment (+ / −)", "number"), f("transfer_in", "Transfers in", "number"), f("transfer_out", "Transfers out", "number"), f("physical", "Physical count", "number"), f("unit_cost", "Unit cost", "number"), f("reason", "Adjustment / movement explanation")],
  control: [f("purpose", "Activity", "purpose"), f("authorised", "Authorised", "approval"), f("purchase_order", "Purchase order reference"), f("employee_limit", "Employee approval limit (blank if unknown)", "number"), f("reason", "Activity explanation")],
};
export function activeRecords<T extends MonitorRecord>(records: T[]): T[] {
  const replaced = new Set(records.flatMap(r => r.replaces_id ? [r.replaces_id] : []));
  return records.filter(r => !replaced.has(r.id));
}
export const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export function priorMonth(date: string) {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}