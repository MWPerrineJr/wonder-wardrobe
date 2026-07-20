import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createSupabaseForUser } from "../supabase";

export default defineTool({
  name: "list_shop_bookings",
  title: "List shop bookings",
  description:
    "List upcoming or historical bookings for a shop owned by the signed-in user, optionally filtered by date range.",
  inputSchema: {
    shop_id: z.string().uuid().describe("The shop UUID."),
    from: z.string().datetime().optional().describe("ISO timestamp lower bound (starts_at >= from)."),
    to: z.string().datetime().optional().describe("ISO timestamp upper bound (starts_at <= to)."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ shop_id, from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = createSupabaseForUser(ctx);
    let query = supabase
      .from("bookings")
      .select(
        "id, customer_name, customer_phone, starts_at, ends_at, status, price_cents, notes, service_id, barber_id",
      )
      .eq("shop_id", shop_id)
      .order("starts_at", { ascending: true })
      .limit(limit ?? 50);
    if (from) query = query.gte("starts_at", from);
    if (to) query = query.lte("starts_at", to);
    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { bookings: data ?? [] },
    };
  },
});