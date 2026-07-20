import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createSupabaseForUser } from "../supabase";

export default defineTool({
  name: "list_shop_feedback",
  title: "List shop feedback",
  description:
    "List customer feedback rows for a shop owned by the signed-in user, optionally filtered by status/sentiment/urgency.",
  inputSchema: {
    shop_id: z.string().uuid().describe("The shop UUID."),
    status: z.enum(["new", "reviewed", "responded", "archived"]).optional(),
    sentiment: z.enum(["very_positive", "positive", "neutral", "negative", "very_negative"]).optional(),
    urgency: z.enum(["low", "medium", "high"]).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ shop_id, status, sentiment, urgency, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = createSupabaseForUser(ctx);
    let query = supabase
      .from("customer_feedback")
      .select(
        "id, customer_name, source, rating, sentiment_label, sentiment_score, emotion, urgency, summary, message, recommended_response, status, created_at",
      )
      .eq("shop_id", shop_id)
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (status) query = query.eq("status", status);
    if (sentiment) query = query.eq("sentiment_label", sentiment);
    if (urgency) query = query.eq("urgency", urgency);
    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { feedback: data ?? [] },
    };
  },
});