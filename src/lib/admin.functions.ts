import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dbError } from "@/lib/db-error";

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
};

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
      };
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
        "shop_id, shop_name, shop_slug, owner_name, owner_email, signed_up_at, plan_state, trial_ends_at",
      )
      .order("signed_up_at", { ascending: false })
      .limit(500);
    if (error) throw dbError(error, "admin");

    const now = Date.now();
    const rows: OwnerSignupRow[] = (data ?? []).map((r) => {
      const ends = r.trial_ends_at ? new Date(r.trial_ends_at).getTime() : null;
      return {
        shopId: r.shop_id,
        shopName: r.shop_name,
        shopSlug: r.shop_slug,
        ownerName: r.owner_name,
        ownerEmail: r.owner_email,
        signedUpAt: r.signed_up_at,
        planState: r.plan_state,
        trialEndsAt: r.trial_ends_at,
        trialDaysLeft: ends === null ? null : Math.ceil((ends - now) / DAY_MS),
      };
    });

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
      },
    };
  });
