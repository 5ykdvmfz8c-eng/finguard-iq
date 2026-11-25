import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, FileUp, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTransactions } from "@/components/fiq/data";
import { useOrg } from "@/components/fiq/org-context";
import { RiskBadge } from "@/components/fiq/RiskBadge";
import { ingestTransactions, type TxnInput } from "@/lib/ingest.functions";
import { mapRows } from "@/lib/parse-upload";
import { sampleLedger } from "@/lib/sample-data";
import { CURRENCIES, convert, fmtMoney } from "@/lib/currency";
import { can } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — FINANCIAL IQ" },
      { name: "description", content: "Upload CSV/Excel ledgers or record transactions for automated fraud screening." },
      { property: "og:title", content: "Transactions — FINANCIAL IQ" },
      { property: "og:description", content: "Upload ledgers or record transactions for automated fraud screening." },
    ],
  }),
  component: TransactionsPage,
});

function useIngest() {
  const fn = useServerFn(ingestTransactions);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      toast.success(`${r.inserted} transaction(s) analysed · ${r.flagged} risk flag(s) raised`);
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
}

function TransactionsPage() {
  const { current, displayCurrency } = useOrg();
  const { data = [], isLoading } = useTransactions();
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState("all");
  const [record, setRecord] = useState(false);
  const [upload, setUpload] = useState(false);
  const ingest = useIngest();
  const writer = can.record(current?.role);

  const rows = useMemo(() => data.filter((t) =>
    (risk === "all" || (risk === "flagged" ? !!t.risk_level : t.risk_level === risk)) &&
    (!q || [t.counterparty, t.invoice_ref, t.employee, t.reference, t.description].some((v) => v?.toLowerCase().includes(q.toLowerCase())))
  ), [data, q, risk]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2 px-1">
        <div><h1 className="text-2xl font-extrabold tracking-tight">Transactions</h1>
          <p className="text-xs text-muted-foreground">Every new transaction is screened for duplicate invoices, repeated amounts, split payments and unusual values.</p></div>
        {writer && <div className="flex flex-wrap gap-2">
          {data.length === 0 && <Button variant="outline" size="sm" disabled={ingest.isPending}
            onClick={() => ingest.mutate({ data: { orgId: current!.org_id, source: "upload", rows: sampleLedger() } })}>
            <Sparkles className="size-4" />Load sample ledger</Button>}
          <Button variant="outline" size="sm" onClick={() => setUpload(true)}><FileUp className="size-4" />Upload CSV / Excel</Button>
          <Button size="sm" onClick={() => setRecord(true)}><Plus className="size-4" />Record transaction</Button>
        </div>}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <Input className="h-8 max-w-xs text-xs" placeholder="Search supplier, invoice, employee…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={risk} onValueChange={setRisk}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{[["all", "All risk levels"], ["flagged", "Any flag"], ["CRITICAL", "Critical"], ["HIGH", "High"], ["MEDIUM", "Medium"], ["LOW", "Low"]].map(([v, l]) => <SelectItem key={v} value={v!}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <span className="ml-auto self-center text-xs text-muted-foreground">{rows.length} of {data.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-muted text-left text-muted-foreground">
              {["Date", "Supplier / customer", "Invoice", "Amount", `In ${displayCurrency}`, "Method", "Frequency", "Employee", "Risk"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2.5 font-semibold first:rounded-l-md last:rounded-r-md">{h}</th>)}
            </tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={9} className="py-10 text-center text-muted-foreground">No transactions yet. Upload a ledger or record one manually.</td></tr>}
              {rows.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{t.txn_date}</td>
                  <td className="px-3 py-2"><div className="font-medium">{t.counterparty}</div><div className="text-[10px] text-muted-foreground">{t.counterparty_type} · {t.direction}</div></td>
                  <td className="px-3 py-2 font-mono">{t.invoice_ref ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{fmtMoney(Number(t.amount), t.currency)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">{t.currency === displayCurrency ? "—" : fmtMoney(convert(Number(t.amount), t.currency, displayCurrency), displayCurrency)}</td>
                  <td className="px-3 py-2">{t.payment_method ?? "—"}</td>
                  <td className="px-3 py-2">{t.frequency}</td>
                  <td className="whitespace-nowrap px-3 py-2">{t.employee ?? "—"}</td>
                  <td className="px-3 py-2"><RiskBadge level={t.risk_level} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {displayCurrency !== "ZAR" && <p className="mt-2 text-[10px] text-muted-foreground">Converted values use indicative exchange rates.</p>}
      </div>

      <RecordDialog open={record} onOpenChange={setRecord} onSubmit={(r) => ingest.mutateAsync({ data: { orgId: current!.org_id, source: "manual", rows: [r] } }).then(() => setRecord(false))} busy={ingest.isPending} baseCurrency={current?.organizations.base_currency ?? "ZAR"} />
      <UploadDialog open={upload} onOpenChange={setUpload} busy={ingest.isPending} baseCurrency={current?.organizations.base_currency ?? "ZAR"}
        onSubmit={(rows) => ingest.mutateAsync({ data: { orgId: current!.org_id, source: "upload", rows } }).then(() => setUpload(false))} />
    </div>
  );
}

function RecordDialog({ open, onOpenChange, onSubmit, busy, baseCurrency }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (r: TxnInput) => Promise<unknown>; busy: boolean; baseCurrency: string }) {
  const empty = (): TxnInput => ({ txn_date: new Date().toISOString().slice(0, 10), amount: 0, currency: baseCurrency, direction: "outflow", payment_method: "EFT", frequency: "once", employee: "", counterparty: "", counterparty_type: "supplier", invoice_ref: "", reference: "", description: "" });
  const [f, setF] = useState<TxnInput>(empty);
  const set = <K extends keyof TxnInput>(k: K, v: TxnInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const field = (k: keyof TxnInput, label: string, type = "text") => (
    <div className="space-y-1"><Label className="text-xs">{label}</Label>
      <Input type={type} step={type === "number" ? "0.01" : undefined} value={String(f[k] ?? "")} required={k === "counterparty" || k === "amount" || k === "txn_date"}
        onChange={(e) => set(k, (type === "number" ? Number(e.target.value) : e.target.value) as never)} /></div>
  );
  const sel = (k: keyof TxnInput, label: string, opts: string[]) => (
    <div className="space-y-1"><Label className="text-xs">{label}</Label>
      <Select value={String(f[k])} onValueChange={(v) => set(k, v as never)}><SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
  );
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setF(empty()); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Record transaction</DialogTitle><DialogDescription>It will be screened against your full history immediately.</DialogDescription></DialogHeader>
        <form className="grid grid-cols-2 gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); onSubmit(f).then(() => setF(empty())).catch(() => {}); }}>
          {field("txn_date", "Date", "date")}{field("amount", "Amount", "number")}{sel("currency", "Currency", CURRENCIES)}
          {field("counterparty", "Supplier / customer")}{sel("counterparty_type", "Party type", ["supplier", "customer"])}{sel("direction", "Direction", ["outflow", "inflow"])}
          {field("invoice_ref", "Invoice reference")}{field("reference", "Transaction reference")}{sel("payment_method", "Payment method", ["EFT", "Card", "Cash", "Cheque", "Debit order", "Other"])}
          {sel("frequency", "Frequency", ["once", "weekly", "monthly", "quarterly", "annually"])}{field("employee", "Responsible employee")}{field("description", "Description")}
          <div className="col-span-full flex justify-end"><Button disabled={busy}>Save & analyse</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({ open, onOpenChange, onSubmit, busy, baseCurrency }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (r: TxnInput[]) => Promise<unknown>; busy: boolean; baseCurrency: string }) {
  const [parsed, setParsed] = useState<{ rows: TxnInput[]; errors: string[]; name: string } | null>(null);
  async function onFile(file: File) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]!]!;
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    setParsed({ ...mapRows(raw, baseCurrency), name: file.name });
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setParsed(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Upload CSV or Excel</DialogTitle>
          <DialogDescription>Columns we recognise: date, amount, currency, direction, payment method, frequency, employee, supplier/customer, invoice number, reference, description. Dates may be YYYY-MM-DD or DD/MM/YYYY.</DialogDescription></DialogHeader>
        <a href="/financial-iq-template.csv" download className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Download className="size-3.5" />Download template</a>
        <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f).catch(() => toast.error("Could not read that file")); }} />
        {parsed && <div className="space-y-2 rounded-md border p-3 text-xs">
          <div><b>{parsed.name}</b>: {parsed.rows.length} valid row(s){parsed.errors.length ? `, ${parsed.errors.length} skipped` : ""}</div>
          {parsed.errors.slice(0, 5).map((e) => <div key={e} className="text-destructive">{e}</div>)}
        </div>}
        <div className="flex justify-end"><Button disabled={!parsed?.rows.length || busy} onClick={() => parsed && onSubmit(parsed.rows).catch(() => {})}>Import & analyse {parsed?.rows.length ?? ""}</Button></div>
      </DialogContent>
    </Dialog>
  );
}
