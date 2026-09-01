import { createFileRoute } from "@tanstack/react-router";

import { classifyGatewayError, FEEDBACK_MODEL } from "@/lib/ai.server";
import {
  consumeJobBudget,
  noteJobItemFailure,
  noteJobSuccess,
  pauseJob,
  remainingJobBudget,
  resumeJob,
  runScheduledJob,
} from "@/lib/jobs.server";
import { REPORT_DAILY_CAP } from "@/lib/job-retry";
import { buildShopReport } from "@/lib/shop-report.server";

const MAX_SHOPS = 5;

/**
 * Daily: refresh the rolling AI report for shops on the analytics plan that
 * have new feedback since their last report. Bounded per run; each shop's
 * report row is the progress marker.
 */
export const Route = createFileRoute("/api/public/jobs/build-reports")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        runScheduledJob(request, "build-reports", async ({ admin, lease }) => {
          const apiKey = process.env["LOVABLE_API_KEY"];
          if (!apiKey) return new Response("LOVABLE_API_KEY is not configured", { status: 500 });

          const cap = Number(process.env["AI_MAX_REPORTS_PER_DAY"]) || REPORT_DAILY_CAP;
          const budget = await remainingJobBudget(admin, "build-reports", cap);
          if (budget <= 0) return Response.json({ built: 0, capped: true });

          const { data: subs, error } = await admin
            .from("subscriptions")
            .select("shop_id, status, current_period_end")
            .in("status", ["trialing", "active", "past_due"]);
          if (error) throw new Error(error.message);

          const shopIds = [...new Set((subs ?? []).map((s) => s.shop_id))].slice(
            0,
            Math.min(lease.paused ? 1 : MAX_SHOPS, budget),
          );

          let built = 0;
          const skipped: string[] = [];

          for (const shopId of shopIds) {
            try {
              const result = await buildShopReport(admin, apiKey, shopId, {
                onSpend: () => consumeJobBudget(admin, "build-reports", cap),
              });
              if (!result.built && result.reason === "capped") {
                return Response.json({ built, capped: true });
              }
              if (result.built) {
                built += 1;
                await noteJobSuccess(admin, "build-reports");
                if (lease.paused) await resumeJob(admin, "build-reports");
              } else {
                skipped.push(shopId);
              }
            } catch (err) {
              const failure = classifyGatewayError(err);
              await noteJobItemFailure(admin, "build-reports", failure.reason);
              if (failure.kind === "pause") {
                await pauseJob(admin, "build-reports", failure.reason);
                return Response.json({ built, paused: failure.reason });
              }
              if (failure.kind === "backoff") {
                return Response.json({ built, backoff: failure.reason });
              }
              skipped.push(shopId);
            }
          }

          return Response.json({ built, skipped: skipped.length, model: FEEDBACK_MODEL });
        }),
    },
  },
});
