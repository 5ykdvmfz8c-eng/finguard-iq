// Pure, deterministic fraud-detection rules. Flags are evidence for human review, never a verdict.
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface EngineTxn {
  id: string;
  txn_date: string; // YYYY-MM-DD
  amount: number;
  currency: string;
  direction: "outflow" | "inflow";
  counterparty: string;
  invoice_ref: string | null;
  employee: string | null;
  payment_method: string | null;
}

export interface Finding {
  transaction_id: string;
  related_ids: string[];
  alert_type: "duplicate_invoice" | "duplicate_amount" | "split_payment" | "amount_outlier" | "over_limit";
  score: number;
  risk_level: RiskLevel;
  title: string;
  evidence: Record<string, unknown>;
}

export interface EngineOptions {
  approvalLimit: number; // in transaction currency units
  duplicateWindowDays?: number;
  splitWindowDays?: number;
}

export function levelForScore(score: number): RiskLevel {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/\b(pty|ltd|inc|cc|llc)\b/g, "").replace(/[^a-z0-9]/g, "");

const dayDiff = (a: string, b: string) =>
  Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;

function make(t: EngineTxn, type: Finding["alert_type"], score: number, title: string, related: string[], evidence: Record<string, unknown>): Finding {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return { transaction_id: t.id, related_ids: related, alert_type: type, score: s, risk_level: levelForScore(s), title, evidence };
}

/** Analyse `incoming` transactions against `history` (which may include them). */
export function detect(incoming: EngineTxn[], history: EngineTxn[], opts: EngineOptions): Finding[] {
  const dupWindow = opts.duplicateWindowDays ?? 30;
  const splitWindow = opts.splitWindowDays ?? 3;
  const findings: Finding[] = [];
  const incomingIds = new Set(incoming.map((t) => t.id));
  const all = [...new Map([...history, ...incoming].map((t) => [t.id, t])).values()];

  for (const t of incoming) {
    if (t.direction !== "outflow") continue;
    const cp = norm(t.counterparty);
    const peers = all.filter((o) => o.id !== t.id && o.direction === "outflow" && norm(o.counterparty) === cp && o.currency === t.currency);
    // Only compare against earlier-ingested peers, or within the batch to the earlier-indexed one, so each pair flags once.
    const prior = peers.filter((o) => !incomingIds.has(o.id) || incoming.indexOf(o) < incoming.indexOf(t));

    // 1. Same supplier + same invoice number
    const inv = norm(t.invoice_ref);
    const invDup = inv ? prior.filter((o) => norm(o.invoice_ref) === inv) : [];
    if (invDup.length) {
      const sameAmount = invDup.some((o) => o.amount === t.amount);
      findings.push(make(t, "duplicate_invoice", sameAmount ? 92 : 68,
        `Invoice ${t.invoice_ref} paid more than once to ${t.counterparty}`,
        invDup.map((o) => o.id), { invoice_ref: t.invoice_ref, same_amount: sameAmount, matches: invDup.length }));
      continue;
    }

    // 2. Same supplier + same amount close together (different / missing invoice)
    const amtDup = prior.filter((o) => o.amount === t.amount && dayDiff(o.txn_date, t.txn_date) <= dupWindow);
    if (amtDup.length) {
      const closest = Math.min(...amtDup.map((o) => dayDiff(o.txn_date, t.txn_date)));
      findings.push(make(t, "duplicate_amount", closest <= 3 ? 62 : 40,
        `Identical amount paid to ${t.counterparty} within ${Math.round(closest)} day(s)`,
        amtDup.map((o) => o.id), { amount: t.amount, days_apart: Math.round(closest) }));
    }

    // 3. Split payments: several sub-limit payments that together breach the approval limit
    if (t.amount < opts.approvalLimit) {
      const cluster = prior.filter((o) => o.amount < opts.approvalLimit && dayDiff(o.txn_date, t.txn_date) <= splitWindow && norm(o.employee) === norm(t.employee));
      const total = cluster.reduce((s, o) => s + o.amount, t.amount);
      if (cluster.length >= 1 && total >= opts.approvalLimit) {
        findings.push(make(t, "split_payment", cluster.length >= 2 ? 72 : 55,
          `Possible split payment to ${t.counterparty}: ${cluster.length + 1} payments total above approval limit`,
          cluster.map((o) => o.id), { combined_total: total, approval_limit: opts.approvalLimit, payments: cluster.length + 1 }));
      }
    } else {
      findings.push(make(t, "over_limit", 30, `Payment to ${t.counterparty} exceeds approval limit`, [], { amount: t.amount, approval_limit: opts.approvalLimit }));
    }

    // 4. Statistical outlier against this supplier's history
    if (peers.length >= 5) {
      const xs = peers.map((o) => o.amount);
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
      if (sd > 0 && (t.amount - mean) / sd >= 3) {
        const z = (t.amount - mean) / sd;
        findings.push(make(t, "amount_outlier", Math.min(70, 30 + z * 6),
          `Unusually large payment to ${t.counterparty}`, [], { z_score: Number(z.toFixed(2)), typical_amount: Math.round(mean) }));
      }
    }
  }
  return findings;
}
