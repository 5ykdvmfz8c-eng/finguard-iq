import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAlerts, useTransactions } from "@/components/fiq/data";
import { useOrg } from "@/components/fiq/org-context";
import { TYPE_LABEL } from "@/components/fiq/RiskBadge";
import { AlertTable } from "@/components/fiq/AlertTable";
import { convert, fmtMoney } from "@/lib/currency";
import { can } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Risk Overview — FINANCIAL IQ" },
      { name: "description", content: "Risk health score, trend timeline and live alert triage." },
      { property: "og:title", content: "Risk Overview — FINANCIAL IQ" },
      { property: "og:description", content: "Risk health score, trend timeline and live alert triage." },
    ],
  }),
  component: Dashboard,
});

const WEIGHT: Record<string, number> = { LOW: 1, MEDIUM: 3, HIGH: 6, CRITICAL: 12 };
const UNRESOLVED = ["open", "investigating", "pending_review"];

function Card({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border bg-card p-4 md:p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

function Dial({ value }: { value: number }) {
  const r = 46, c = 2 * Math.PI * r, pct = value / 100;
  const color = value >= 75 ? "var(--risk-low)" : value >= 50 ? "var(--risk-medium)" : value >= 25 ? "var(--risk-high)" : "var(--risk-critical)";
  return (
    <svg viewBox="0 0 120 120" className="size-32">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--muted)" strokeWidth="11" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="58" textAnchor="middle" className="fill-foreground font-mono text-[22px] font-medium">{value}</text>
      <text x="60" y="76" textAnchor="middle" className="fill-muted-foreground text-[9px]">/ 100</text>
    </svg>
  );
}

function Dashboard() {
  const { current, displayCurrency } = useOrg();
  const txns = useTransactions();
  const alerts = useAlerts();
  const t = txns.data ?? [];
  const a = alerts.data ?? [];
  const role = current?.role;

  const m = useMemo(() => {
    const open = a.filter((x) => UNRESOLVED.includes(x.status));
    const weighted = open.reduce((s, x) => s + (WEIGHT[x.risk_level] ?? 0), 0);
    const health = Math.max(0, Math.round(100 - (weighted * 100) / (weighted + Math.max(10, t.length * 0.6))));
    const byType = new Map<string, number>();
    open.forEach((x) => byType.set(x.alert_type, (byType.get(x.alert_type) ?? 0) + 1));
    const contributors = [...byType.entries()].map(([k, v]) => ({ k, pct: Math.round((v / Math.max(1, open.length)) * 100) })).sort((x, y) => y.pct - x.pct);
    const txById = new Map(t.map((x) => [x.id, x]));
    const atRisk = open.reduce((s, x) => { const tx = x.transaction_id ? txById.get(x.transaction_id) : undefined; return tx ? s + convert(Number(tx.amount), tx.currency, displayCurrency) : s; }, 0);
    // trend by transaction date, last 30 active days
    const days = new Map<string, { day: string; analysed: number; flagged: number; high: number }>();
    t.forEach((x) => { const d = days.get(x.txn_date) ?? { day: x.txn_date, analysed: 0, flagged: 0, high: 0 }; d.analysed++; if (x.risk_level) d.flagged++; if (x.risk_level === "HIGH" || x.risk_level === "CRITICAL") d.high++; days.set(x.txn_date, d); });
    const trend = [...days.values()].sort((x, y) => x.day.localeCompare(y.day)).slice(-30).map((d) => ({ ...d, label: d.day.slice(5) }));
    return {
      open, health, contributors, atRisk, trend,
      suspicious: t.filter((x) => x.risk_level).length,
      highRisk: t.filter((x) => x.risk_level === "HIGH" || x.risk_level === "CRITICAL").length,
      duplicates: a.filter((x) => x.alert_type.startsWith("duplicate")).length,
      splits: a.filter((x) => x.alert_type === "split_payment").length,
      investigating: a.filter((x) => x.status === "investigating" || x.status === "pending_review").length,
    };
  }, [a, t, displayCurrency]);

  if (!can.viewAll(role)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold">Welcome</h1>
        <Card title="Your recorded transactions"><p className="text-sm text-muted-foreground">You've recorded <b className="text-foreground">{t.length}</b> transactions. Risk results are reviewed by your finance team.</p>
          <Link to="/transactions" className="mt-3 inline-block text-sm font-semibold text-primary">Record a transaction →</Link></Card>
      </div>
    );
  }

  const stats = [
    ["Transactions analysed", t.length], ["Suspicious", m.suspicious], ["High / critical", m.highRisk],
    ["Potential duplicates", m.duplicates], ["Split payments", m.splits], ["Open investigations", m.investigating],
  ] as const;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2 px-1">
        <div><h1 className="text-2xl font-extrabold tracking-tight">Risk Overview</h1>
          <p className="text-xs text-muted-foreground">Real-time monitoring of transaction risk and fraud indicators · {current?.organizations.name}</p></div>
        <div className="text-right"><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Value under review</div>
          <div className="font-mono text-lg font-medium">{fmtMoney(m.atRisk, displayCurrency)}</div></div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[11px] text-muted-foreground">{k}</div>
            <div className="font-mono text-xl font-medium">{v.toLocaleString("en-ZA")}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Risk Health Score" action={<Link to="/alerts" className="text-xs font-semibold text-primary">View details</Link>}>
          <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center justify-center rounded-lg border px-6 py-4">
              <Dial value={m.health} />
              <span className="mt-2 rounded border px-2 py-0.5 text-[11px] text-muted-foreground">{m.open.length} unresolved</span>
            </div>
            <div>
              <div className="mb-2 text-xs font-bold">Top Contributors</div>
              {m.contributors.length === 0 && <p className="text-xs text-muted-foreground">No unresolved alerts. Upload or record transactions to start monitoring.</p>}
              <div className="space-y-3">
                {m.contributors.slice(0, 5).map((c) => (
                  <div key={c.k}>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">{TYPE_LABEL[c.k] ?? c.k}</span><span className="font-mono font-medium">{c.pct}%</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${c.pct}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <Card title="Risk Trend Timeline" action={<span className="text-xs text-muted-foreground">by transaction date</span>}>
          <div className="h-56">
            {m.trend.length < 2 ? <p className="text-xs text-muted-foreground">Not enough data yet.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={m.trend} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="flagged" name="Suspicious flagged" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="high" name="High / critical" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="analysed" name="Analysed" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card title="Top Alerts & Incidents" action={<Link to="/alerts" className="text-xs font-semibold text-primary">View all alerts</Link>}>
        <AlertTable rows={m.open.sort((x, y) => y.score - x.score).slice(0, 8)} />
      </Card>
    </div>
  );
}

