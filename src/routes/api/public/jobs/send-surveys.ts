import { createFileRoute } from "@tanstack/react-router";

import { runScheduledJob } from "@/lib/jobs.server";
import {
  isRetryableEmailStatus,
  sanitizeJobError,
  SURVEY_MAX_ATTEMPTS,
  surveyAttemptPatch,
  surveyIdempotencyKey,
} from "@/lib/job-retry";
import { sendSurveyInviteEmail } from "@/lib/survey-email.server";

const MAX_PER_RUN = 25;

type Target = {
  inviteId: string | null;
  token: string | null;
  attempts: number;
  idempotencyKey: string | null;
  shop_id: string;
  booking_id: string;
  provider_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string;
  shop_name: string;
  provider_name: string | null;
  service_name: string | null;
  shop_address: string | null;
};

/**
 * Hourly: create survey invites for recent visits and retry pending/failed
 * delivery with backoff. One stable idempotency key per invite token.
 */
export const Route = createFileRoute("/api/public/jobs/send-surveys")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        runScheduledJob(request, "send-surveys", async ({ request: req, admin }) => {
          const now = new Date().toISOString();
          const retriesQuery = await admin
            .from("survey_invites")
            .select(
              "id, token, customer_name, customer_email, email_attempts, email_idempotency_key, email_status, shop_id, booking_id, provider_id, customer_id, shop:shops(name, address), provider:providers(display_name)",
            )
            .in("email_status", ["pending", "failed", "blocked"])
            .or(`email_next_attempt_at.is.null,email_next_attempt_at.lte.${now}`)
            .lt("email_attempts", SURVEY_MAX_ATTEMPTS)
            .is("responded_at", null)
            .gt("expires_at", now)
            .order("email_next_attempt_at", { ascending: true, nullsFirst: true })
            .limit(MAX_PER_RUN);
          if (retriesQuery.error) throw new Error(retriesQuery.error.message);

          const retries: Target[] = (retriesQuery.data ?? [])
            .filter((row) => isRetryableEmailStatus(row.email_status))
            .map((row) => {
              const shop = row.shop as { name?: string; address?: string | null } | null;
              const provider = row.provider as { display_name?: string } | null;
              return {
                inviteId: row.id,
                token: row.token,
                attempts: row.email_attempts ?? 0,
                idempotencyKey: row.email_idempotency_key,
                shop_id: row.shop_id,
                booking_id: row.booking_id ?? "",
                provider_id: row.provider_id,
                customer_id: row.customer_id,
                customer_name: row.customer_name,
                customer_email: row.customer_email,
                shop_name: shop?.name ?? "",
                provider_name: provider?.display_name ?? null,
                service_name: null,
                shop_address: shop?.address ?? null,
              };
            });

          const remaining = MAX_PER_RUN - retries.length;
          const targets: Target[] = [...retries];
          if (remaining > 0) {
            const { data: fresh, error } = await admin.rpc("pending_survey_targets");
            if (error) throw new Error(error.message);
            for (const t of (fresh ?? []).slice(0, remaining)) {
              targets.push({
                inviteId: null,
                token: null,
                attempts: 0,
                idempotencyKey: null,
                shop_id: t.shop_id,
                booking_id: t.booking_id,
                provider_id: t.provider_id,
                customer_id: t.customer_id,
                customer_name: t.customer_name,
                customer_email: t.customer_email,
                shop_name: t.shop_name,
                provider_name: t.provider_name,
                service_name: t.service_name,
                shop_address: t.shop_address,
              });
            }
          }

          let invited = 0;
          let emailed = 0;
          let failed = 0;
          let retried = 0;

          for (const t of targets) {
            let inviteId = t.inviteId;
            let token = t.token;
            let attempts = t.attempts;
            if (!inviteId) {
              const { data: invite, error: insErr } = await admin
                .from("survey_invites")
                .insert({
                  shop_id: t.shop_id,
                  booking_id: t.booking_id,
                  provider_id: t.provider_id,
                  customer_id: t.customer_id,
                  customer_name: t.customer_name,
                  customer_email: t.customer_email,
                  email_status: "pending",
                })
                .select("id, token")
                .maybeSingle();
              if (insErr || !invite) continue;
              inviteId = invite.id;
              token = invite.token;
              attempts = 0;
              invited += 1;
            } else {
              retried += 1;
            }
            if (!inviteId || !token) continue;

            const outcome = await sendSurveyInviteEmail(
              {
                token,
                shopName: t.shop_name,
                providerName: t.provider_name,
                customerName: t.customer_name,
                customerEmail: t.customer_email,
                serviceName: t.service_name,
                shopAddress: t.shop_address,
                idempotencyKey: t.idempotencyKey ?? surveyIdempotencyKey(token),
              },
              process.env["APP_URL"] ?? new URL(req.url).origin,
            );

            const patch = surveyAttemptPatch(
              attempts,
              outcome.status,
              outcome.error ? sanitizeJobError(outcome.error) : null,
            );
            const { error: updErr } = await admin.from("survey_invites").update(patch).eq("id", inviteId);
            if (updErr) throw new Error(updErr.message);

            if (outcome.status === "sent") emailed += 1;
            else failed += 1;
          }

          return Response.json({ invited, emailed, failed, retried });
        }),
    },
  },
});
