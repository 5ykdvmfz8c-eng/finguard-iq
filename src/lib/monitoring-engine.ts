import { levelForScore, type EngineTxn, type RiskLevel } from "./fraud-engine";
import { activeRecords, normalise, payloadSchemas, priorMonth, type MonitorRecord } from "./monitoring-model";

export interface Factor { rule: string; score: number; detail: string; values: Record<string, unknown> }
export interface MonitorFinding { recordId: string; transactionId: string | null; score: number; riskLevel: RiskLevel; type: string; title: string; factors: Factor[]; relatedIds: string[] }
export function combineScores(scores: number[]): number {
  const sorted = [...scores].sort((a, b) => b - a);
  return Math.min(100, Math.round((sorted[0] ?? 0) + sorted.slice(1).reduce((s, n) => s + n * 0.2, 0)));
}
export function analyseMonitoring(records: MonitorRecord[], transactions: EngineTxn[], documented: Set<string>, adjustmentCounts: Map<string, number> = new Map()): MonitorFinding[] {
  const active = activeRecords(records);
  const txMap = new Map(transactions.map(t => [t.id, t]));
  const findings: MonitorFinding[] = [];
  for (const r of active) {
    const factors: Factor[] = [];
    const add = (rule: string, score: number, detail: string, values: Record<string, unknown>) => factors.push({ rule, score, detail, values });
    if (r.kind === "expense") {
      const p = payloadSchemas.expense.safeParse(r.payload); if (!p.success) continue;
      const e = p.data;
      // A correction retains supporting documents from its predecessor chain.
      let ancestor: MonitorRecord | undefined = r;
      let hasDoc = false;
      const visited = new Set<string>();
      while (ancestor && !visited.has(ancestor.id)) { visited.add(ancestor.id); if (documented.has(ancestor.id)) hasDoc = true; ancestor = records.find(x => x.id === ancestor?.replaces_id); }
      if (!hasDoc) add("missing_documentation", 30, "Expense has no attached supporting document", { amount: e.amount });
      const group = active.filter(x => x.kind === "expense" && x.currency === r.currency && payloadSchemas.expense.safeParse(x.payload).success).map(x => ({ r: x, p: payloadSchemas.expense.parse(x.payload) })).filter(x => normalise(x.p.category) === normalise(e.category));
      const month = r.record_date.slice(0, 7);
      const current = group.filter(x => x.r.record_date.startsWith(month)).reduce((s, x) => s + x.p.amount, 0);
      const previous = group.filter(x => x.r.record_date.startsWith(priorMonth(r.record_date))).reduce((s, x) => s + x.p.amount, 0);
      if (previous > 0 && current > previous * 1.5) add("expense_increase", 45, "Category expenses increased by more than 50% over the previous month", { current, previous, increase_pct: Math.round((current / previous - 1) * 100) });
      const budgets = active.filter(x => x.kind === "budget" && x.currency === r.currency && x.record_date.startsWith(month)).map(x => payloadSchemas.budget.safeParse(x.payload)).filter(x => x.success && normalise(x.data.category) === normalise(e.category));
      const budget = budgets.find(x => x.success)?.data;
      if (budget && current > budget.amount) add("budget_exceeded", 55, "Monthly category spending exceeds the approved budget", { spending: current, budget: budget.amount });
      const repeat = group.find(x => x.r.id !== r.id && x.r.id < r.id && normalise(x.p.employee) === normalise(e.employee) && e.employee && x.p.amount === e.amount && (e.claim_ref ? normalise(x.p.claim_ref) === normalise(e.claim_ref) : x.r.record_date === r.record_date));
      if (repeat) add("repeated_claim", 62, "Repeated claim by the same employee", { other_record: repeat.r.id, claim_ref: e.claim_ref, amount: e.amount });
      const employeeHistory = active.filter(x => x.kind === "expense" && x.currency === r.currency && x.record_date < r.record_date).flatMap(x => { const q = payloadSchemas.expense.safeParse(x.payload); return q.success && e.employee && normalise(q.data.employee) === normalise(e.employee) ? [q.data.amount] : []; });
      if (employeeHistory.length >= 5) { const mean = employeeHistory.reduce((s,n)=>s+n,0)/employeeHistory.length; const sd = Math.sqrt(employeeHistory.reduce((s,n)=>s+(n-mean)**2,0)/employeeHistory.length); if ((sd > 0 && e.amount > mean + 3 * sd) || (sd === 0 && mean > 0 && e.amount > mean * 2)) add("unusual_claim", 60, "Claim is unusually large against this employee’s prior claims", { amount: e.amount, typical: mean, historical_claims: employeeHistory.length }); }
    }
    if (r.kind === "cash") {
      const p = payloadSchemas.cash.safeParse(r.payload); if (!p.success) continue; const c = p.data;
      if (c.cash_received < c.cash_sales) add("cash_shortage", 65, "Cash received is below recorded net cash sales", { recorded: c.cash_sales, received: c.cash_received, shortage: c.cash_sales - c.cash_received });
      if (c.electronic_received !== c.electronic_sales) add("electronic_discrepancy", 55, "Electronic receipts differ from recorded sales", { recorded: c.electronic_sales, received: c.electronic_received });
      if (c.cash_received > c.cash_sales) add("missing_sales", 40, "Cash receipts exceed recorded sales; sales records may be incomplete", { recorded: c.cash_sales, received: c.cash_received });
      if (c.cash_deposited !== c.cash_received || c.electronic_deposited !== c.electronic_received) add("deposit_discrepancy", 55, "Deposits differ from receipts; timing differences require review", { cash_difference: c.cash_received - c.cash_deposited, electronic_difference: c.electronic_received - c.electronic_deposited, explanation: c.reason });
      const gross = c.cash_sales + c.electronic_sales + c.refunds;
      const past = active.filter(x=>x.kind==="cash" && x.currency===r.currency && x.record_date<r.record_date).flatMap(x=>{const q=payloadSchemas.cash.safeParse(x.payload);return q.success?[q.data]:[];});
      const previousSales = past.map(x=>x.cash_sales+x.electronic_sales);
      if(previousSales.length>=5){const mean=previousSales.reduce((s,n)=>s+n,0)/previousSales.length;const sd=Math.sqrt(previousSales.reduce((s,n)=>s+(n-mean)**2,0)/previousSales.length);const sales=c.cash_sales+c.electronic_sales;if(sd>0&&Math.abs(sales-mean)>3*sd)add("inconsistent_sales",45,"Daily sales differ substantially from prior days",{sales,typical:mean,days:past.length});}
      const historicalGross=past.reduce((s,x)=>s+x.cash_sales+x.electronic_sales+x.refunds,0); const historicalRate=historicalGross>0?past.reduce((s,x)=>s+x.refunds,0)/historicalGross:0;
      if (gross > 0 && (c.refunds / gross > 0.1 || (past.length>=5 && historicalRate>0 && c.refunds/gross>historicalRate*3))) add("abnormal_refunds", 60, "Refunds exceed 10% of gross sales or three times the historical rate", { refunds: c.refunds, gross_sales: gross, refund_pct: Math.round(c.refunds / gross * 100), historical_pct:Math.round(historicalRate*100) });
    }
    if (r.kind === "supplier") {
      const p = payloadSchemas.supplier.safeParse(r.payload); if (!p.success) continue; const s = p.data;
      const duplicate = active.find(x => x.kind === "supplier" && x.id !== r.id && x.id < r.id && (()=>{const o=payloadSchemas.supplier.safeParse(x.payload);return o.success && ((s.registration && normalise(o.data.registration)===normalise(s.registration)) || (s.bank_account && normalise(o.data.bank_account)===normalise(s.bank_account)) || normalise(x.label)===normalise(r.label));})());
      if (duplicate) add("duplicate_supplier", 70, "Supplier accounts share a name, registration number or bank account", { other_record: duplicate.id, other_supplier: duplicate.label });
      const predecessor = records.find(x => x.id === r.replaces_id); const old = payloadSchemas.supplier.safeParse(predecessor?.payload);
      if (old.success && normalise(old.data.bank_account) !== normalise(s.bank_account) && s.bank_approved !== "yes") add("bank_change", 80, "Supplier banking details changed without administrator approval", { approval: s.bank_approved, previous_record: predecessor?.id, explanation: s.reason });
    }
    if (r.kind === "inventory") {
      const p = payloadSchemas.inventory.safeParse(r.payload); if (!p.success) continue; const i = p.data;
      const expected = i.opening + i.purchased - i.sold + i.adjustment + i.transfer_in - i.transfer_out;
      if (i.physical !== expected) add("stock_discrepancy", i.physical < expected ? 65 : 45, "Physical stock differs from the purchased / sold stock reconciliation", { expected, physical: i.physical, difference: i.physical - expected, value_difference: (i.physical - expected) * i.unit_cost, sku: i.sku });
      if (i.adjustment !== 0 && !i.reason) add("unexplained_adjustment", 55, "Stock adjustment has no explanation", { adjustment: i.adjustment });
      if ((i.transfer_out > i.opening + i.purchased + i.transfer_in || (i.transfer_out > 0 && !i.reason)) || expected < 0) add("suspicious_movement", 60, "Stock movement exceeds available units or has no explanation", { transfer_out: i.transfer_out, expected, explanation: i.reason });
    }
    if (r.kind === "control") {
      const p = payloadSchemas.control.safeParse(r.payload); const t = r.transaction_id ? txMap.get(r.transaction_id) : undefined; if (!p.success || !t) continue; const c = p.data;
      if (c.authorised === "no") add("unauthorised_transaction", 75, "Transaction is recorded as unauthorised", { authorisation: c.authorised, employee: t.employee });
      if (c.employee_limit !== null && t.amount > c.employee_limit) add("employee_limit", 55, "Transaction exceeds this employee’s approval limit", { amount: t.amount, limit: c.employee_limit, currency: t.currency });
      if (c.purpose === "payment" && t.direction === "outflow" && !c.purchase_order) add("missing_purchase_order", 45, "Supplier payment has no recorded purchase order", { supplier: t.counterparty, amount: t.amount });
      const revisions = (adjustmentCounts.get(t.id) ?? 0) + records.filter(x => x.kind === "control" && x.transaction_id === t.id && x.replaces_id).length;
      if (revisions >= 3) add("repeated_adjustments", 60, "Financial record or control details were adjusted at least three times", { adjustments: revisions });
      const withdrawals = active.filter(x => x.kind === "control" && x.transaction_id !== t.id).flatMap(x => { const q=payloadSchemas.control.safeParse(x.payload); const o=x.transaction_id?txMap.get(x.transaction_id):undefined; return q.success && q.data.purpose==="cash_withdrawal" && o && o.currency===t.currency && o.employee===t.employee && o.txn_date<t.txn_date ? [o.amount] : []; });
      if (c.purpose === "cash_withdrawal") { const mean=withdrawals.reduce((s,n)=>s+n,0)/Math.max(1,withdrawals.length); if (!c.reason || (withdrawals.length>=5 && t.amount>mean*3)) add("unusual_withdrawal",60,"Cash withdrawal lacks a business purpose or exceeds three times the employee’s historical average",{amount:t.amount,historical_count:withdrawals.length,typical:withdrawals.length?mean:null,explanation:c.reason}); }
      if (c.purpose === "refund" && c.authorised === "no") add("suspicious_refund", 60, "Refund has no authorisation", { amount:t.amount });
    }
    if (factors.length) { const score=combineScores(factors.map(f=>f.score)); findings.push({ recordId:r.id,transactionId:r.transaction_id,score,riskLevel:levelForScore(score),type:`${r.kind}_irregularity`,title:`${r.label}: ${factors[0]?.detail ?? "irregularity"}`,factors,relatedIds:[] }); }
  }
  return findings;
}