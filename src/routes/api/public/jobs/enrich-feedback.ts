import { createFileRoute } from "@tanstack/react-router";

import { classifyGatewayError, FEEDBACK_MODEL } from "@/lib/ai.server";
import { analyzeReview } from "@/lib/feedback-analysis.server";
import {
  consumeJobBudget,
  noteJobItemFailure,
  noteJobSuccess,
  pauseJob,
  remainingJobBudget,
  resumeJob,
  runScheduledJob,
} from "@/lib/jobs.server";
import {
  ENRICH_DAILY_CAP,
  ENRICH_MAX_ATTEMPTS,
  enrichmentStatusAfterAttempt,
  nextAttemptIso,
  sanitizeJobError,
} from "@/lib/job-retry";

const BATCH = 10;

/**
 * Every 5 minutes: analyze feedback rows that are pending or retryable.
 * Per-row status, backoff, dead-letter, and a daily invocation cap.
 */
export const Route = createFileRoute("/api/public/jobs/enrich-feedback")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        runScheduledJob(request, "enrich-feedback", async ({ admin, lease }) => {
          const apiKey = process.env["LOVABLE_API_KEY"];
          if (!apiKey) return new Response("LOVABLE_API_KEY is not configured", { status: 500 });

          const cap = Number(process.env["AI_MAX_ENRICH_PER_DAY"]) || ENRICH_DAILY_CAP;
          const budget = await remainingJobBudget(admin, "enrich-feedback", cap);
          if (budget <= 0) {
            return Response.json({ enriched: 0, capped: true });
          }

          const now = new Date().toISOString();
          const limit = Math.min(lease.paused ? 1 : BATCH, budget);
          const { data: rows, error } = await admin
            .from("customer_feedback")
            .select("id, rating, message, source, enrichment_attempts")
            .in("enrichment_status", ["pending", "failed"])
            .or(`enrichment_next_attempt_at.is.null,enrichment_next_attempt_at.lte.${now}`)
            .lt("enrichment_attempts", ENRICH_MAX_ATTEMPTS)
            .not("message", "is", null)
            .order("created_at", { ascending: true })
            .limit(limit);
          if (error) throw new Error(error.message);
          if (!rows || rows.length === 0) return Response.json({ enriched: 0, idle: true });

          let enriched = 0;
          let failed = 0;

          for (const row of rows) {
            const reserved = await consumeJobBudget(admin, "enrich-feedback", cap);
            if (!reserved) return Response.json({ enriched, capped: true });

            try {
              const analysis = await analyzeReview(apiKey, {
                rating: row.rating,
                source: row.source,
                message: row.message ?? "",
              });

              const attempts = (row.enrichment_attempts ?? 0) + 1;
              await admin
                .from("customer_feedback")
                .update({
                  ...analysis,
                  enrichment_model: FEEDBACK_MODEL,
                  enriched_at: new Date().toISOString(),
                  enrichment_raw: analysis,
                  enrichment_status: "done",
                  enrichment_attempts: attempts,
                  enrichment_error: null,
                  enrichment_last_attempt_at: new Date().toISOString(),
                  enrichment_next_attempt_at: null,
                })
                .eq("id", row.id)
                .in("enrichment_status", ["pending", "failed"]);

              enriched += 1;
              await noteJobSuccess(admin, "enrich-feedback");
              if (lease.paused) await resumeJob(admin, "enrich-feedback");
            } catch (err) {
              const failure = classifyGatewayError(err);
              const attempts = (row.enrichment_attempts ?? 0) + 1;
              const status = enrichmentStatusAfterAttempt(false, attempts);
              await admin
                .from("customer_feedback")
                .update({
                  enrichment_status: status,
                  enrichment_attempts: attempts,
                  enrichment_error: sanitizeJobError(failure.reason),
                  enrichment_last_attempt_at: new Date().toISOString(),
                  enrichment_next_attempt_at:
                    status === "dead_letter" ? null : nextAttemptIso(attempts),
                })
                .eq("id", row.id);

              if (failure.kind === "pause") {
                await pauseJob(admin, "enrich-feedback", failure.reason);
                return Response.json({ enriched, paused: failure.reason }, { status: 200 });
              }
              if (failure.kind === "backoff") {
                return Response.json({ enriched, backoff: failure.reason });
              }
              failed += 1;
              await noteJobItemFailure(admin, "enrich-feedback", failure.reason);
            }
          }

          return Response.json({ enriched, failed });
        }),
    },
  },
});
