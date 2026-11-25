import { describe, expect, it } from "vitest";
import { mapRows } from "./parse-upload";
describe("upload column mapping", () => {
  it("reads common headers and South African DD/MM/YYYY dates", () => {
    const { rows, errors } = mapRows([{ Date: "05/11/2026", Amount: "R 8,500.00", Supplier: "Acme", "Invoice No": "INV-1" }], "ZAR");
    expect(errors).toHaveLength(0);
    expect(rows[0]).toMatchObject({ txn_date: "2026-11-05", amount: 8500, currency: "ZAR", counterparty: "Acme", invoice_ref: "INV-1" });
  });
  it("rejects rows missing a supplier", () => {
    expect(mapRows([{ Date: "2026-11-05", Amount: 10 }], "ZAR").errors).toHaveLength(1);
  });
});
