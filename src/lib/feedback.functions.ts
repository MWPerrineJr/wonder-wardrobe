import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FILTER_ALL = "all";

const filtersSchema = z.object({
  shopId: z.string().uuid(),
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
    let query = supabase
      .from("customer_feedback")
      .select("*")
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.source && data.source !== FILTER_ALL) query = query.eq("source", data.source);
    if (data.sentiment && data.sentiment !== FILTER_ALL) query = query.eq("sentiment_label", data.sentiment);
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
  customerEmail: z.string().trim().email("Enter a valid email").max(120).optional().nullable().or(z.literal("")),
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