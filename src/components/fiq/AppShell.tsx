import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeftRight, ChevronsLeft, ChevronsRight, LayoutGrid, LogOut, Siren, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CURRENCIES } from "@/lib/currency";
import { ROLE_LABEL } from "@/lib/roles";
import { Logo } from "./Logo";
import { OrgProvider, useOrg } from "./org-context";
import { Onboarding } from "./Onboarding";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutGrid },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/alerts", label: "Alerts & Incidents", icon: Siren },
  { to: "/team", label: "Team & Roles", icon: Users },
] as const;

export function AppShell() {
  return <OrgProvider><Shell /></OrgProvider>;
}

function Shell() {
  const { memberships, current, setCurrent, displayCurrency, setDisplayCurrency, loading } = useOrg();
  const [collapsed, setCollapsed] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading workspace…</div>;
  if (!current) return <Onboarding />;

  return (
    <div className="min-h-screen p-3 md:p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-2.5 md:gap-3">
        <Logo className="mr-2 text-[15px]" />
        <Select value={current.org_id} onValueChange={setCurrent}>
          <SelectTrigger className="h-8 w-auto min-w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{memberships.map((m) => <SelectItem key={m.org_id} value={m.org_id}>{m.organizations.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
          <SelectTrigger className="h-8 w-24 text-xs" aria-label="Display currency"><SelectValue /></SelectTrigger>
          <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground sm:inline">{ROLE_LABEL[current.role]}</span>
          <Button size="sm" variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth", search: { redirect: undefined } }); }}>
            <LogOut className="size-4" /><span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>
      <div className="flex gap-3">
        <aside className={`${collapsed ? "w-14" : "w-52"} hidden shrink-0 rounded-xl bg-sidebar p-2 text-sidebar-foreground transition-all md:block`}>
          <button onClick={() => setCollapsed(!collapsed)} className="mb-3 flex w-full items-center gap-2 rounded-md bg-sidebar-accent px-3 py-2 text-xs text-sidebar-accent-foreground">
            {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" />Hide panel</>}
          </button>
          <nav className="space-y-1">
            {NAV.map((n) => {
              const active = path.startsWith(n.to);
              return (
                <Link key={n.to} to={n.to} title={n.label}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors ${active ? "bg-sidebar-accent font-semibold text-sidebar-primary" : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}>
                  <n.icon className="size-4 shrink-0" />{!collapsed && n.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 pb-16 md:pb-0"><Outlet /></main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t bg-sidebar py-2 text-sidebar-foreground md:hidden">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} className={`flex flex-col items-center gap-0.5 text-[10px] ${path.startsWith(n.to) ? "text-sidebar-primary" : ""}`}>
            <n.icon className="size-5" />{n.label.split(" ")[0]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
