import { defineTool } from "@lovable.dev/mcp-js";
import { createSupabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_shops",
  title: "List my shops",
  description: "List all barbershops owned by the signed-in The Standing Chair user.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = createSupabaseForUser(ctx);
    const { data, error } = await supabase
      .from("shops")
      .select("id, name, slug, address, description, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { shops: data ?? [] },
    };
  },
});