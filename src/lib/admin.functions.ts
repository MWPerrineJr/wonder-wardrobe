import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { HEARD_ABOUT_SOURCES, heardAboutLabel } from "@/lib/attribution";
import { dbError } from "@/lib/db-error";
import {
  TRIAL_EVENT_LABEL,
  TRIAL_SOURCE_LABEL,
  type TrialEvent,
  type TrialSource,
} from "@/lib/trial-events";

export type OwnerSignupRow = {
  shopId: string;
  shopName: string;
  shopSlug: string;
  ownerName: string | null;
  ownerEmail: string | null;
  signedUpAt: string;
  planState: string;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  heardAbout: string | null;
  heardAboutLabel: string;
  heardAboutDetail: string | null;
  trialSource: TrialSource;
  trialSourceLabel: string;
  signupTrialEndsAt: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  firstTouchAt: string | null;
};

export type SourceCount = { value: string; label: string; count: number };

export type OwnerSignupsResult =
  | { access: "denied" }
  | {
      access: "granted";
      rows: OwnerSignupRow[];
      totals: {
        all: number;
        thisWeek: number;
        thisMonth: number;
        trialsEndingSoon: number;
        signupTrialsNoCard: number;
        signupTrialsEndingSoon: number;
      };
      sources: SourceCount[];
      campaignSources: SourceCount[];
      campaigns: SourceCount[];
    };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Admin-only registry of new shop owners. Returns a finished DTO, never raw rows. */
export const listOwnerSignups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerSignupsResult> => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleError) throw dbError(roleError, "admin");
    if (!isAdmin) return { access: "denied" };

    const { data, error } = await supabase
      .from("owner_signups")
      .select(
        "shop_id, shop_name, shop_slug, owner_name, owner_email, signed_up_at, plan_state, trial_ends_at, heard_about, heard_about_detail, trial_source, signup_trial_ends_at, utm_source, utm_medium, utm_campaign, utm_content, first_touch_at",
      )
      .order("signed_up_at", { ascending: false })
      .limit(500);
    if (error) throw dbError(error, "admin");

    const now = Date.now();
    const rows: OwnerSignupRow[] = (data ?? []).map((r) => {
      const source = (r.trial_source ?? "none") as TrialSource;
      const effectiveEnd =
        source === "stripe" ? r.trial_ends_at : (r.signup_trial_ends_at ?? r.trial_ends_at);
      const ends = effectiveEnd ? new Date(effectiveEnd).getTime() : null;
      return {
        shopId: r.shop_id,
        shopName: r.shop_name,
        shopSlug: r.shop_slug,
        ownerName: r.owner_name,
        ownerEmail: r.owner_email,
        signedUpAt: r.signed_up_at,
        planState: r.plan_state,
        trialEndsAt: effectiveEnd,
        trialDaysLeft: ends === null ? null : Math.ceil((ends - now) / DAY_MS),
        heardAbout: r.heard_about,
        heardAboutLabel: heardAboutLabel(r.heard_about),
        heardAboutDetail: r.heard_about_detail,
        trialSource: source,
        trialSourceLabel: TRIAL_SOURCE_LABEL[source] ?? "—",
        signupTrialEndsAt: r.signup_trial_ends_at,
      };
    });

    const sources: SourceCount[] = HEARD_ABOUT_SOURCES.map((s) => ({
      value: s.value as string,
      label: s.label as string,
      count: rows.filter((r) => r.heardAbout === s.value).length,
    }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count);
    const unknown = rows.filter((r) => !r.heardAbout).length;
    if (unknown > 0) sources.push({ value: "unknown", label: "Not answered", count: unknown });

    return {
      access: "granted",
      rows,
      totals: {
        all: rows.length,
        thisWeek: rows.filter((r) => now - new Date(r.signedUpAt).getTime() <= 7 * DAY_MS).length,
        thisMonth: rows.filter((r) => now - new Date(r.signedUpAt).getTime() <= 30 * DAY_MS).length,
        trialsEndingSoon: rows.filter(
          (r) => r.trialDaysLeft !== null && r.trialDaysLeft >= 0 && r.trialDaysLeft <= 14,
        ).length,
        signupTrialsNoCard: rows.filter((r) => r.trialSource === "signup").length,
        signupTrialsEndingSoon: rows.filter(
          (r) =>
            r.trialSource === "signup" &&
            r.trialDaysLeft !== null &&
            r.trialDaysLeft >= 0 &&
            r.trialDaysLeft <= 14,
        ).length,
      },
      sources,
    };
  });

export type TrialEventRow = {
  id: string;
  event: TrialEvent;
  eventLabel: string;
  planState: string | null;
  source: string | null;
  occurredAt: string;
};

export type TrialEventsResult = { access: "denied" } | { access: "granted"; rows: TrialEventRow[] };

/** Admin-only trial history for one shop. */
export const listOwnerTrialEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { shopId: string }) => {
    if (!data || typeof data.shopId !== "string" || data.shopId.length < 10) {
      throw new Error("A shop id is required");
    }
    return { shopId: data.shopId };
  })
  .handler(async ({ data, context }): Promise<TrialEventsResult> => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleError) throw dbError(roleError, "admin");
    if (!isAdmin) return { access: "denied" };

    const { data: events, error } = await supabase
      .from("owner_trial_events")
      .select("id, event, plan_state, source, occurred_at")
      .eq("shop_id", data.shopId)
      .order("occurred_at", { ascending: false })
      .limit(50);
    if (error) throw dbError(error, "admin");

    return {
      access: "granted",
      rows: (events ?? []).map((e) => ({
        id: e.id,
        event: e.event as TrialEvent,
        eventLabel: TRIAL_EVENT_LABEL[e.event as TrialEvent] ?? e.event,
        planState: e.plan_state,
        source: e.source,
        occurredAt: e.occurred_at,
      })),
    };
  });
