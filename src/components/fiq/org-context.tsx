import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OrgRole } from "@/lib/roles";

export interface Membership { org_id: string; role: OrgRole; organizations: { id: string; name: string; base_currency: string; approval_limit: number } }

interface Ctx {
  memberships: Membership[];
  current: Membership | undefined;
  setCurrent: (id: string) => void;
  displayCurrency: string;
  setDisplayCurrency: (c: string) => void;
  loading: boolean;
}
const OrgCtx = createContext<Ctx | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState("ZAR");
  useEffect(() => {
    setCurrentId(localStorage.getItem("fiq.org"));
    setDisplayCurrency(localStorage.getItem("fiq.ccy") ?? "ZAR");
  }, []);

  const q = useQuery({
    queryKey: ["memberships"],
    queryFn: async () => {
      await supabase.rpc("accept_pending_invites");
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("org_members")
        .select("org_id, role, organizations(id, name, base_currency, approval_limit)")
        .eq("user_id", u.user?.id ?? "");
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });
  const memberships = q.data ?? [];
  const current = memberships.find((m) => m.org_id === currentId) ?? memberships[0];

  const value = useMemo<Ctx>(() => ({
    memberships, current, loading: q.isLoading, displayCurrency,
    setCurrent: (id) => { localStorage.setItem("fiq.org", id); setCurrentId(id); qc.invalidateQueries(); },
    setDisplayCurrency: (c) => { localStorage.setItem("fiq.ccy", c); setDisplayCurrency(c); },
  }), [memberships, current, q.isLoading, displayCurrency, qc]);
  return <OrgCtx.Provider value={value}>{children}</OrgCtx.Provider>;
}

export function useOrg() {
  const c = useContext(OrgCtx);
  if (!c) throw new Error("useOrg outside OrgProvider");
  return c;
}
