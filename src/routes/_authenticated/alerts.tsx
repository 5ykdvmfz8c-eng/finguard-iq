import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAlerts, useTransactions } from "@/components/fiq/data";
import { useOrg } from "@/components/fiq/org-context";
import { AlertTable } from "@/components/fiq/AlertTable";
import { RiskBadge, STATUS_LABEL, TYPE_LABEL } from "@/components/fiq/RiskBadge";
import { fmtMoney } from "@/lib/currency";
import { can } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts & Incidents — FINANCIAL IQ" },
      { name: "description", content: "Triage duplicate payment and fraud risk alerts." },
      { property: "og:title", content: "Alerts & Incidents — FINANCIAL IQ" },
      { property: "og:description", content: "Triage duplicate payment and fraud risk alerts." },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const { current } = useOrg();
  const { data = [] } = useAlerts();
  const txns = useTransactions();
  const qc = useQueryClient();
  const [status, setStatus] = useState("unresolved");
  const [level, setLevel] = useState("all");
  const [sel, setSel] = useState<string | null>(null);
  const triage = can.triage(current?.role);

  const members = useQuery({
    queryKey: ["members", current?.org_id], enabled: !!current,
    queryFn: async () => (await supabase.from("org_members").select("email, display_name, role").eq("org_id", current!.org_id)).data ?? [],
  });

  const rows = useMemo(() => data.filter((a) =>
    (status === "all" || (status === "unresolved" ? ["open", "investigating", "pending_review"].includes(a.status) : a.status === status)) &&
    (level === "all" || a.risk_level === level)).sort((x, y) => y.score - x.score), [data, status, level]);
  const alert = data.find((a) => a.id === sel);
  const txById = new Map((txns.data ?? []).map((t) => [t.id, t]));

  const update = useMutation({
    mutationFn: async (patch: { status?: "open" | "investigating" | "pending_review" | "resolved" | "dismissed"; owner?: string | null }) => {
      const { error } = await supabase.from("alerts").update(patch).eq("id", sel!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["alerts"] }); toast.success("Alert updated"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  if (!can.viewAll(current?.role)) return <p className="p-6 text-sm text-muted-foreground">Alerts are visible to administrators, financial managers and auditors.</p>;

  const linked = alert ? [alert.transaction_id, ...alert.related_ids].map((id) => id && txById.get(id)).filter(Boolean) : [];

  return (
    <div className="space-y-3">
      <div className="px-1"><h1 className="text-2xl font-extrabold tracking-tight">Alerts & Incidents</h1>
        <p className="text-xs text-muted-foreground">Flags are evidence for investigation — they never establish that anyone committed fraud.</p></div>
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="unresolved">Unresolved</SelectItem><SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
          <Select value={level} onValueChange={setLevel}><SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All risk levels</SelectItem>{["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
          <span className="ml-auto self-center text-xs text-muted-foreground">{rows.length} alert(s)</span>
        </div>
        <AlertTable rows={rows} onSelect={setSel} />
      </div>

      <Sheet open={!!alert} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {alert && <>
            <SheetHeader>
              <div className="flex items-center gap-2"><RiskBadge level={alert.risk_level} /><span className="font-mono text-xs text-muted-foreground">{alert.code} · score {alert.score}</span></div>
              <SheetTitle className="text-left">{alert.title}</SheetTitle>
              <SheetDescription className="text-left">{TYPE_LABEL[alert.alert_type]} · raised {new Date(alert.created_at).toLocaleString("en-ZA")}</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-6 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><div className="text-xs text-muted-foreground">Status</div>
                  <Select disabled={!triage} value={alert.status} onValueChange={(v) => update.mutate({ status: v as never })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><div className="text-xs text-muted-foreground">Owner</div>
                  <Select disabled={!triage} value={alert.owner ?? "__none"} onValueChange={(v) => update.mutate({ owner: v === "__none" ? null : v })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="__none">Unassigned</SelectItem>
                      {(members.data ?? []).filter((m) => m.role !== "employee" && m.email).map((m) => <SelectItem key={m.email!} value={m.display_name || m.email!}>{m.display_name || m.email}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div><div className="mb-1 text-xs font-bold">Evidence</div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-muted p-3 font-mono text-xs">
                  {Object.entries(alert.evidence as Record<string, unknown>).map(([k, v]) => <><dt key={k} className="text-muted-foreground">{k.replace(/_/g, " ")}</dt><dd>{String(v)}</dd></>)}
                </dl></div>
              <div><div className="mb-1 text-xs font-bold">Linked transactions</div>
                <div className="divide-y rounded-md border">
                  {linked.map((t, i) => t && (
                    <div key={t.id} className="flex items-center justify-between gap-2 p-2.5 text-xs">
                      <div><div className="font-medium">{t.counterparty} {i === 0 && <span className="text-primary">(flagged)</span>}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{t.txn_date} · {t.invoice_ref ?? "no invoice"} · {t.employee ?? "—"} · {t.payment_method ?? ""}</div></div>
                      <div className="font-mono">{fmtMoney(Number(t.amount), t.currency)}</div>
                    </div>))}
                </div></div>
            </div>
          </>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
