import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public, tokenized survey submission — the email-survey path.
//
// No auth middleware on purpose: the recipient clicks a link in their inbox and
// has no session. Authorization comes from the invite token itself, which is a
// high-entropy uuid that only ever exists in the survey_invites table (service
// role only — no anon/authenticated grants) and in the recipient's email.
//
// Both handlers use the service-role client, loaded dynamically inside the
// handler per the client.server.ts convention so it never reaches the client
// bundle.

const tokenSchema = z.object({ token: z.string().uuid() });

export type SurveyInviteView = {
  status: "ok" | "expired" | "used" | "invalid";
  shopName?: string;
  providerName?: string | null;
  customerName?: string | null;
};

export const getSurveyInvite = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }): Promise<SurveyInviteView> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite, error } = await supabaseAdmin
      .from("survey_invites")
      .select("id, shop_id, provider_id, customer_name, expires_at, responded_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invite) return { status: "invalid" };
    if (invite.responded_at) return { status: "used" };
    if (new Date(invite.expires_at) < new Date()) return { status: "expired" };

    const [{ data: shop }, provider] = await Promise.all([
      supabaseAdmin.from("shops").select("name").eq("id", invite.shop_id).maybeSingle(),
      invite.provider_id
        ? supabaseAdmin
            .from("providers")
            .select("display_name")
            .eq("id", invite.provider_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return {
      status: "ok",
      shopName: shop?.name ?? "this shop",
      providerName: provider?.data?.display_name ?? null,
      customerName: invite.customer_name,
    };
  });

const SubmitSurveyInput = z.object({
  token: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().min(5, "Tell us a little more").max(2000),
});

export const submitSurveyFeedback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SubmitSurveyInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Atomically claim the invite: only one submission can flip responded_at
    // from NULL, so a double-click or a replayed link can't create duplicates.
    const { data: invite, error: claimErr } = await supabaseAdmin
      .from("survey_invites")
      .update({ responded_at: new Date().toISOString() })
      .eq("token", data.token)
      .is("responded_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("id, shop_id, customer_id, customer_name, customer_email")
      .maybeSingle();
    if (claimErr) throw new Error(claimErr.message);
    if (!invite) throw new Error("This survey link is invalid, expired, or already used.");

    const { data: saved, error: insErr } = await supabaseAdmin
      .from("customer_feedback")
      .insert({
        shop_id: invite.shop_id,
        customer_id: invite.customer_id,
        customer_name: invite.customer_name,
        customer_email: invite.customer_email,
        rating: data.rating,
        message: data.message,
        source: "email_survey",
        status: "new",
      })
      .select("id, rating, created_at")
      .single();
    if (insErr) {
      // Roll the claim back so the customer can retry rather than losing
      // their one shot at the token.
      await supabaseAdmin.from("survey_invites").update({ responded_at: null }).eq("id", invite.id);
      throw new Error(insErr.message);
    }

    await supabaseAdmin
      .from("survey_invites")
      .update({ feedback_id: saved.id })
      .eq("id", invite.id);

    return saved;
  });
