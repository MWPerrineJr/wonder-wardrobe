import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dbError } from "@/lib/db-error";
import { requirePaymentsEnv } from "@/lib/payments-env";
import {
  INSIGHTS_MIN_APPOINTMENTS,
  type AnalyticsBriefing,
  type AnalyticsInsightsResult,
} from "@/lib/analytics-insights-types";

const insightsInput = z.object({
  shopId: z.string().uuid(),
  environment: z.enum(["sandbox", "live"]).default("live"),
  days: z.number().int().min(7).max(365).default(30),
});

type Input = z.infer<typeof insightsInput>;

type AuthContext = {
  supabase: Parameters<typeof unusedTypeAnchor>[0];
  userId: string;
};

// Type anchor only: keeps the helper's supabase parameter tied to the middleware
// client type without importing server-only modules at module scope.
declare function unusedTypeAnchor(client: never): void;

async function loadInsights(
  context: { supabase: AuthContext["supabase"]; userId: string },
  data: Input,
  force: boolean,
): Promise<AnalyticsInsightsResult> {
  const supabase = context.supabase as unknown as {
    from: (table: string) => any;
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };

  const shopRes = await supabase.from("shops").select("id, owner_id").eq("id", data.shopId).maybeSingle();
  if (shopRes.error) throw dbError(shopRes.error, "analytics insights");
  if (!shopRes.data || shopRes.data.owner_id !== context.userId) throw new Error("Not your shop");

  const environment = requirePaymentsEnv(data.environment);
  const gate = await supabase.rpc("shop_has_active_analytics", {
    _shop_id: data.shopId,
    _env: environment,
  });
  if (gate.error) throw dbError(gate.error, "analytics insights");
  if (!gate.data) return { state: "locked" };

  const { buildShopAnalytics } = await import("@/lib/analytics.server");
  const { buildInsightFacts, generateBriefing } = await import("@/lib/analytics-insights.server");

  const analytics = await buildShopAnalytics(context.supabase as never, {
    shopId: data.shopId,
    days: data.days,
  });
  const facts = buildInsightFacts(analytics);

  const cachedRes = await supabase
    .from("analytics_insights")
    .select("payload, input_fingerprint, model, created_at, updated_at")
    .eq("shop_id", data.shopId)
    .eq("range_days", data.days)
    .maybeSingle();
  if (cachedRes.error) throw dbError(cachedRes.error, "analytics insights");
  const cached = cachedRes.data as
    | {
        payload: AnalyticsBriefing;
        input_fingerprint: string;
        model: string | null;
        created_at: string;
        updated_at: string;
      }
    | null;

  if (facts.appointments < INSIGHTS_MIN_APPOINTMENTS && !cached) {
    return {
      state: "insufficient_data",
      message: `Insights need at least ${INSIGHTS_MIN_APPOINTMENTS} appointments in this range. Once bookings come in, a written briefing appears here.`,
    };
  }

  const fresh = cached !== null && cached.input_fingerprint === facts.fingerprint;
  if (cached && fresh && !force) {
    return {
      state: "ready",
      briefing: cached.payload,
      generatedAt: cached.updated_at ?? cached.created_at,
      rangeDays: data.days,
      stale: false,
      model: cached.model,
    };
  }

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    if (cached) {
      return {
        state: "ready",
        briefing: cached.payload,
        generatedAt: cached.updated_at ?? cached.created_at,
        rangeDays: data.days,
        stale: true,
        model: cached.model,
      };
    }
    throw new Error("AI insights are not configured for this workspace yet.");
  }

  const { FEEDBACK_MODEL } = await import("@/lib/ai.server");
  const { classifyGatewayError } = await import("@/lib/ai.server");

  let briefing: AnalyticsBriefing;
  try {
    briefing = await generateBriefing(apiKey, facts.lines);
  } catch (error) {
    const failure = classifyGatewayError(error);
    if (cached) {
      // Keep showing the last good briefing rather than failing the panel.
      return {
        state: "ready",
        briefing: cached.payload,
        generatedAt: cached.updated_at ?? cached.created_at,
        rangeDays: data.days,
        stale: true,
        model: cached.model,
      };
    }
    if (failure.kind === "pause") {
      throw new Error(
        "AI insights are unavailable right now because the workspace AI credits are exhausted or blocked.",
      );
    }
    if (failure.kind === "backoff") {
      throw new Error("The AI service is busy. Try refreshing insights in a minute.");
    }
    throw new Error(`Could not write the briefing: ${failure.reason}`);
  }

  const saveRes = await supabase
    .from("analytics_insights")
    .upsert(
      {
        shop_id: data.shopId,
        range_days: data.days,
        window_start: analytics.range.start,
        window_end: analytics.range.end,
        input_fingerprint: facts.fingerprint,
        payload: briefing,
        model: FEEDBACK_MODEL,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shop_id,range_days" },
    )
    .select("updated_at, created_at")
    .single();
  if (saveRes.error) throw dbError(saveRes.error, "analytics insights");

  return {
    state: "ready",
    briefing,
    generatedAt: saveRes.data?.updated_at ?? new Date().toISOString(),
    rangeDays: data.days,
    stale: false,
    model: FEEDBACK_MODEL,
  };
}

export const getAnalyticsInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => insightsInput.parse(input))
  .handler(
    async ({ data, context }): Promise<AnalyticsInsightsResult> =>
      loadInsights(context as never, data, false),
  );

export const refreshAnalyticsInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => insightsInput.parse(input))
  .handler(
    async ({ data, context }): Promise<AnalyticsInsightsResult> =>
      loadInsights(context as never, data, true),
  );
