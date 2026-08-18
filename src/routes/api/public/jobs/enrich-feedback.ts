import { createFileRoute } from "@tanstack/react-router";

import { classifyGatewayError, FEEDBACK_MODEL } from "@/lib/ai.server";
import { analyzeReview } from "@/lib/feedback-analysis.server";
import { acquireLease, isAuthorizedJobCall, pauseJob, releaseLease, resumeJob } from "@/lib/jobs.server";

const BATCH = 10;

/**
 * Every 5 minutes: analyze feedback rows that have no AI analysis yet.
 * Bounded batch, per-row progress marking, and the 402/403 pause + single probe
 * item recovery required of background AI jobs.
 */
export const Route = createFileRoute("/api/public/jobs/enrich-feedback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedJobCall(request)) return new Response("Unauthorized", { status: 401 });

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("LOVABLE_API_KEY is not configured", { status: 500 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const lease = await acquireLease(supabaseAdmin, "enrich-feedback");
        if (!lease.ok) return Response.json({ skipped: lease.skipped });

        const limit = lease.paused ? 1 : BATCH;

        try {
          const { data: rows, error } = await supabaseAdmin
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

              await supabaseAdmin
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
              if (lease.paused) await resumeJob(supabaseAdmin, "enrich-feedback");
            } catch (err) {
              const failure = classifyGatewayError(err);
              if (failure.kind === "pause") {
                await pauseJob(supabaseAdmin, "enrich-feedback", failure.reason);
                return Response.json({ enriched, paused: failure.reason }, { status: 200 });
              }
              if (failure.kind === "backoff") {
                return Response.json({ enriched, backoff: failure.reason });
              }
              failed += 1;
            }
          }

          return Response.json({ enriched, failed });
        } finally {
          await releaseLease(supabaseAdmin, "enrich-feedback");
        }
      },
    },
  },
});