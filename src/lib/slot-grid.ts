import { canReserveSlot, type OccupyingBooking } from "./booking-hold.ts";
import { toInstant } from "./booking-time.ts";

export const SLOT_STEP_MINUTES = 15;

export function toMinutes(t: string): number {
  const [hh, mm] = t.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

/** Every start time in opening hours that is in the future and still free. */
export function freeSlotTimes(args: {
  date: string;
  tzOffsetMinutes: number;
  openMinutes: number;
  closeMinutes: number;
  durationMinutes: number;
  nowMs: number;
  occupying: OccupyingBooking[];
  activeProviderCount: number;
  providerId: string | null;
  busy?: Array<{ start: number; end: number }>;
}): string[] {
  const slots: string[] = [];
  for (
    let mins = args.openMinutes;
    mins + args.durationMinutes <= args.closeMinutes;
    mins += SLOT_STEP_MINUTES
  ) {
    const time = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    const start = toInstant(args.date, time, args.tzOffsetMinutes).getTime();
    const end = start + args.durationMinutes * 60_000;
    if (start <= args.nowMs) continue;
    const r = canReserveSlot({
      existing: args.occupying,
      activeProviderCount: args.activeProviderCount,
      providerId: args.providerId,
      start,
      end,
      nowMs: args.nowMs,
    });
    if (!r.ok) continue;
    if ((args.busy ?? []).some((b) => start < b.end && end > b.start)) continue;
    slots.push(time);
  }
  return slots;
}
