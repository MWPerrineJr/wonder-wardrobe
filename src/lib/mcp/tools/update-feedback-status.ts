import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createSupabaseForUser } from "../supabase";

export default defineTool({
  name: "update_feedback_status",
  title: "Update feedback status",
  description:
    "Mark a customer feedback row as reviewed, responded, or archived. Only works on shops owned by the signed-in user.",
  inputSchema: {
    id: z.string().uuid().describe("The customer_feedback row UUID."),
    status: z.enum(["new", "reviewed", "responded", "archived"]),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = createSupabaseForUser(ctx);
    const { data, error } = await supabase
      .from("customer_feedback")
      .update({ status })
      .eq("id", id)
      .select("id, status")
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    if (!data) {
      return {
        content: [{ type: "text", text: "Feedback row not found or not owned by you." }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: `Updated ${data.id} → ${data.status}` }],
      structuredContent: { row: data },
    };
  },
});