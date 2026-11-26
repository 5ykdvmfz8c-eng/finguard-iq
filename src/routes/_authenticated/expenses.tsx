import { createFileRoute } from "@tanstack/react-router";
import { MonitoringWorkspace } from "@/components/fiq/MonitoringWorkspace";
import { pageHead } from "@/lib/page-head";
export const Route=createFileRoute("/_authenticated/expenses")({head:()=>pageHead("Expense Analysis","Expense claims, documentation, monthly budgets and prior-period comparisons."),component:()=> <MonitoringWorkspace title="Expense Analysis" kinds={["expense","budget"]}/>});