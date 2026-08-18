import { analyzeShopReport } from "./feedback-analysis.server";
import { FEEDBACK_MODEL } from "./ai.server";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const WINDOW_DAYS = 90;
const MIN_ROWS = 3;

/**
 * Build (or refresh) the rolling AI report for one shop. Returns
 * `{ built: false }` when there is nothing new worth spending a call on.
 */
export async function buildShopReport(
  admin: Admin,
  apiKey: string,
  shopId: string,
  options: { force?: boolean } = {},
) {
  const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const { data: rows, error } = await admin
    .from("customer_feedback")
    .select("rating, message, source, created_at")
    .eq("shop_id", shopId)
    .gte("created_at", windowStart.toISOString())
    .not("message", "is", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const reviews = rows ?? [];
  if (reviews.length < MIN_ROWS) return { built: false as const, reason: "not_enough_feedback" };

  const { data: latest } = await admin
    .from("feedback_reports")
    .select("created_at, feedback_count")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!options.force && latest && latest.feedback_count >= reviews.length) {
    return { built: false as const, reason: "no_new_feedback" };
  }

  const report = await analyzeShopReport(apiKey, reviews);

  const { data: scored } = await admin
    .from("customer_feedback")
    .select("sentiment_score")
    .eq("shop_id", shopId)
    .gte("created_at", windowStart.toISOString())
    .not("sentiment_score", "is", null);
  const scores = (scored ?? []).map((r) => Number(r.sentiment_score));
  const overall =
    scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null;

  const { data: saved, error: insErr } = await admin
    .from("feedback_reports")
    .insert({
      shop_id: shopId,
      window_start: windowStart.toISOString(),
      window_end: new Date().toISOString(),
      overall_sentiment: overall,
      summary: report.summary,
      praise_themes: report.praise_themes,
      complaint_themes: report.complaint_themes,
      suggestions: report.suggestions,
      model: FEEDBACK_MODEL,
      feedback_count: reviews.length,
    })
    .select("id, created_at")
    .single();
  if (insErr) throw new Error(insErr.message);

  return { built: true as const, report: saved };
}