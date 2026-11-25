import type { TxnInput } from "./ingest.functions";

// Realistic South African demo ledger with planted duplicates and split payments.
export function sampleLedger(today = new Date()): TxnInput[] {
  const d = (ago: number) => new Date(today.getTime() - ago * 86_400_000).toISOString().slice(0, 10);
  const suppliers = ["Mokoena Office Supplies", "Cape Fleet Services", "Ubuntu IT Solutions", "Durban Packaging Co", "Highveld Security", "Karoo Catering"];
  const staff = ["Thabo Nkosi", "Aisha Patel", "Johan van Wyk", "Lerato Dlamini"];
  const methods = ["EFT", "EFT", "Card", "Cash", "Cheque"];
  const rows: TxnInput[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 70; i++) {
    const sup = suppliers[i % suppliers.length]!;
    rows.push({
      txn_date: d(Math.floor(rnd() * 30) + 1), amount: Math.round((2000 + rnd() * 18000) / 10) * 10, currency: "ZAR",
      direction: "outflow", payment_method: methods[i % methods.length]!, frequency: i % 6 === 0 ? "monthly" : "once",
      employee: staff[i % staff.length]!, counterparty: sup, counterparty_type: "supplier",
      invoice_ref: `INV-${3000 + i}`, reference: `PAY-${5000 + i}`, description: "Operational expense",
    });
  }
  for (let i = 0; i < 12; i++) rows.push({
    txn_date: d(Math.floor(rnd() * 30) + 1), amount: Math.round(5000 + rnd() * 40000), currency: "ZAR", direction: "inflow",
    payment_method: "EFT", frequency: "once", employee: staff[i % staff.length]!, counterparty: `Customer ${i + 1}`,
    counterparty_type: "customer", invoice_ref: `SI-${800 + i}`, reference: null, description: "Sales receipt",
  });
  const base = { currency: "ZAR", direction: "outflow" as const, frequency: "once", counterparty_type: "supplier" as const, description: "Planted scenario" };
  rows.push(
    { ...base, txn_date: d(12), amount: 8500, payment_method: "EFT", employee: "Thabo Nkosi", counterparty: "Mokoena Office Supplies", invoice_ref: "INV-2041", reference: "PAY-9001" },
    { ...base, txn_date: d(5), amount: 8500, payment_method: "EFT", employee: "Thabo Nkosi", counterparty: "Mokoena Office Supplies (Pty) Ltd", invoice_ref: "INV-2041", reference: "PAY-9044" },
    { ...base, txn_date: d(9), amount: 26000, payment_method: "EFT", employee: "Johan van Wyk", counterparty: "Ubuntu IT Solutions", invoice_ref: "INV-7710", reference: "PAY-9010" },
    { ...base, txn_date: d(8), amount: 24500, payment_method: "EFT", employee: "Johan van Wyk", counterparty: "Ubuntu IT Solutions", invoice_ref: "INV-7711", reference: "PAY-9011" },
    { ...base, txn_date: d(8), amount: 19800, payment_method: "EFT", employee: "Johan van Wyk", counterparty: "Ubuntu IT Solutions", invoice_ref: "INV-7712", reference: "PAY-9012" },
    { ...base, txn_date: d(3), amount: 12750, payment_method: "Card", employee: "Lerato Dlamini", counterparty: "Karoo Catering", invoice_ref: null, reference: "PAY-9020" },
    { ...base, txn_date: d(2), amount: 12750, payment_method: "Card", employee: "Lerato Dlamini", counterparty: "Karoo Catering", invoice_ref: null, reference: "PAY-9021" },
    { ...base, txn_date: d(4), amount: 96000, payment_method: "EFT", employee: "Aisha Patel", counterparty: "Highveld Security", invoice_ref: "INV-5550", reference: "PAY-9030" },
    { ...base, txn_date: d(6), amount: 1450, currency: "USD", payment_method: "Card", employee: "Aisha Patel", counterparty: "CloudHost Inc", invoice_ref: "CH-881", reference: "PAY-9040" },
    { ...base, txn_date: d(1), amount: 1450, currency: "USD", payment_method: "Card", employee: "Aisha Patel", counterparty: "CloudHost Inc", invoice_ref: "CH-881", reference: "PAY-9041" },
  );
  return rows.sort((a, b) => a.txn_date.localeCompare(b.txn_date));
}
