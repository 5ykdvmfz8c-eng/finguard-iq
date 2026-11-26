import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Plus, ScanLine, Pencil, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { activeRecords, FIELDS, KIND_LABEL, priorMonth, type RecordKind, type MonitorRecord } from "@/lib/monitoring-model";
import { saveMonitoringRecord } from "@/lib/monitoring.functions";
import { fmtMoney, CURRENCIES } from "@/lib/currency";
import { can } from "@/lib/roles";
import { exportReport } from "@/lib/report-export";
import type { Database } from "@/integrations/supabase/types";
import { useOrg } from "./org-context";
import { useAlerts, useTransactions } from "./data";
import { useMonitoringRecords, useScan } from "./monitoring-data";
import { RiskBadge } from "./RiskBadge";
import { EvidenceFiles } from "./EvidenceFiles";

type RecordRow=Database["public"]["Tables"]["monitoring_records"]["Row"];
const payload=(r:MonitorRecord):Record<string,unknown>=>r.payload && typeof r.payload==="object" ? r.payload as Record<string,unknown> : {};
const num=(p:Record<string,unknown>,k:string)=>Number(p[k]??0);
export function MonitoringWorkspace({title,kinds}:{title:string;kinds:RecordKind[]}) {
  const {current}=useOrg();const records=useMonitoringRecords();const alerts=useAlerts();const txns=useTransactions();const scan=useScan();
  const [kind,setKind]=useState<RecordKind>(kinds[0]??"expense");const [search,setSearch]=useState("");const [month,setMonth]=useState(new Date().toISOString().slice(0,7));
  const [selected,setSelected]=useState<string|null>(null);const [editor,setEditor]=useState<{record:RecordRow|null}|null>(null);
  const all=records.data??[];const active=activeRecords(all);const selectedRecord=all.find(r=>r.id===selected);
  const relevant=active.filter(r=>r.kind===kind);const rows=relevant.filter(r=>(kind==="supplier"||kind==="control"||r.record_date.startsWith(month))&&(!search||JSON.stringify([r.label,r.payload]).toLowerCase().includes(search.toLowerCase())));
  const rowAlerts=(id:string)=>(alerts.data??[]).filter(a=>a.monitoring_record_id===id);
  const unresolved=(alerts.data??[]).filter(a=>a.monitoring_record_id&&all.some(r=>r.id===a.monitoring_record_id&&kinds.includes(r.kind as RecordKind))&&!["resolved","dismissed"].includes(a.status));
  const writer=can.triage(current?.role);
  if(!can.viewAll(current?.role))return <p className="p-6 text-sm text-muted-foreground">This information is restricted to the finance and audit team.</p>;
  function summary(r:RecordRow):string[]{
    const p=payload(r);const money=(v:number)=>fmtMoney(v,r.currency);
    if(r.kind==="expense"||r.kind==="budget")return [String(p["category"]??"—"),String(p["employee"]??"—"),money(num(p,"amount"))];
    if(r.kind==="cash")return [money(num(p,"cash_sales")+num(p,"electronic_sales")),money(num(p,"cash_received")+num(p,"electronic_received")),money(num(p,"cash_deposited")+num(p,"electronic_deposited")),money(num(p,"cash_received")+num(p,"electronic_received")-num(p,"cash_deposited")-num(p,"electronic_deposited"))];
    if(r.kind==="supplier")return [String(p["registration"]||"Not recorded"),p["bank_account"]?`•••• ${String(p["bank_account"]).slice(-4)}`:"Not recorded",String(p["bank_approved"]??"unknown")];
    if(r.kind==="inventory"){const expected=num(p,"opening")+num(p,"purchased")-num(p,"sold")+num(p,"adjustment")+num(p,"transfer_in")-num(p,"transfer_out");return [String(p["sku"]),String(expected),String(p["physical"]),String(num(p,"physical")-expected)];}
    const t=txns.data?.find(t=>t.id===r.transaction_id);return [String(p["purpose"]??"—").replace(/_/g," "),t?.employee??"Not recorded",t?fmtMoney(t.amount,t.currency):"Missing transaction",String(p["authorised"]??"unknown")];
  }
  const headers:Record<RecordKind,string[]>={expense:["Category","Employee","Amount"],budget:["Category","Employee","Budget"],cash:["Net sales","Receipts","Deposits","Deposit gap"],supplier:["Registration","Bank account","Approved"],inventory:["SKU","Expected","Physical","Difference"],control:["Activity","Employee","Amount","Authorised"]};
  const ancestors:string[]=[];let predecessor=selectedRecord?.replaces_id;while(predecessor&&!ancestors.includes(predecessor)){ancestors.push(predecessor);predecessor=all.find(r=>r.id===predecessor)?.replaces_id;}
  const comparisons=kind==="expense"?Array.from(new Set(active.filter(r=>r.kind==="expense"||r.kind==="budget").map(r=>`${String(payload(r)["category"]??"")}|${r.currency}`))).map(key=>{const [category="",currency="ZAR"]=key.split("|");const group=active.filter(r=>String(payload(r)["category"]).toLowerCase()===category.toLowerCase()&&r.currency===currency);const sum=(period:string)=>group.filter(r=>r.kind==="expense"&&r.record_date.startsWith(period)).reduce((s,r)=>s+num(payload(r),"amount"),0);const budget=group.find(r=>r.kind==="budget"&&r.record_date.startsWith(month));return {category,currency,current:sum(month),previous:sum(priorMonth(`${month}-01`)),budget:budget?num(payload(budget),"amount"):null};}):[];
  const download=(format:"pdf"|"xlsx")=>exportReport(format,`FINANCIAL IQ ${title} ${month}`,[{title:"Records",rows:rows.map(r=>({label:r.label,date:r.record_date,currency:r.currency,...payload(r)}))},{title:"Risk indicators",rows:unresolved.map(a=>({code:a.code,risk:a.risk_level,score:a.score,title:a.title,evidence:a.evidence}))}]).catch(()=>toast.error("Report export failed"));
  return <div className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-extrabold">{title}</h1><div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" title="Download PDF report" onClick={()=>download("pdf")}><Download className="size-4"/>PDF</Button><Button variant="outline" size="sm" title="Download Excel report" onClick={()=>download("xlsx")}><Download className="size-4"/>Excel</Button>
      {writer&&<><Button variant="outline" size="sm" disabled={scan.isPending} onClick={()=>current&&scan.mutate({data:{orgId:current.org_id}})}><ScanLine className="size-4"/>{scan.isPending?"Analysing…":"Run analysis"}</Button><Button size="sm" onClick={()=>setEditor({record:null})}><Plus className="size-4"/>Add {KIND_LABEL[kind].toLowerCase()}</Button></>}
    </div></header>
    <div className="grid grid-cols-3 divide-x border-y py-4"><div className="px-3"><div className="text-xs text-muted-foreground">Active records</div><div className="font-mono text-2xl">{active.filter(r=>kinds.includes(r.kind as RecordKind)).length}</div></div><div className="px-3"><div className="text-xs text-muted-foreground">Open indicators</div><div className="font-mono text-2xl text-risk-high">{unresolved.length}</div></div><div className="px-3"><div className="text-xs text-muted-foreground">High / critical</div><div className="font-mono text-2xl text-risk-critical">{unresolved.filter(a=>["HIGH","CRITICAL"].includes(a.risk_level)).length}</div></div></div>
    <div className="flex flex-wrap items-center gap-3">{kinds.length>1&&<Tabs value={kind} onValueChange={v=>setKind(v as RecordKind)}><TabsList>{kinds.map(k=><TabsTrigger key={k} value={k}>{KIND_LABEL[k]}s</TabsTrigger>)}</TabsList></Tabs>}
      <Input aria-label="Search monitoring records" placeholder="Search records…" value={search} onChange={e=>setSearch(e.target.value)} className="h-9 max-w-xs"/>
      {kind!=="supplier"&&kind!=="control"&&<Input type="month" aria-label="Reporting month" value={month} onChange={e=>e.target.value&&setMonth(e.target.value)} className="h-9 w-44"/>}
    </div>
    {(records.isError||alerts.isError||txns.isError)&&<p role="alert" className="text-sm text-destructive">Records could not be loaded. Refresh before analysing this business.</p>}
    {comparisons.length>0&&<section><h2 className="mb-2 text-sm font-bold">Expense period comparison · {month}</h2><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted text-left"><tr>{["Category / currency","Previous month","Current month","Change","Budget","Remaining"].map(h=><th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{comparisons.map((c,i)=><tr className="border-b" key={i}><td className="p-2 font-medium">{c.category||"Uncategorised"} · {c.currency}</td><td className="p-2 font-mono">{fmtMoney(c.previous,c.currency)}</td><td className="p-2 font-mono">{fmtMoney(c.current,c.currency)}</td><td className="p-2">{c.previous?`${Math.round((c.current/c.previous-1)*100)}%`:"Insufficient prior data"}</td><td className="p-2">{c.budget===null?"Not set":fmtMoney(c.budget,c.currency)}</td><td className={`p-2 ${c.budget!==null&&c.current>c.budget?"text-risk-high":""}`}>{c.budget===null?"Unknown":fmtMoney(c.budget-c.current,c.currency)}</td></tr>)}</tbody></table></div></section>}
    <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted text-left text-muted-foreground"><tr>{["Date","Record",...headers[kind],"Risk",""].map((h,i)=><th className="whitespace-nowrap px-3 py-3" key={i}>{h}</th>)}</tr></thead><tbody>
      {records.isLoading&&<tr><td colSpan={8} className="py-10 text-center text-muted-foreground">Loading records…</td></tr>}
      {!records.isLoading&&!rows.length&&<tr><td colSpan={8} className="py-12 text-center text-muted-foreground">No {KIND_LABEL[kind].toLowerCase()} records for this selection.</td></tr>}
      {rows.map(r=>{const flags=rowAlerts(r.id).sort((a,b)=>b.score-a.score);return <tr key={r.id} className="border-b"><td className="whitespace-nowrap px-3 py-3 font-mono">{r.record_date}</td><td className="min-w-40 px-3 py-3 font-semibold"><Button className="h-auto whitespace-normal p-0 text-left text-xs" variant="link" onClick={()=>setSelected(r.id)}>{r.label}</Button>{r.replaces_id&&<div className="text-[10px] font-normal text-muted-foreground">Corrected record</div>}</td>{summary(r).map((v,i)=><td key={i} className="whitespace-nowrap px-3 py-3">{v}</td>)}<td className="px-3 py-3"><RiskBadge level={flags[0]?.risk_level??null}/></td><td><Button variant="ghost" size="sm" onClick={()=>setSelected(r.id)}>Review</Button></td></tr>;})}
    </tbody></table></div>
    <Sheet open={!!selectedRecord} onOpenChange={o=>!o&&setSelected(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-xl">{selectedRecord&&<><SheetHeader><SheetTitle>{selectedRecord.label}</SheetTitle><SheetDescription>{selectedRecord.record_date} · {selectedRecord.currency} · {KIND_LABEL[selectedRecord.kind as RecordKind]}</SheetDescription></SheetHeader><div className="space-y-5 px-4 pb-6">
      {writer&&active.some(r=>r.id===selectedRecord.id)&&<Button variant="outline" size="sm" onClick={()=>{setSelected(null);setEditor({record:selectedRecord});}}><Pencil className="size-4"/>Append correction</Button>}
      <dl className="grid grid-cols-2 gap-2 text-xs">{Object.entries(payload(selectedRecord)).map(([k,v])=><div key={k} className="contents"><dt className="text-muted-foreground">{k.replace(/_/g," ")}</dt><dd className="break-all">{v===null||v===""?"Not recorded":String(v)}</dd></div>)}</dl>
      {selectedRecord.transaction_id&&<section className="border-y py-3 text-xs"><h3 className="mb-1 font-semibold">Linked transaction</h3>{txns.data?.filter(t=>t.id===selectedRecord.transaction_id).map(t=><div key={t.id}>{t.txn_date} · {t.counterparty} · {fmtMoney(t.amount,t.currency)}<div className="text-muted-foreground">{t.invoice_ref??"No invoice"} · {t.employee??"Employee unknown"}</div></div>)}</section>}
      {rowAlerts(selectedRecord.id).map(a=><section key={a.id} className="space-y-2 border-t pt-3"><div className="flex items-center gap-2"><AlertTriangle className="size-4 text-risk-high"/><RiskBadge level={a.risk_level}/><span className="font-mono text-xs">{a.code} · {a.score}/100</span></div><h3 className="text-sm font-semibold">{a.title}</h3><pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{JSON.stringify(a.evidence,null,2)}</pre><Link to="/investigations" className="text-xs font-semibold text-primary">Investigation cases →</Link></section>)}
      {!rowAlerts(selectedRecord.id).length&&<p className="text-xs text-muted-foreground">No stored risk indicators. Missing history, budgets or authorisation information can limit detection.</p>}
      <EvidenceFiles recordId={selectedRecord.id} ancestorIds={ancestors}/>
      {ancestors.length>0&&<section><h3 className="mb-2 text-sm font-semibold">Immutable correction history</h3>{ancestors.map(id=><Button key={id} variant="link" className="block h-auto whitespace-normal p-0 py-1 text-xs" onClick={()=>setSelected(id)}>{all.find(r=>r.id===id)?.label} · {id.slice(0,8)}</Button>)}</section>}
    </div></>}</SheetContent></Sheet>
    {editor&&<RecordEditor key={editor.record?.id??kind} kind={(editor.record?.kind??kind) as RecordKind} record={editor.record} onClose={()=>setEditor(null)} onSaved={id=>{setEditor(null);setSelected(id);}}/>}
  </div>;
}

function RecordEditor({kind,record,onClose,onSaved}:{kind:RecordKind;record:RecordRow|null;onClose:()=>void;onSaved:(id:string)=>void}) {
  const {current}=useOrg();const txns=useTransactions();const save=useServerFn(saveMonitoringRecord);const scan=useScan();const qc=useQueryClient();
  const [label,setLabel]=useState(record?.label??"");const [date,setDate]=useState(record?.record_date??new Date().toISOString().slice(0,10));const [currency,setCurrency]=useState(record?.currency??current?.organizations.base_currency??"ZAR");
  const [transaction,setTransaction]=useState(record?.transaction_id??"none");const [values,setValues]=useState<Record<string,unknown>>(record?payload(record):Object.fromEntries(FIELDS[kind].map(f=>[f.key,f.type==="approval"?"unknown":f.type==="purpose"?"payment":""])));
  const mutation=useMutation({mutationFn:save,onSuccess:async r=>{await qc.invalidateQueries({queryKey:["monitoring"]});onSaved(r.id);toast.success("Record saved; original history preserved");if(current)scan.mutate({data:{orgId:current.org_id}});},onError:e=>toast.error(e.message)});
  return <Dialog open onOpenChange={o=>!o&&onClose()}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{record?"Append correction":"Add"} · {KIND_LABEL[kind]}</DialogTitle><DialogDescription>{record?"The previous version remains in the audit history.":kind==="cash"?"Net sales exclude refunds. Deposit timing differences remain subject to review.":"Record the business evidence available for this period."}</DialogDescription></DialogHeader>
    <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();if(!current)return;mutation.mutate({data:{orgId:current.org_id,kind,label,record_date:date,currency,payload:values,transaction_id:transaction==="none"?null:transaction,replaces_id:record?.id??null}});}}>
      <div className="space-y-1"><Label htmlFor="monitor-label">{kind==="supplier"?"Supplier name":kind==="cash"?"Location / till":kind==="inventory"?"Stock location / count name":"Record name"}</Label><Input id="monitor-label" required maxLength={160} value={label} onChange={e=>setLabel(e.target.value)}/></div>
      <div className="space-y-1"><Label htmlFor="monitor-date">{kind==="budget"?"Budget month (any date in month)":"Date"}</Label><Input id="monitor-date" type="date" required value={date} onChange={e=>setDate(e.target.value)}/></div>
      <div className="space-y-1"><Label>Currency</Label><Select value={currency} onValueChange={setCurrency}><SelectTrigger aria-label="Record currency"><SelectValue/></SelectTrigger><SelectContent>{CURRENCIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
      {(kind==="control"||kind==="expense")&&<div className="space-y-1"><Label>Linked transaction {kind==="control"?"(required)":"(optional)"}</Label><Select value={transaction} onValueChange={v=>{setTransaction(v);const t=txns.data?.find(t=>t.id===v);if(t)setCurrency(t.currency);}}><SelectTrigger aria-label="Linked transaction"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Not linked</SelectItem>{(txns.data??[]).map(t=><SelectItem key={t.id} value={t.id}>{t.txn_date} · {t.counterparty} · {fmtMoney(t.amount,t.currency)}</SelectItem>)}</SelectContent></Select></div>}
      {FIELDS[kind].map(f=><div className="space-y-1" key={f.key}><Label htmlFor={`field-${f.key}`}>{f.label}</Label>{f.type==="approval"||f.type==="purpose"?<Select disabled={f.key==="bank_approved"&&current?.role!=="admin"} value={String(values[f.key]??"unknown")} onValueChange={v=>setValues(p=>({...p,[f.key]:v}))}><SelectTrigger id={`field-${f.key}`}><SelectValue/></SelectTrigger><SelectContent>{(f.type==="approval"?["unknown","yes","no"]:["payment","expense_claim","refund","cash_withdrawal"]).map(v=><SelectItem key={v} value={v}>{v.replace(/_/g," ")}</SelectItem>)}</SelectContent></Select>:<Input id={`field-${f.key}`} type={f.type} step={f.type==="number"?"any":undefined} min={f.type==="number"&&f.key!=="adjustment"?0:undefined} required={f.type==="number"&&f.key!=="employee_limit"||f.key==="category"||f.key==="sku"} value={String(values[f.key]??"")} onChange={e=>setValues(p=>({...p,[f.key]:e.target.value}))}/>}</div>)}
      <div className="col-span-full flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={mutation.isPending||kind==="control"&&transaction==="none"}>Save & analyse</Button></div>
    </form></DialogContent></Dialog>;
}