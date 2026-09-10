const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat("en-IN");

/** ₹1,23,45,678 — Indian grouping, no paise. */
export const rupees = (n: number | string | null | undefined) => inr.format(Number(n ?? 0));
/** ₹1,234.55 — with paise, for prices. */
export const price = (n: number | string | null | undefined) => inr2.format(Number(n ?? 0));
export const integer = (n: number | string | null | undefined) => int.format(Number(n ?? 0));

/** "₹10 Cr", "₹25 L", "₹4.2 K" — for big numbers on the projector. */
export function compactRupees(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)} L`;
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)} K`;
  return `${sign}₹${trim(abs)}`;
}
const trim = (x: number) => (Math.round(x * 100) / 100).toString();

export function pct(n: number | string | null | undefined, digits = 2) {
  const v = Number(n ?? 0);
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
}
export function signed(n: number | string | null | undefined, fmt = rupees) {
  const v = Number(n ?? 0);
  return `${v > 0 ? "+" : ""}${fmt(v)}`;
}

export function mmss(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
