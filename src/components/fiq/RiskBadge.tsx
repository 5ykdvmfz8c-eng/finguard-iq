const STYLE: Record<string, string> = {
  LOW: "bg-risk-low/15 text-risk-low",
  MEDIUM: "bg-risk-medium/20 text-foreground",
  HIGH: "bg-risk-high/15 text-risk-high",
  CRITICAL: "bg-risk-critical/15 text-risk-critical",
};
export function RiskBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-xs text-muted-foreground">—</span>;
  return <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${STYLE[level]}`}>{level}</span>;
}
export const STATUS_LABEL: Record<string, string> = {
  open: "Open", investigating: "Investigating", pending_review: "Pending review", resolved: "Resolved", dismissed: "Dismissed",
};
export const STATUS_STYLE: Record<string, string> = {
  open: "text-primary font-semibold", investigating: "text-risk-low font-semibold", pending_review: "text-foreground",
  resolved: "text-muted-foreground", dismissed: "text-muted-foreground line-through",
};
export const TYPE_LABEL: Record<string, string> = {
  duplicate_invoice: "Duplicate invoice", duplicate_amount: "Repeated amount", split_payment: "Split payment",
  amount_outlier: "Unusual amount", over_limit: "Over approval limit",
};
