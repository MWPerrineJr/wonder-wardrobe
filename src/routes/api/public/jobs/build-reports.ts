import { createFileRoute } from "@tanstack/react-router";

import { classifyGatewayError, FEEDBACK_MODEL } from "@/lib/ai.server";
import { buildShopReport } from "@/lib/shop-report.server";
import { acquireLease, isAuthorizedJobCall, pauseJob, releaseLease, resumeJob } from "@/lib/jobs.server";

const MAX_SHOPS = 5;

/**
 * Daily: refresh the rolling AI report for shops on the analytics plan that
 * have new feedback since their last report. Bounded per run; each shop's
 * report row is the progress marker.
 */
export const Route = createFileRoute("/api/public/jobs/build-reports")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedJobCall(request)) return new Response("Unauthorized", { status: 401 });

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("LOVABLE_API_KEY is not configured", { status: 500 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const lease = await acquireLease(supabaseAdmin, "build-reports");
        if (!lease.ok) return Response.json({ skipped: lease.skipped });

        try {
          const { data: subs, error } = await supabaseAdmin
            .from("subscriptions")
            .select("shop_id, status, current_period_end")
            .in("status", ["trialing", "active", "past_due"]);
          if (error) throw new Error(error.message);

          const shopIds = [...new Set((subs ?? []).map((s) => s.shop_id))].slice(
            0,
            lease.paused ? 1 : MAX_SHOPS,
          );

          let built = 0;
          const skipped: string[] = [];

          for (const shopId of shopIds) {
            try {
              const result = await buildShopReport(supabaseAdmin, apiKey, shopId);
              if (result.built) {
                built += 1;
                if (lease.paused) await resumeJob(supabaseAdmin, "build-reports");
              } else {
                skipped.push(shopId);
              }
            } catch (err) {
              const failure = classifyGatewayError(err);
              if (failure.kind === "pause") {
                await pauseJob(supabaseAdmin, "build-reports", failure.reason);
                return Response.json({ built, paused: failure.reason });
              }
              if (failure.kind === "backoff") {
                return Response.json({ built, backoff: failure.reason });
              }
              skipped.push(shopId);
            }
          }

          return Response.json({ built, skipped: skipped.length, model: FEEDBACK_MODEL });
        } finally {
          await releaseLease(supabaseAdmin, "build-reports");
        }
      },
    },
  },
});