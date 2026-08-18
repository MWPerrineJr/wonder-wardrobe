import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FILTER_ALL = "all";

const filtersSchema = z.object({
  shopId: z.string().uuid(),
  environment: z.enum(["sandbox", "live"]).default("live"),
  source: z.string().optional(),
  sentiment: z.string().optional(),
  urgency: z.string().optional(),
  status: z.string().optional(),
});

export type FeedbackRow = {
  id: string;
  shop_id: string;
  customer_name: string | null;
  customer_email: string | null;
  source: string | null;
  message: string | null;
  rating: number | null;
  sentiment_label: string | null;
  sentiment_score: number | null;
  emotion: string | null;
  urgency: string | null;
  summary: string | null;
  explanation: string | null;
  key_phrases: string[];
  recommended_response: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export const listFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filtersSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Analytics is the paid plan: without an active subscription the page
    // renders an upgrade prompt instead of data. Checked server-side so the
    // gate can't be bypassed by calling the function directly.
    const { data: hasAnalytics, error: gateErr } = await supabase.rpc("shop_has_active_analytics", {
      _shop_id: data.shopId,
      _env: data.environment,
    });
    if (gateErr) throw new Error(gateErr.message);
    if (!hasAnalytics) {
      return {
        locked: true,
        rows: [] as FeedbackRow[],
        aggregates: {
          total: 0,
          avgSentiment: null as number | null,
          negativeCount: 0,
          highUrgencyCount: 0,
        },
      };
    }

    let query = supabase
      .from("customer_feedback")
      .select("*")
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.source && data.source !== FILTER_ALL) query = query.eq("source", data.source);
    if (data.sentiment && data.sentiment !== FILTER_ALL)
      query = query.eq("sentiment_label", data.sentiment);
    if (data.urgency && data.urgency !== FILTER_ALL) query = query.eq("urgency", data.urgency);
    if (data.status && data.status !== FILTER_ALL) query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    // Aggregates across ALL feedback for the shop (unfiltered) so KPIs stay stable
    const { data: allRows, error: aggErr } = await supabase
      .from("customer_feedback")
      .select("sentiment_label, sentiment_score, urgency")
      .eq("shop_id", data.shopId);
    if (aggErr) throw new Error(aggErr.message);

    const total = allRows?.length ?? 0;
    const scored = (allRows ?? []).filter((r) => r.sentiment_score !== null);
    const avgSentiment =
      scored.length === 0
        ? null
        : scored.reduce((sum, r) => sum + Number(r.sentiment_score ?? 0), 0) / scored.length;
    const negativeCount = (allRows ?? []).filter(
      (r) => r.sentiment_label === "negative" || r.sentiment_label === "very_negative",
    ).length;
    const highUrgencyCount = (allRows ?? []).filter((r) => r.urgency === "high").length;

    return {
      locked: false,
      rows: (rows ?? []) as FeedbackRow[],
      aggregates: {
        total,
        avgSentiment,
        negativeCount,
        highUrgencyCount,
      },
    };
  });

export const updateFeedbackStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "reviewed", "responded", "archived"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: saved, error } = await context.supabase
      .from("customer_feedback")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("id, status, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });

const SubmitFeedbackInput = z.object({
  shopId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().min(5, "Tell us a little more").max(2000),
  customerName: z.string().trim().max(80).optional().nullable(),
  customerEmail: z
    .string()
    .trim()
    .email("Enter a valid email")
    .max(120)
    .optional()
    .nullable()
    .or(z.literal("")),
});

// ---------- AI shop report ----------

export type ShopReport = {
  id: string;
  created_at: string;
  window_start: string;
  window_end: string;
  overall_sentiment: number | null;
  summary: string;
  praise_themes: string[];
  complaint_themes: string[];
  suggestions: string[];
  feedback_count: number;
  model: string | null;
};

export const getShopReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ shopId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ report: ShopReport | null }> => {
    const { data: report, error } = await context.supabase
      .from("feedback_reports")
      .select(
        "id, created_at, window_start, window_end, overall_sentiment, summary, praise_themes, complaint_themes, suggestions, feedback_count, model",
      )
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { report: (report as ShopReport | null) ?? null };
  });

export const regenerateShopReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        shopId: z.string().uuid(),
        environment: z.enum(["sandbox", "live"]).default("live"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Owner-only, and only on the paid plan — this spends an AI call.
    const { data: shop, error: shopErr } = await supabase
      .from("shops")
      .select("id, owner_id")
      .eq("id", data.shopId)
      .maybeSingle();
    if (shopErr) throw new Error(shopErr.message);
    if (!shop || shop.owner_id !== userId) throw new Error("Not your shop");

    const { data: hasAnalytics, error: gateErr } = await supabase.rpc(
      "shop_has_active_analytics",
      { _shop_id: data.shopId, _env: data.environment },
    );
    if (gateErr) throw new Error(gateErr.message);
    if (!hasAnalytics) throw new Error("The analytics plan is required to generate reports.");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildShopReport } = await import("@/lib/shop-report.server");
    const { classifyGatewayError } = await import("@/lib/ai.server");

    try {
      const result = await buildShopReport(supabaseAdmin, apiKey, data.shopId, { force: true });
      if (!result.built) {
        throw new Error(
          result.reason === "not_enough_feedback"
            ? "Not enough feedback yet — you need at least 3 written reviews."
            : "Nothing new to report yet.",
        );
      }
      return { ok: true as const };
    } catch (err) {
      const failure = classifyGatewayError(err);
      if (failure.kind === "pause") throw new Error(failure.reason);
      throw err;
    }
  });

const _LegacySubmitFeedbackInput = z.object({
  shopId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().min(5, "Tell us a little more").max(2000),
  customerName: z.string().trim().max(80).optional().nullable(),
  customerEmail: z
    .string()
    .trim()
    .email("Enter a valid email")
    .max(120)
    .optional()
    .nullable()
    .or(z.literal("")),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubmitFeedbackInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email =
      (data.customerEmail && data.customerEmail.length > 0
        ? data.customerEmail
        : (claims as { email?: string } | null)?.email) ?? null;

    const { data: saved, error } = await supabase
      .from("customer_feedback")
      .insert({
        shop_id: data.shopId,
        customer_id: userId,
        customer_name: data.customerName || null,
        customer_email: email,
        rating: data.rating,
        message: data.message,
        source: "web",
        status: "new",
      })
      .select("id, rating, message, created_at")
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });
