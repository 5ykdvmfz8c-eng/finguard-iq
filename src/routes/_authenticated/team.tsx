import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrg } from "@/components/fiq/org-context";
import { ROLE_LABEL, can, type OrgRole } from "@/lib/roles";
import { fmtMoney } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team & Roles — FINANCIAL IQ" },
      { name: "description", content: "Manage administrators, financial managers, auditors and employees." },
      { property: "og:title", content: "Team & Roles — FINANCIAL IQ" },
      { property: "og:description", content: "Manage administrators, financial managers, auditors and employees." },
    ],
  }),
  component: TeamPage,
});

const ROLES = Object.keys(ROLE_LABEL) as OrgRole[];
const DESC: Record<OrgRole, string> = {
  admin: "Full access, settings and team management", financial_manager: "Transactions, alerts and investigations",
  auditor: "Read-only access to all records", employee: "Records transactions; sees only their own",
};

function TeamPage() {
  const { current } = useOrg();
  const qc = useQueryClient();
  const admin = can.manageTeam(current?.role);
  const orgId = current?.org_id;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("employee");
  const [limit, setLimit] = useState<string>("");

  const members = useQuery({ queryKey: ["members", orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from("org_members").select("*").eq("org_id", orgId!).order("created_at")).data ?? [] });
  const invites = useQuery({ queryKey: ["invites", orgId], enabled: !!orgId && admin,
    queryFn: async () => (await supabase.from("org_invites").select("*").eq("org_id", orgId!)).data ?? [] });

  const run = (fn: () => PromiseLike<{ error: { message: string } | null }>, msg: string) => async () => {
    const { error } = await fn(); if (error) throw new Error(error.message); toast.success(msg); qc.invalidateQueries();
  };
  const m = useMutation({ mutationFn: (f: () => Promise<void>) => f(), onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") });

  return (
    <div className="space-y-3">
      <div className="px-1"><h1 className="text-2xl font-extrabold tracking-tight">Team & Roles</h1>
        <p className="text-xs text-muted-foreground">{current?.organizations.name} · base currency {current?.organizations.base_currency}</p></div>
      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-bold">Members</h2>
          <div className="divide-y">
            {(members.data ?? []).map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{u.email ?? u.user_id}</div><div className="text-xs text-muted-foreground">{DESC[u.role]}</div></div>
                {admin ? (
                  <Select value={u.role} onValueChange={(v) => m.mutate(run(() => supabase.from("org_members").update({ role: v as OrgRole }).eq("id", u.id), "Role updated"))}>
                    <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent></Select>
                ) : <span className="rounded bg-muted px-2 py-1 text-xs">{ROLE_LABEL[u.role]}</span>}
                {admin && <Button size="icon" variant="ghost" aria-label="Remove member" onClick={() => m.mutate(run(() => supabase.from("org_members").delete().eq("id", u.id), "Member removed"))}><Trash2 className="size-4" /></Button>}
              </div>
            ))}
          </div>
          {admin && (invites.data ?? []).length > 0 && <>
            <h3 className="mb-2 mt-5 text-xs font-bold text-muted-foreground">Pending invitations</h3>
            {(invites.data ?? []).map((i) => (
              <div key={i.id} className="flex items-center justify-between py-1.5 text-sm"><span>{i.email} · {ROLE_LABEL[i.role]}</span>
                <Button size="sm" variant="ghost" onClick={() => m.mutate(run(() => supabase.from("org_invites").delete().eq("id", i.id), "Invitation cancelled"))}>Cancel</Button></div>))}
          </>}
        </section>
        {admin && <div className="space-y-3">
          <form className="space-y-3 rounded-xl border bg-card p-4" onSubmit={async (e) => {
            e.preventDefault();
            const { data: u } = await supabase.auth.getUser();
            m.mutate(run(() => supabase.from("org_invites").insert({ org_id: orgId!, email: email.trim().toLowerCase(), role, invited_by: u.user!.id }), "Invitation saved — they join when they sign in with this email"));
            setEmail("");
          }}>
            <h2 className="text-sm font-bold">Invite a colleague</h2>
            <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent></Select></div>
            <Button className="w-full">Add invitation</Button>
            <p className="text-[11px] text-muted-foreground">They'll be added automatically the next time they sign in with a verified email.</p>
          </form>
          <form className="space-y-3 rounded-xl border bg-card p-4" onSubmit={(e) => { e.preventDefault();
            m.mutate(run(() => supabase.from("organizations").update({ approval_limit: Number(limit) }).eq("id", orgId!), "Approval limit saved")); }}>
            <h2 className="text-sm font-bold">Payment approval limit</h2>
            <p className="text-[11px] text-muted-foreground">Current: {fmtMoney(Number(current?.organizations.approval_limit ?? 0), current?.organizations.base_currency ?? "ZAR")}. Payments above this, or several smaller ones that add up past it, are flagged.</p>
            <Input type="number" min={1} required value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="50000" />
            <Button variant="outline" className="w-full">Save limit</Button>
          </form>
        </div>}
      </div>
    </div>
  );
}
