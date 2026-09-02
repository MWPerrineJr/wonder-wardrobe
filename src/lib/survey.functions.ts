import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { dbError } from "@/lib/db-error";

// Public, tokenized survey submission — the email-survey path.
//
// No auth middleware on purpose: the recipient clicks a link in their inbox and
// has no session. Authorization comes from the invite token itself, which is a
// high-entropy uuid. These handlers call narrowly-scoped, token-matched RPCs
// through the privileged server client; anonymous users cannot read the
// survey_invites table directly.

export type SurveyInviteView = {
  status: "ok" | "expired" | "used" | "invalid";
  shopName?: string;
  providerName?: string | null;
  customerName?: string | null;
  ratingHint?: number | null;
};

type SurveyInviteRow = {
  status: SurveyInviteView["status"];
  shop_name: string | null;
  provider_name: string | null;
  customer_name: string | null;
  rating_hint: number | null;
};

type SubmitSurveyRow = {
  feedback_id: string;
  rating: number;
  created_at: string;
  google_review_url: string | null;
  prompt_google: boolean;
};

export const getSurveyInvite = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<SurveyInviteView> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite, error } = await supabaseAdmin
      .rpc("get_survey_invite_by_token", { _token: data.token })
      .maybeSingle();
    if (error) throw dbError(error, "survey");
    if (!invite) return { status: "invalid" };

    const row = invite as SurveyInviteRow;
    return {
      status: row.status,
      shopName: row.shop_name ?? undefined,
      providerName: row.provider_name,
      customerName: row.customer_name,
      ratingHint: row.rating_hint,
    };
  });

export const submitSurveyFeedback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        message: z.string().trim().min(5, "Tell us a little more").max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: saved, error } = await supabaseAdmin
      .rpc("submit_survey_feedback", {
        _token: data.token,
        _rating: data.rating,
        _message: data.message,
      })
      .maybeSingle();

    if (error) {
      const raw = "message" in error ? String(error.message) : "";
      if (raw.includes("invalid, expired, or already used")) {
        throw new Error("This survey link is invalid, expired, or already used.");
      }
      throw dbError(error, "survey");
    }
    if (!saved) throw new Error("This survey link is invalid, expired, or already used.");

    const row = saved as SubmitSurveyRow;
    return {
      id: row.feedback_id,
      rating: row.rating,
      created_at: row.created_at,
      googleReviewUrl: row.google_review_url,
      promptGoogle: row.prompt_google,
    };
  });
