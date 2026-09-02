import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyShops from "./tools/list-my-shops";
import listShopServices from "./tools/list-shop-services";
import listShopBookings from "./tools/list-shop-bookings";
import listShopFeedback from "./tools/list-shop-feedback";
import updateFeedbackStatus from "./tools/update-feedback-status";

// The OAuth issuer must be the direct Supabase host (see cloud-auth-oauth-server).
// Vite inlines VITE_SUPABASE_PROJECT_ID at build time; the fallback keeps the
// issuer well-formed during the manifest-extract eval.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "the-standing-chair-mcp",
  title: "The Standing Chair",
  version: "0.1.0",
  instructions:
    "Tools for The Standing Chair shop owners. Sign in as a shop owner to list your shops, view services, browse upcoming bookings, and read/triage customer feedback.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMyShops, listShopServices, listShopBookings, listShopFeedback, updateFeedbackStatus],
});
