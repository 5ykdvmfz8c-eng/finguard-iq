import { describe, expect, it } from "vitest";
import { analyseMonitoring, combineScores } from "./monitoring-engine";
import type { MonitorRecord } from "./monitoring-model";
const record=(kind:string,payload:unknown):MonitorRecord=>({id:"r1",kind,label:"Review",record_date:"2026-11-26",currency:"ZAR",transaction_id:null,replaces_id:null,payload});
describe("monitoring rules",()=>{
  it("flags expenses without documentation but not documented ones",()=>{
    const r=record("expense",{category:"Travel",employee:"Employee A",amount:8500,claim_ref:"C1",reason:"Travel"});
    expect(analyseMonitoring([r],[],new Set())[0]?.factors.map(f=>f.rule)).toContain("missing_documentation");
    expect(analyseMonitoring([r],[],new Set([r.id]))).toHaveLength(0);
  });
  it("identifies recorded-sales cash shortages",()=>{
    const r=record("cash",{cash_sales:8500,electronic_sales:0,cash_received:8000,electronic_received:0,cash_deposited:8000,electronic_deposited:0,refunds:0,reason:""});
    expect(analyseMonitoring([r],[],new Set())[0]?.factors.find(f=>f.rule==="cash_shortage")?.values["shortage"]).toBe(500);
  });
  it("reconciles purchased, sold and physical stock",()=>{
    const r=record("inventory",{sku:"A",opening:100,purchased:20,sold:30,adjustment:0,transfer_in:0,transfer_out:0,physical:85,unit_cost:10,reason:""});
    expect(analyseMonitoring([r],[],new Set())[0]?.factors.find(f=>f.rule==="stock_discrepancy")?.values).toMatchObject({expected:90,physical:85,difference:-5});
  });
  it("requires approval for changed supplier bank details",()=>{
    const old=record("supplier",{registration:"ABC",bank_account:"123",bank_approved:"yes",reason:""});
    const changed={...old,id:"r2",replaces_id:old.id,payload:{registration:"ABC",bank_account:"456",bank_approved:"no",reason:""}};
    expect(analyseMonitoring([old,changed],[],new Set())[0]?.factors.map(f=>f.rule)).toContain("bank_change");
  });
  it("combines independent risk factors without exceeding 100",()=>{
    expect(combineScores([75,55])).toBe(86);
    expect(combineScores([92,80,70])).toBe(100);
  });
});