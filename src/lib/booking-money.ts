/** Amount the client must pay up front, in cents (0 when prepay is off). */
export function amountDueCents(
  priceCents: number,
  mode: "off" | "deposit" | "full",
  depositPercent: number,
): number {
  if (mode === "full") return priceCents;
  if (mode === "deposit") return Math.max(50, Math.round((priceCents * depositPercent) / 100));
  return 0;
}
