import { createFileRoute } from "@tanstack/react-router";

import { runScheduledJob } from "@/lib/jobs.server";
import { sendSurveyInviteEmail } from "@/lib/survey-email.server";

const MAX_PER_RUN = 25;

/**
 * Hourly: turn appointments that finished 24-72h ago into one survey invite +
 * one email each. Invites are unique per booking, so a re-run can never
 * double-send, and each row records its own delivery outcome.
 */
export const Route = createFileRoute("/api/public/jobs/send-surveys")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        runScheduledJob(request, "send-surveys", async ({ request: req, admin }) => {
          const { data: targets, error } = await admin.rpc("pending_survey_targets");
          if (error) throw new Error(error.message);

          let invited = 0;
          let emailed = 0;
          let failed = 0;

          for (const t of (targets ?? []).slice(0, MAX_PER_RUN)) {
            const { data: invite, error: insErr } = await admin
              .from("survey_invites")
              .insert({
                shop_id: t.shop_id,
                booking_id: t.booking_id,
                provider_id: t.provider_id,
                customer_id: t.customer_id,
                customer_name: t.customer_name,
                customer_email: t.customer_email,
              })
              .select("id, token")
              .maybeSingle();

            // Unique violation = already invited by a concurrent/earlier run.
            if (insErr || !invite) continue;
            invited += 1;

            const outcome = await sendSurveyInviteEmail(
              {
                token: invite.token,
                shopName: t.shop_name,
                providerName: t.provider_name,
                customerName: t.customer_name,
                customerEmail: t.customer_email,
                serviceName: t.service_name,
                shopAddress: t.shop_address,
              },
              process.env["APP_URL"] ?? new URL(req.url).origin,
            );

            await admin
              .from("survey_invites")
              .update({
                email_status: outcome.status,
                email_error: outcome.error ?? null,
                emailed_at: outcome.status === "sent" ? new Date().toISOString() : null,
              })
              .eq("id", invite.id);

            if (outcome.status === "sent") emailed += 1;
            else failed += 1;
          }

          return Response.json({ invited, emailed, failed });
        }),
    },
  },
});
