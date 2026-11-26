import { createFileRoute } from "@tanstack/react-router";
import { MonitoringWorkspace } from "@/components/fiq/MonitoringWorkspace";
import { pageHead } from "@/lib/page-head";
export const Route=createFileRoute("/_authenticated/monitoring")({head:()=>pageHead("Employee & Supplier Monitoring","Supplier account checks, banking approval and employee transaction controls."),component:()=> <MonitoringWorkspace title="Employee & Supplier Monitoring" kinds={["supplier","control"]}/>});