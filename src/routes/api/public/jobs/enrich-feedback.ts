import { createFileRoute } from "@tanstack/react-router";

import { classifyGatewayError, FEEDBACK_MODEL } from "@/lib/ai.server";
import { analyzeReview } from "@/lib/feedback-analysis.server";
import { pauseJob, resumeJob, runScheduledJob } from "@/lib/jobs.server";

const BATCH = 10;

/**
 * Every 5 minutes: analyze feedback rows that have no AI analysis yet.
 * Bounded batch, per-row progress marking, and the 402/403 pause + single probe
 * item recovery required of background AI jobs.
 */
export const Route = createFileRoute("/api/public/jobs/enrich-feedback")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        runScheduledJob(request, "enrich-feedback", async ({ admin, lease }) => {
          const apiKey = process.env["LOVABLE_API_KEY"];
          if (!apiKey) return new Response("LOVABLE_API_KEY is not configured", { status: 500 });

          const limit = lease.paused ? 1 : BATCH;

          const { data: rows, error } = await admin
            .from("customer_feedback")
            .select("id, rating, message, source")
            .is("enriched_at", null)
            .not("message", "is", null)
            .order("created_at", { ascending: true })
            .limit(limit);
          if (error) throw new Error(error.message);
          if (!rows || rows.length === 0) return Response.json({ enriched: 0, idle: true });

          let enriched = 0;
          let failed = 0;

          for (const row of rows) {
            try {
              const analysis = await analyzeReview(apiKey, {
                rating: row.rating,
                source: row.source,
                message: row.message ?? "",
              });

              await admin
                .from("customer_feedback")
                .update({
                  ...analysis,
                  enrichment_model: FEEDBACK_MODEL,
                  enriched_at: new Date().toISOString(),
                  enrichment_raw: analysis,
                })
                .eq("id", row.id)
                .is("enriched_at", null);

              enriched += 1;
              if (lease.paused) await resumeJob(admin, "enrich-feedback");
            } catch (err) {
              const failure = classifyGatewayError(err);
              if (failure.kind === "pause") {
                await pauseJob(admin, "enrich-feedback", failure.reason);
                return Response.json({ enriched, paused: failure.reason }, { status: 200 });
              }
              if (failure.kind === "backoff") {
                return Response.json({ enriched, backoff: failure.reason });
              }
              failed += 1;
            }
          }

          return Response.json({ enriched, failed });
        }),
    },
  },
});
