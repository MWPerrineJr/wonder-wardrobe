import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { toInstant } from "@/lib/booking-time";
import { dbError } from "@/lib/db-error";
import { freeSlotTimes, toMinutes } from "@/lib/slot-grid";

const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "18:00";

/** Shared calendar availability for online booking and the walk-in page. */
export async function computeSlots(input: {
  shopId: string;
  serviceId: string;
  providerId?: string | null;
  date: string;
  tzOffsetMinutes: number;
}): Promise<{ slots: string[]; closed: boolean }> {
  const { data: service, error: svcErr } = await supabaseAdmin
    .from("services")
    .select("id, duration_minutes, shop_id, is_active")
    .eq("id", input.serviceId)
    .maybeSingle();
  if (svcErr) throw dbError(svcErr, "booking");
  if (!service || service.shop_id !== input.shopId || !service.is_active)
    throw new Error("Service not found for this shop");

  const [y, m, d] = input.date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  const { data: hours, error: hoursErr } = await supabaseAdmin
    .from("shop_hours")
    .select("open_time, close_time, is_closed")
    .eq("shop_id", input.shopId)
    .eq("weekday", weekday)
    .maybeSingle();
  if (hoursErr) throw dbError(hoursErr, "booking");
  if (hours?.is_closed) return { slots: [], closed: true };

  const { data: providerRows, error: provErr } = await supabaseAdmin
    .from("providers")
    .select("id")
    .eq("shop_id", input.shopId)
    .eq("is_active", true);
  if (provErr) throw dbError(provErr, "booking");
  if (input.providerId && !(providerRows ?? []).some((p) => p.id === input.providerId))
    throw new Error("Provider not found for this shop");

  const dayStart = toInstant(input.date, "00:00", input.tzOffsetMinutes);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
  const { data: rows, error } = await supabaseAdmin
    .from("bookings")
    .select("starts_at, ends_at, provider_id, status, hold_expires_at")
    .eq("shop_id", input.shopId)
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", dayStart.toISOString())
    .lt("starts_at", dayEnd.toISOString());
  if (error) throw dbError(error, "booking");

  let busy: Array<{ start: number; end: number }> = [];
  if (input.providerId) {
    const { listGoogleBusy } = await import("@/server/googleCalendar.server");
    busy = await listGoogleBusy(input.providerId, dayStart.toISOString(), dayEnd.toISOString());
  }

  const slots = freeSlotTimes({
    date: input.date,
    tzOffsetMinutes: input.tzOffsetMinutes,
    openMinutes: toMinutes((hours?.open_time ?? DEFAULT_OPEN).slice(0, 5)),
    closeMinutes: toMinutes((hours?.close_time ?? DEFAULT_CLOSE).slice(0, 5)),
    durationMinutes: service.duration_minutes,
    nowMs: Date.now(),
    occupying: (rows ?? []).map((r) => ({
      providerId: r.provider_id,
      start: new Date(r.starts_at).getTime(),
      end: new Date(r.ends_at).getTime(),
      status: r.status,
      holdExpiresAt: r.hold_expires_at,
    })),
    activeProviderCount: (providerRows ?? []).length,
    providerId: input.providerId ?? null,
    busy,
  });
  return { slots, closed: false };
}
