import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { detect, type EngineTxn } from "./fraud-engine";

export interface TxnInput {
  txn_date: string;
  amount: number;
  currency: string;
  direction: "outflow" | "inflow";
  payment_method: string | null;
  frequency: string;
  employee: string | null;
  counterparty: string;
  counterparty_type: "supplier" | "customer";
  invoice_ref: string | null;
  reference: string | null;
  description: string | null;
}

const str = (v: unknown, max = 200) => (v == null || v === "" ? null : String(v).slice(0, max));

export const ingestTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; source: "manual" | "upload"; rows: TxnInput[] }) => {
    if (!input?.orgId || !Array.isArray(input.rows)) throw new Error("Invalid input");
    if (input.rows.length === 0 || input.rows.length > 5000) throw new Error("Between 1 and 5000 rows allowed");
    const rows = input.rows.map((r, i) => {
      const amount = Number(r.amount);
      if (!Number.isFinite(amount) || amount < 0) throw new Error(`Row ${i + 1}: invalid amount`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.txn_date))) throw new Error(`Row ${i + 1}: date must be YYYY-MM-DD`);
      if (!r.counterparty) throw new Error(`Row ${i + 1}: supplier/customer is required`);
      return {
        txn_date: String(r.txn_date), amount: Math.round(amount * 100) / 100,
        currency: (str(r.currency, 3) ?? "ZAR").toUpperCase(),
        direction: r.direction === "inflow" ? "inflow" : "outflow",
        payment_method: str(r.payment_method, 40), frequency: str(r.frequency, 20) ?? "once",
        employee: str(r.employee, 120), counterparty: String(r.counterparty).slice(0, 160),
        counterparty_type: r.counterparty_type === "customer" ? "customer" : "supplier",
        invoice_ref: str(r.invoice_ref, 80), reference: str(r.reference, 80), description: str(r.description, 500),
      } as TxnInput;
    });
    return { orgId: input.orgId, source: input.source === "upload" ? "upload" : "manual", rows };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: allowed } = await supabase.rpc("has_org_role", {
      _org: data.orgId, _user: userId, _roles: ["admin", "financial_manager", "employee"],
    });
    if (!allowed) throw new Error("You don't have permission to record transactions");

    const { data: inserted, error } = await supabase
      .from("transactions")
      .insert(data.rows.map((r) => ({ ...r, org_id: data.orgId, source: data.source, created_by: userId })))
      .select("id, txn_date, amount, currency, direction, counterparty, invoice_ref, employee, payment_method");
    if (error) throw new Error(error.message);

    // Detection needs the whole org's history, which employees cannot read; the role check above authorises this.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: org }, { data: history }, { count }] = await Promise.all([
      supabaseAdmin.from("organizations").select("approval_limit").eq("id", data.orgId).single(),
      supabaseAdmin.from("transactions")
        .select("id, txn_date, amount, currency, direction, counterparty, invoice_ref, employee, payment_method")
        .eq("org_id", data.orgId).order("txn_date", { ascending: false }).limit(5000),
      supabaseAdmin.from("alerts").select("id", { count: "exact", head: true }).eq("org_id", data.orgId),
    ]);
    const toEngine = (x: Record<string, unknown>) => ({ ...x, amount: Number(x["amount"]) }) as EngineTxn;
    const findings = detect((inserted ?? []).map(toEngine), (history ?? []).map(toEngine), {
      approvalLimit: Number(org?.approval_limit ?? 50000),
    });

    let n = count ?? 0;
    if (findings.length) {
      const { error: aErr } = await supabaseAdmin.from("alerts").insert(findings.map((f) => ({
        org_id: data.orgId, code: `ALT-${String(++n).padStart(4, "0")}`, transaction_id: f.transaction_id,
        related_ids: f.related_ids, alert_type: f.alert_type, risk_level: f.risk_level, score: f.score,
        title: f.title, evidence: f.evidence as never,
      })));
      if (aErr) throw new Error(aErr.message);
      const top = new Map<string, (typeof findings)[number]>();
      for (const f of findings) if ((top.get(f.transaction_id)?.score ?? -1) < f.score) top.set(f.transaction_id, f);
      await Promise.all([...top.values()].map((f) =>
        supabaseAdmin.from("transactions").update({ risk_score: f.score, risk_level: f.risk_level }).eq("id", f.transaction_id)));
    }
    return { inserted: inserted?.length ?? 0, flagged: findings.length };
  });
