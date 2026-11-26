import { createFileRoute } from "@tanstack/react-router";
import { MonitoringWorkspace } from "@/components/fiq/MonitoringWorkspace";
import { pageHead } from "@/lib/page-head";
export const Route=createFileRoute("/_authenticated/cash")({head:()=>pageHead("Cash Reconciliation","Reconcile cash and electronic sales, receipts, deposits and refunds."),component:()=> <MonitoringWorkspace title="Cash & Sales Reconciliation" kinds={["cash"]}/>});