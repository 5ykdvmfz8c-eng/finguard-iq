import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES } from "@/lib/currency";
import { Logo } from "./Logo";

export function Onboarding() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [ccy, setCcy] = useState("ZAR");
  const [busy, setBusy] = useState(false);
  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const { data, error } = await supabase.rpc("create_organization", { _name: name, _currency: ccy });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    localStorage.setItem("fiq.org", data as string);
    await qc.invalidateQueries({ queryKey: ["memberships"] });
  }
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <form onSubmit={create} className="w-full max-w-md space-y-5 rounded-xl border bg-card p-8">
        <Logo />
        <div><h1 className="text-xl font-bold">Set up your business account</h1>
          <p className="text-sm text-muted-foreground">You'll be the Administrator. Invite managers, auditors and employees afterwards. If a colleague invited you, ask them to use the email you signed in with.</p></div>
        <div className="space-y-1.5"><Label htmlFor="org">Business name</Label><Input id="org" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Karoo Logistics (Pty) Ltd" /></div>
        <div className="space-y-1.5"><Label>Base currency</Label>
          <Select value={ccy} onValueChange={setCcy}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
        <Button className="w-full" disabled={busy}>Create business account</Button>
      </form>
    </div>
  );
}
