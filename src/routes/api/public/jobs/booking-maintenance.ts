import { createFileRoute } from "@tanstack/react-router";

import { log } from "@/lib/log";
import { runScheduledJob } from "@/lib/jobs.server";
import { sendSurveyInviteEmail } from "@/lib/survey-email.server";

const OUTBOX_PER_RUN = 20;
const MAX_EMAIL_ATTEMPTS = 5;
const MAX_OUTBOX_ATTEMPTS = 5;

/** Exponential backoff in minutes: 5, 15, 45, 135, 405. */
function backoffMinutes(attempt: number): number {
  return 5 * 3 ** Math.max(0, Math.min(attempt, 4));
}

function nextAttempt(attempt: number): string {
  return new Date(Date.now() + backoffMinutes(attempt) * 60_000).toISOString();
}

/**
 * Every 5 minutes: expire unpaid booking holds, retry survey emails that failed,
 * and drain the calendar outbox. Everything here is idempotent and bounded, so a
 * missed run simply catches up on the next one.
 */
export const Route = createFileRoute("/api/public/jobs/booking-maintenance")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});

function run(request: Request) {
  return runScheduledJob(request, "booking-maintenance", async ({ request: req, admin }) => {
    const appUrl = process.env["APP_URL"] ?? new URL(req.url).origin;

    // 1. Expire unpaid holds so the slot returns to the calendar.
    let holdsExpired = 0;
    const { data: expired, error: holdError } = await admin.rpc("expire_stale_booking_holds");
    if (holdError) throw new Error(holdError.message);
    holdsExpired = expired ?? 0;

    // 2. Retry survey invites whose delivery failed.
    let surveysRetried = 0;
    let surveysSent = 0;
    let surveysDead = 0;
    const { data: retries, error: retryError } = await admin.rpc("pending_survey_retries");
    if (retryError) throw new Error(retryError.message);

    for (const invite of retries ?? []) {
      surveysRetried += 1;
      const attempts = (invite.attempts ?? 0) + 1;
      const outcome = await sendSurveyInviteEmail(
        {
          token: invite.token,
          shopName: invite.shop_name,
          providerName: invite.provider_name,
          customerName: invite.customer_name,
          customerEmail: invite.customer_email,
          serviceName: invite.service_name,
          shopAddress: invite.shop_address,
        },
        appUrl,
      );
      const terminal = outcome.status !== "sent" && attempts >= MAX_EMAIL_ATTEMPTS;
      if (terminal) surveysDead += 1;
      if (outcome.status === "sent") surveysSent += 1;

      await admin
        .from("survey_invites")
        .update({
          email_status: outcome.status,
          email_error: outcome.error ?? null,
          email_attempts: attempts,
          last_attempt_at: new Date().toISOString(),
          next_attempt_at: outcome.status === "sent" || terminal ? null : nextAttempt(attempts),
          delivery_terminal: terminal,
          emailed_at: outcome.status === "sent" ? new Date().toISOString() : null,
        })
        .eq("id", invite.invite_id);
    }

    if (surveysDead > 0) {
      log.alert({ job: "booking-maintenance", issue: "survey_delivery_dead_letter", count: surveysDead });
    }

    // 3. Drain the calendar outbox.
    const nowIso = new Date().toISOString();
    const { data: queued, error: queueError } = await admin
      .from("booking_calendar_outbox")
      .select("id, booking_id, provider_id, action, attempts")
      .eq("status", "pending")
      .lte("next_attempt_at", nowIso)
      .order("next_attempt_at", { ascending: true })
      .limit(OUTBOX_PER_RUN);
    if (queueError) throw new Error(queueError.message);

    let calendarDone = 0;
    let calendarFailed = 0;

    for (const item of queued ?? []) {
      const attempts = (item.attempts ?? 0) + 1;
      try {
        const { data: booking } = await admin
          .from("bookings")
          .select(
            "id, provider_id, starts_at, ends_at, status, payment_status, google_event_id, customer_name, notes, shop_id, service_id",
          )
          .eq("id", item.booking_id)
          .maybeSingle();

        if (!booking) {
          await admin
            .from("booking_calendar_outbox")
            .update({ status: "done", attempts, processed_at: new Date().toISOString() })
            .eq("id", item.id);
          calendarDone += 1;
          continue;
        }

        const calendar = await import("@/server/googleCalendar.server");

        if (item.action === "delete") {
          await calendar.removeBookingFromCalendar(
            item.provider_id ?? booking.provider_id,
            booking.google_event_id,
          );
        } else {
          // Never mirror an unpaid hold — only confirmed/paid appointments sync.
          const syncable =
            booking.status === "confirmed" ||
            (booking.status === "pending" && booking.payment_status === "paid");
          if (syncable && !booking.google_event_id) {
            const [{ data: shop }, { data: service }] = await Promise.all([
              admin.from("shops").select("name, address").eq("id", booking.shop_id).maybeSingle(),
              admin.from("services").select("name").eq("id", booking.service_id).maybeSingle(),
            ]);
            await calendar.syncBookingToCalendar(booking.id, booking.provider_id, {
              summary: `${service?.name ?? "Appointment"} — ${booking.customer_name ?? "Client"}`,
              description: booking.notes ?? null,
              location: shop?.address ?? shop?.name ?? null,
              startsAt: booking.starts_at,
              endsAt: booking.ends_at,
            });
          }
        }

        await admin
          .from("booking_calendar_outbox")
          .update({
            status: "done",
            attempts,
            last_error: null,
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        calendarDone += 1;
      } catch (error) {
        calendarFailed += 1;
        const terminal = attempts >= MAX_OUTBOX_ATTEMPTS;
        await admin
          .from("booking_calendar_outbox")
          .update({
            status: terminal ? "failed" : "pending",
            attempts,
            next_attempt_at: nextAttempt(attempts),
            last_error: (error instanceof Error ? error.message : "sync failed").slice(0, 500),
          })
          .eq("id", item.id);
        if (terminal) {
          log.alert({
            job: "booking-maintenance",
            issue: "calendar_outbox_dead_letter",
            bookingId: item.booking_id,
          });
        }
      }
    }

    return Response.json({
      holdsExpired,
      surveysRetried,
      surveysSent,
      surveysDead,
      calendarDone,
      calendarFailed,
    });
  });
}
