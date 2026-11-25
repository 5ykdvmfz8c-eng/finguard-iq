import { describe, expect, it } from "vitest";
import { detect, levelForScore, type EngineTxn } from "./fraud-engine";

const t = (p: Partial<EngineTxn> & { id: string }): EngineTxn => ({
  txn_date: "2026-11-01", amount: 1000, currency: "ZAR", direction: "outflow",
  counterparty: "Acme Supplies", invoice_ref: null, employee: "Sipho", payment_method: "EFT", ...p,
});

describe("fraud engine", () => {
  it("maps scores to LOW/MEDIUM/HIGH/CRITICAL", () => {
    expect([levelForScore(10), levelForScore(30), levelForScore(60), levelForScore(80)]).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  });

  it("flags same supplier paid R8,500 twice on the same invoice as CRITICAL", () => {
    const a = t({ id: "a", amount: 8500, invoice_ref: "INV-100" });
    const b = t({ id: "b", amount: 8500, invoice_ref: "INV-100", txn_date: "2026-11-05" });
    const f = detect([b], [a], { approvalLimit: 50000 });
    expect(f[0]?.alert_type).toBe("duplicate_invoice");
    expect(f[0]?.risk_level).toBe("CRITICAL");
  });

  it("flags same supplier + same amount within 3 days", () => {
    const f = detect([t({ id: "b", amount: 4200, txn_date: "2026-11-02" })], [t({ id: "a", amount: 4200 })], { approvalLimit: 50000 });
    expect(f.some((x) => x.alert_type === "duplicate_amount" && x.risk_level === "HIGH")).toBe(true);
  });

  it("flags payments split to stay under the approval limit", () => {
    const f = detect([t({ id: "c", amount: 24000, txn_date: "2026-11-02" })], [t({ id: "a", amount: 26000 }), t({ id: "b", amount: 23000 })], { approvalLimit: 50000 });
    expect(f.some((x) => x.alert_type === "split_payment")).toBe(true);
  });

  it("does not flag different suppliers", () => {
    const f = detect([t({ id: "b", counterparty: "Other Co", invoice_ref: "INV-1" })], [t({ id: "a", invoice_ref: "INV-1" })], { approvalLimit: 50000 });
    expect(f).toHaveLength(0);
  });
});
