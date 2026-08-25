/** Canonical public origin used for shareable links, QR codes, calendar UIDs, and embeds.
 *  In local development we fall back to the actual window origin so links still work.
 */
export const CANONICAL_ORIGIN = "https://thestandingchair.com";

export function getPublicOrigin(): string {
  if (typeof window === "undefined") return CANONICAL_ORIGIN;
  const local = window.location.origin;
  if (local.includes("localhost") || local.includes("127.0.0.1")) return local;
  return CANONICAL_ORIGIN;
}
