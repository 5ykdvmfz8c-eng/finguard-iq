import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { runMonitoring } from "@/lib/monitoring.functions";
import { can } from "@/lib/roles";
import { useOrg } from "./org-context";

export async function paginate<T>(fetchPage:(s:number,e:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>):Promise<T[]> {
  const rows:T[]=[];for(let s=0;;s+=500){const r=await fetchPage(s,s+499);if(r.error)throw new Error(r.error.message);rows.push(...(r.data??[]));if((r.data?.length??0)<500)break;}return rows;
}
export function useMonitoringRecords() {
  const {current}=useOrg(); const orgId=current?.org_id;
  return useQuery({queryKey:["monitoring",orgId],enabled:!!orgId&&can.viewAll(current?.role),queryFn:()=>orgId?paginate((s,e)=>supabase.from("monitoring_records").select("*").eq("org_id",orgId).order("record_date",{ascending:false}).order("id").range(s,e)):Promise.resolve([])});
}
export function useEvidenceDocuments() {
  const {current}=useOrg();const orgId=current?.org_id;
  return useQuery({queryKey:["evidence",orgId],enabled:!!orgId&&can.viewAll(current?.role),queryFn:()=>orgId?paginate((s,e)=>supabase.from("evidence_documents").select("*").eq("org_id",orgId).order("created_at").order("id").range(s,e)):Promise.resolve([])});
}
export function useCases() {
  const {current}=useOrg();const orgId=current?.org_id;
  return useQuery({queryKey:["cases",orgId],enabled:!!orgId&&can.viewAll(current?.role),queryFn:()=>orgId?paginate((s,e)=>supabase.from("investigations").select("*").eq("org_id",orgId).order("created_at",{ascending:false}).order("id").range(s,e)):Promise.resolve([])});
}
export function useAudit() {
  const {current}=useOrg();const orgId=current?.org_id;
  return useQuery({queryKey:["audit",orgId],enabled:!!orgId&&can.viewAll(current?.role),queryFn:()=>orgId?paginate((s,e)=>supabase.from("audit_events").select("*").eq("org_id",orgId).order("created_at",{ascending:false}).order("id").range(s,e)):Promise.resolve([])});
}
export function useScan() {
  const fn=useServerFn(runMonitoring);const qc=useQueryClient();
  return useMutation({mutationFn:fn,onSuccess:r=>{qc.invalidateQueries();toast.success(`Screened ${r.transactions} transactions and ${r.records} records · ${r.newAlerts} new alerts`);},onError:e=>toast.error(`Detection did not complete: ${e.message}`)});
}