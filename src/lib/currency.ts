// Indicative FX rates to ZAR for display only; stored amounts keep their original currency.
export const FX_TO_ZAR: Record<string, number> = { ZAR: 1, USD: 18.1, EUR: 19.6, GBP: 23.0, BWP: 1.33, NAD: 1 };
export const CURRENCIES = Object.keys(FX_TO_ZAR);

export function convert(amount: number, from: string, to: string) {
  const f = FX_TO_ZAR[from] ?? 1;
  const t = FX_TO_ZAR[to] ?? 1;
  return (amount * f) / t;
}

export function fmtMoney(amount: number, currency: string, compact = false) {
  const locale = currency === "ZAR" ? "en-ZA" : "en-GB";
  return new Intl.NumberFormat(locale, {
    style: "currency", currency, maximumFractionDigits: compact ? 1 : 2,
    notation: compact ? "compact" : "standard",
  }).format(amount);
}
