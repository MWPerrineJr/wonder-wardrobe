import { createFileRoute } from "@tanstack/react-router";

import { processCalendarOutbox } from "@/lib/booking-calendar.server";
import { noteJobItemFailure, noteJobSuccess, runScheduledJob } from "@/lib/jobs.server";

/**
 * Every 5 minutes: cancel expired unpaid booking holds and drain the Google
 * Calendar outbox for confirmed bookings.
 */
export const Route = createFileRoute("/api/public/jobs/booking-maintenance")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        runScheduledJob(request, "booking-maintenance", async ({ admin }) => {
          const expired = await admin.rpc("expire_stale_booking_holds");
          if (expired.error) throw new Error(expired.error.message);

          let calendar = { synced: 0, skipped: 0, failed: 0 };
          try {
            calendar = await processCalendarOutbox(admin);
            await noteJobSuccess(admin, "booking-maintenance");
          } catch (error) {
            await noteJobItemFailure(admin, "booking-maintenance", error);
            throw error;
          }

          return Response.json({
            expired: expired.data ?? 0,
            calendar,
          });
        }),
    },
  },
});
