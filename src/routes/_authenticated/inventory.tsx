import { createFileRoute } from "@tanstack/react-router";
import { MonitoringWorkspace } from "@/components/fiq/MonitoringWorkspace";
import { pageHead } from "@/lib/page-head";
export const Route=createFileRoute("/_authenticated/inventory")({head:()=>pageHead("Inventory Irregularities","Compare physical inventory with purchased, sold, adjusted and transferred stock."),component:()=> <MonitoringWorkspace title="Inventory Irregularities" kinds={["inventory"]}/>});