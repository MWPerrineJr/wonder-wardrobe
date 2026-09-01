import { CALENDAR_MAX_ATTEMPTS } from "@/lib/booking-calendar-outbox";
import { nextAttemptIso, sanitizeJobError } from "@/lib/job-retry";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const BATCH = 20;

/**
 * Drain confirmed-booking calendar syncs. Google failures retry with backoff;
 * missing provider connections are skipped so they do not block the outbox.
 */
export async function processCalendarOutbox(
  admin: Admin,
): Promise<{ synced: number; skipped: number; failed: number }> {
  const now = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("booking_calendar_outbox")
    .select("id, booking_id, attempt_count")
    .is("processed_at", null)
    .lte("next_attempt_at", now)
    .lt("attempt_count", CALENDAR_MAX_ATTEMPTS)
    .order("next_attempt_at", { ascending: true })
    .limit(BATCH);
  if (error) throw new Error(error.message);

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select(
        "id, status, provider_id, starts_at, ends_at, customer_name, customer_phone, notes, google_event_id, service:services(name), shop:shops(name, address)",
      )
      .eq("id", row.booking_id)
      .maybeSingle();
    if (bookingError) throw new Error(bookingError.message);

    if (!booking || booking.status === "cancelled" || booking.status === "no_show") {
      await markOutboxProcessed(admin, row.id);
      skipped += 1;
      continue;
    }

    if (booking.status !== "confirmed" && booking.status !== "completed") {
      await bumpOutboxAttempt(admin, row.id, row.attempt_count, "Booking is not confirmed yet");
      failed += 1;
      continue;
    }

    if (booking.google_event_id) {
      await markOutboxProcessed(admin, row.id);
      skipped += 1;
      continue;
    }

    const service = booking.service as { name?: string } | null;
    const shop = booking.shop as { name?: string; address?: string | null } | null;
    const { syncBookingToCalendar } = await import("@/server/googleCalendar.server");
    const result = await syncBookingToCalendar(booking.id, booking.provider_id, {
      summary: `${service?.name ?? "Appointment"} — ${shop?.name ?? "Shop"}`,
      description: [
        booking.customer_name ? `Client: ${booking.customer_name}` : null,
        booking.customer_phone ? `Phone: ${booking.customer_phone}` : null,
        booking.notes ? `Notes: ${booking.notes}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      location: shop?.address ?? null,
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
    });

    if (result === "failed") {
      await bumpOutboxAttempt(admin, row.id, row.attempt_count, "Google Calendar sync failed");
      failed += 1;
      continue;
    }

    await markOutboxProcessed(admin, row.id);
    if (result === "synced") synced += 1;
    else skipped += 1;
  }

  return { synced, skipped, failed };
}

async function markOutboxProcessed(admin: Admin, id: string) {
  await admin
    .from("booking_calendar_outbox")
    .update({ processed_at: new Date().toISOString(), last_error: null, next_attempt_at: new Date().toISOString() })
    .eq("id", id);
}

async function bumpOutboxAttempt(admin: Admin, id: string, previousAttempts: number, error: string) {
  const attempts = previousAttempts + 1;
  await admin
    .from("booking_calendar_outbox")
    .update({
      attempt_count: attempts,
      last_error: sanitizeJobError(error),
      next_attempt_at: nextAttemptIso(attempts),
    })
    .eq("id", id);
}
