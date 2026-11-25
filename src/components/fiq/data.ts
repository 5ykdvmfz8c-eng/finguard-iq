import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useOrg } from "./org-context";

export type Txn = Database["public"]["Tables"]["transactions"]["Row"];
export type Alert = Database["public"]["Tables"]["alerts"]["Row"];

export function useTransactions() {
  const { current } = useOrg();
  return useQuery({
    queryKey: ["transactions", current?.org_id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").eq("org_id", current!.org_id)
        .order("txn_date", { ascending: false }).order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
  });
}

export function useAlerts() {
  const { current } = useOrg();
  return useQuery({
    queryKey: ["alerts", current?.org_id],
    enabled: !!current && current.role !== "employee",
    queryFn: async () => {
      const { data, error } = await supabase.from("alerts").select("*").eq("org_id", current!.org_id)
        .order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
  });
}
