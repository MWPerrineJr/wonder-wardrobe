import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createSupabaseForUser } from "../supabase";

export default defineTool({
  name: "list_shop_services",
  title: "List shop services",
  description: "List all services for a shop owned by the signed-in user.",
  inputSchema: {
    shop_id: z.string().uuid().describe("The shop UUID (from list_my_shops)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ shop_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = createSupabaseForUser(ctx);
    const { data, error } = await supabase
      .from("services")
      .select("id, name, description, duration_minutes, price_cents, is_active")
      .eq("shop_id", shop_id)
      .order("name");
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { services: data ?? [] },
    };
  },
});