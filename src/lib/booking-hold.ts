/** Slot-hold and shop-capacity rules used by createBooking and validate_booking(). */

export const DEFAULT_HOLD_MINUTES = 30;

export const SLOT_HOLDING_STATUSES = ["pending", "confirmed"] as const;

export type OccupyingBooking = {
  providerId: string | null;
  start: number;
  end: number;
  status: string;
  holdExpiresAt: string | null;
};

export function holdExpiryIso(now = new Date(), minutes = DEFAULT_HOLD_MINUTES): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** Pending/confirmed rows hold a chair unless a prepaid hold has expired. */
export function occupiesSlot(
  status: string,
  holdExpiresAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (status !== "pending" && status !== "confirmed") return false;
  if (!holdExpiresAt) return true;
  const expires = Date.parse(holdExpiresAt);
  return Number.isFinite(expires) && expires > nowMs;
}

export function occupyingBookings(
  rows: OccupyingBooking[],
  nowMs = Date.now(),
): OccupyingBooking[] {
  return rows.filter((row) => occupiesSlot(row.status, row.holdExpiresAt, nowMs));
}

export function providerHasConflict(
  existing: OccupyingBooking[],
  providerId: string,
  start: number,
  end: number,
  nowMs = Date.now(),
): boolean {
  return occupyingBookings(existing, nowMs).some(
    (row) => row.providerId === providerId && rangesOverlap(start, end, row.start, row.end),
  );
}

export function shopHasCapacity(
  existing: OccupyingBooking[],
  activeProviderCount: number,
  start: number,
  end: number,
  nowMs = Date.now(),
): boolean {
  if (activeProviderCount <= 0) return false;
  const overlapping = occupyingBookings(existing, nowMs).filter((row) =>
    rangesOverlap(start, end, row.start, row.end),
  );
  return overlapping.length < activeProviderCount;
}

export type ReserveSlotResult = { ok: true } | { ok: false; reason: "provider_busy" | "shop_full" };

/**
 * No-provider-preference bookings occupy one chair at the shop. Assigned
 * bookings occupy both that chair and the named provider. Two concurrent
 * inserts are serialized in Postgres with a shop-scoped advisory lock; this
 * function is the check each transaction runs after it holds that lock.
 */
export function canReserveSlot(args: {
  existing: OccupyingBooking[];
  activeProviderCount: number;
  providerId: string | null | undefined;
  start: number;
  end: number;
  nowMs?: number;
}): ReserveSlotResult {
  const nowMs = args.nowMs ?? Date.now();
  if (!shopHasCapacity(args.existing, args.activeProviderCount, args.start, args.end, nowMs)) {
    return { ok: false, reason: "shop_full" };
  }
  if (
    args.providerId &&
    providerHasConflict(args.existing, args.providerId, args.start, args.end, nowMs)
  ) {
    return { ok: false, reason: "provider_busy" };
  }
  return { ok: true };
}

export function shouldExpireHold(
  status: string,
  paymentStatus: string,
  holdExpiresAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (status !== "pending" || paymentStatus !== "awaiting_payment" || !holdExpiresAt) return false;
  const expires = Date.parse(holdExpiresAt);
  return Number.isFinite(expires) && expires <= nowMs;
}
