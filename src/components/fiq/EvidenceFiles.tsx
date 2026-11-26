import { useState } from "react";
import { FileText, Upload, ExternalLink } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/roles";
import { useOrg } from "./org-context";
import { useEvidenceDocuments, useScan } from "./monitoring-data";

export function EvidenceFiles({caseId,recordId,ancestorIds=[]}:{caseId?:string;recordId?:string;ancestorIds?:string[]}) {
  const {current}=useOrg();const documents=useEvidenceDocuments();const qc=useQueryClient();const scan=useScan();const [busy,setBusy]=useState(false);
  const files=(documents.data??[]).filter(d=>caseId?d.case_id===caseId:d.record_id===recordId||(d.record_id&&ancestorIds.includes(d.record_id)));
  async function upload(file:File) {
    if(!current||(!caseId&&!recordId))return;setBusy(true);
    try{
      if(file.size>10*1024*1024)throw new Error("Files must be 10 MB or smaller");
      const path=`${current.org_id}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const result=await supabase.storage.from("fiq-evidence").upload(path,file,{upsert:false});if(result.error)throw result.error;
      const {data:user,error:authError}=await supabase.auth.getUser();if(authError||!user.user)throw new Error("Sign in again before attaching evidence");
      const saved=await supabase.from("evidence_documents").insert({org_id:current.org_id,case_id:caseId??null,record_id:recordId??null,storage_path:path,filename:file.name,created_by:user.user.id});if(saved.error)throw saved.error;
      await qc.invalidateQueries({queryKey:["evidence"]});toast.success("Evidence attached");if(recordId)scan.mutate({data:{orgId:current.org_id}});
    }catch(e){toast.error(e instanceof Error?e.message:"Could not attach evidence");}finally{setBusy(false);}
  }
  async function open(path:string){try{const r=await supabase.storage.from("fiq-evidence").createSignedUrl(path,120);if(r.error)throw r.error;if(r.data?.signedUrl)window.open(r.data.signedUrl,"_blank","noopener,noreferrer");}catch{toast.error("Could not open evidence");}}
  return <section className="space-y-2"><h3 className="text-sm font-semibold">Supporting documents</h3>
    {documents.isError&&<p className="text-xs text-destructive">Supporting documents could not be loaded.</p>}
    {files.length===0&&<p className="text-xs text-muted-foreground">No supporting documents attached.</p>}
    {files.map(d=><div key={d.id} className="flex items-center gap-2 border-b py-2 text-xs"><FileText className="size-4 shrink-0 text-muted-foreground"/><span className="min-w-0 flex-1 break-all">{d.filename}</span><Button size="icon" variant="ghost" aria-label={`Open ${d.filename}`} title="Open supporting document" onClick={()=>open(d.storage_path)}><ExternalLink className="size-4"/></Button></div>)}
    {can.triage(current?.role)&&<label className="flex items-center gap-2 text-xs"><Upload className="size-4"/><Input aria-label="Attach supporting document" disabled={busy} type="file" accept=".pdf,.jpg,.jpeg,.png,.txt,.csv" className="h-9 text-xs" onChange={e=>{const file=e.target.files?.[0];if(file)upload(file);e.target.value="";}}/></label>}
  </section>;
}