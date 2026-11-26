import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordSchema } from "./monitoring-model";
import { analyseMonitoring, combineScores } from "./monitoring-engine";
import { detect, levelForScore, type EngineTxn } from "./fraud-engine";

export const saveMonitoringRecord = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => recordSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { orgId, ...record } = data;
    if (record.kind === "control" && !record.transaction_id) throw new Error("Choose the linked transaction");
    const { data: saved, error } = await context.supabase.from("monitoring_records").insert({ ...record, org_id:orgId, created_by:context.userId }).select().single();
    if (error) throw new Error(error.message);
    return saved;
  });

export const runMonitoring = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orgId:z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_org_role", { _org:data.orgId,_user:context.userId,_roles:["admin","financial_manager"] });
    if (roleError || !allowed) throw new Error("Only administrators and financial managers can run detection");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    // Paginate every source: a scan must not silently stop at the API row limit.
    async function allRows<T>(fetchPage: (start:number,end:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>) {
      const rows:T[]=[]; for(let start=0;;start+=500){const result=await fetchPage(start,start+499);if(result.error)throw new Error(result.error.message);rows.push(...(result.data??[]));if((result.data?.length??0)<500)break;} return rows;
    }
    const [records, txns, documents, alerts, audit, orgResult] = await Promise.all([
      allRows((s,e)=>db.from("monitoring_records").select("*").eq("org_id",data.orgId).order("id").range(s,e)),
      allRows((s,e)=>db.from("transactions").select("*").eq("org_id",data.orgId).order("created_at").order("id").range(s,e)),
      allRows((s,e)=>db.from("evidence_documents").select("record_id").eq("org_id",data.orgId).order("id").range(s,e)),
      allRows((s,e)=>db.from("alerts").select("*").eq("org_id",data.orgId).order("id").range(s,e)),
      allRows((s,e)=>db.from("audit_events").select("entity,entity_id,before_data,after_data,action").eq("org_id",data.orgId).eq("entity","transactions").eq("action","UPDATE").order("id").range(s,e)),
      db.from("organizations").select("approval_limit").eq("id",data.orgId).single(),
    ]);
    if(orgResult.error)throw new Error(orgResult.error.message);
    const engineTxns:EngineTxn[]=txns.map(t=>({...t,direction:t.direction==="inflow"?"inflow":"outflow",amount:Number(t.amount)}));
    const adjustments=new Map<string,number>();
    for(const a of audit){const before=a.before_data as Record<string,unknown>|null;const after=a.after_data as Record<string,unknown>|null; if(before&&after&&["amount","txn_date","counterparty","invoice_ref","employee","description"].some(k=>before[k]!==after[k]))adjustments.set(a.entity_id,(adjustments.get(a.entity_id)??0)+1);}
    const extended=analyseMonitoring(records,engineTxns,new Set(documents.flatMap(d=>d.record_id?[d.record_id]:[])),adjustments);
    const base=detect(engineTxns,engineTxns,{approvalLimit:Number(orgResult.data.approval_limit)});
    const inserts=[];
    const known=new Set(alerts.flatMap(a=>a.detection_key?[a.detection_key]:a.transaction_id?[`txn:${a.transaction_id}:${a.alert_type}`]:[]));
    for(const f of base){const key=`txn:${f.transaction_id}:${f.alert_type}`;if(known.has(key))continue; known.add(key);inserts.push({org_id:data.orgId,code:`ALT-${crypto.randomUUID().slice(0,8).toUpperCase()}`,detection_key:key,transaction_id:f.transaction_id,related_ids:f.related_ids,alert_type:f.alert_type,score:f.score,risk_level:f.risk_level,title:f.title,evidence:JSON.parse(JSON.stringify(f.evidence))});}
    for(const f of extended){const key=`record:${f.recordId}`;if(known.has(key))continue;known.add(key);inserts.push({org_id:data.orgId,code:`ALT-${crypto.randomUUID().slice(0,8).toUpperCase()}`,detection_key:key,monitoring_record_id:f.recordId,transaction_id:f.transactionId,related_ids:f.relatedIds,alert_type:f.type,score:f.score,risk_level:f.riskLevel,title:f.title,evidence:JSON.parse(JSON.stringify({factors:f.factors,method:"Highest factor plus 20% of additional factors; capped at 100",certainty:"Indicators for human review, not a finding of fraud"}))});}
    for(let start=0;start<inserts.length;start+=200){const result=await db.from("alerts").upsert(inserts.slice(start,start+200),{onConflict:"org_id,detection_key",ignoreDuplicates:true});if(result.error)throw new Error(result.error.message);}
    const scores=new Map<string,number[]>();
    for(const f of base)scores.set(f.transaction_id,[...(scores.get(f.transaction_id)??[]),f.score]);
    for(const f of extended)if(f.transactionId)scores.set(f.transactionId,[...(scores.get(f.transactionId)??[]),f.score]);
    for(const [id,values] of scores){const t=txns.find(x=>x.id===id);const score=combineScores(values);if(t && score>t.risk_score){const result=await db.from("transactions").update({risk_score:score,risk_level:levelForScore(score)}).eq("org_id",data.orgId).eq("id",id);if(result.error)throw new Error(result.error.message);}}
    return {records:records.length,transactions:txns.length,newAlerts:inserts.length,findings:base.length+extended.length};
  });