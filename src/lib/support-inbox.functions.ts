import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

import type {
  SupportInboxFilter,
  SupportThreadDetail,
  SupportThreadSummary,
} from "@/lib/support-inbox.server";

/** Only shop owners may touch the shared support mailbox. */
async function assertOwner(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase
    .from("shops")
    .select("id")
    .eq("owner_id", context.userId)
    .limit(1);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Only shop owners can use the support inbox.");
  }
}

export type SupportInboxStatus =
  { connected: false; reason: "not_connected" } | { connected: true; email: string };

export const getSupportInboxStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SupportInboxStatus> => {
    await assertOwner(context);
    const mod = await import("@/lib/support-inbox.server");
    if (!mod.isSupportInboxConfigured()) return { connected: false, reason: "not_connected" };
    try {
      const profile = await mod.getMailboxProfile();
      return { connected: true, email: profile.emailAddress };
    } catch (err) {
      if (err instanceof mod.SupportInboxNotConnectedError) {
        return { connected: false, reason: "not_connected" };
      }
      throw err;
    }
  });

const listSchema = z.object({
  filter: z.enum(["all", "unread", "archived"]).default("all"),
  search: z.string().max(200).nullable().default(null),
});

export const listSupportThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listSchema.parse(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ threads: SupportThreadSummary[]; error: string | null }> => {
      await assertOwner(context);
      const mod = await import("@/lib/support-inbox.server");
      if (!mod.isSupportInboxConfigured()) return { threads: [], error: "not_connected" };
      try {
        const threads = await mod.listThreads({
          filter: data.filter as SupportInboxFilter,
          search: data.search,
          limit: 30,
        });
        return { threads, error: null };
      } catch (err) {
        if (err instanceof mod.SupportInboxNotConnectedError) {
          return { threads: [], error: "not_connected" };
        }
        if (err instanceof mod.SupportInboxScopeError) {
          return { threads: [], error: err.message };
        }
        throw err;
      }
    },
  );

export const getSupportThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ threadId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }): Promise<SupportThreadDetail> => {
    await assertOwner(context);
    const mod = await import("@/lib/support-inbox.server");
    return mod.getThread(data.threadId);
  });

export const replySupportThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        threadId: z.string().min(1),
        body: z.string().min(1).max(20000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertOwner(context);
    const mod = await import("@/lib/support-inbox.server");
    const thread = await mod.getThread(data.threadId);
    if (!thread.replyTo) throw new Error("This conversation has no reply address.");
    await mod.sendReply({
      threadId: thread.id,
      to: thread.replyTo,
      subject: thread.subject,
      body: data.body,
      inReplyTo: thread.lastMessageId,
      references: thread.references || null,
    });
    await mod.applyThreadAction(thread.id, "read");
    return { ok: true };
  });

export const actOnSupportThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        threadId: z.string().min(1),
        action: z.enum(["read", "unread", "archive", "unarchive", "trash"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertOwner(context);
    const mod = await import("@/lib/support-inbox.server");
    await mod.applyThreadAction(data.threadId, data.action);
    return { ok: true };
  });
