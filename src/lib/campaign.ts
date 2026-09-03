/**
 * Campaign (UTM) attribution capture.
 *
 * Sign-up campaign links point at /owners, a public landing page that leads
 * into /onboarding/owner. The onboarding route sits behind the auth gate, so
 * the redirect to /auth would drop the query string. We capture the campaign on
 * the very first page view, keep it in localStorage (first touch wins, 30-day
 * TTL) and attach it to the owner signup record when the shop is created.
 */

export const CAMPAIGN_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type CampaignParam = (typeof CAMPAIGN_PARAMS)[number];

export type Campaign = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_referrer: string | null;
  first_touch_at: string;
};

const STORAGE_KEY = "tsc.campaign.v1";
export const CAMPAIGN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const MAX_LEN: Record<string, number> = {
  utm_source: 120,
  utm_medium: 120,
  utm_campaign: 160,
  utm_content: 160,
  utm_term: 160,
  landing_referrer: 500,
};

function clean(value: string | null | undefined, key: string): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, MAX_LEN[key] ?? 160);
  return trimmed.length > 0 ? trimmed : null;
}

/** Parse campaign values out of a location search string. Returns null when there are none. */
export function readCampaignFromSearch(
  search: string,
  referrer?: string | null,
  now: Date = new Date(),
): Campaign | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const values = Object.fromEntries(
    CAMPAIGN_PARAMS.map((key) => [key, clean(params.get(key), key)]),
  ) as Record<CampaignParam, string | null>;

  if (!CAMPAIGN_PARAMS.some((key) => values[key])) return null;

  return {
    ...values,
    landing_referrer: clean(referrer ?? null, "landing_referrer"),
    first_touch_at: now.toISOString(),
  };
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The stored first-touch campaign, or null when absent, malformed, or expired. */
export function getCampaign(now: Date = new Date()): Campaign | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Campaign;
    if (!parsed || typeof parsed.first_touch_at !== "string") return null;
    const age = now.getTime() - new Date(parsed.first_touch_at).getTime();
    if (!Number.isFinite(age) || age < 0 || age > CAMPAIGN_TTL_MS) {
      store.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Record a campaign from the current URL. First touch wins: an existing,
 * unexpired campaign is never overwritten by a later visit.
 */
export function captureCampaign(
  search: string,
  referrer?: string | null,
  now: Date = new Date(),
): Campaign | null {
  const existing = getCampaign(now);
  const incoming = readCampaignFromSearch(search, referrer, now);
  if (!incoming) return existing;
  if (existing) return existing;

  const store = storage();
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(incoming));
  } catch {
    /* storage full or blocked — attribution is best-effort */
  }
  return incoming;
}

export function clearCampaign() {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Map a campaign source onto a "How did you hear about us?" choice, when one matches. */
export function campaignSourceToHeardAbout(source: string | null | undefined): string | null {
  if (!source) return null;
  const key = source.trim().toLowerCase();
  switch (key) {
    case "linkedin":
      return "linkedin";
    case "instagram":
    case "ig":
      return "instagram";
    case "facebook":
    case "fb":
    case "meta":
      return "facebook";
    case "tiktok":
      return "tiktok";
    case "google":
    case "google_ads":
    case "googleads":
      return "google";
    case "referral":
      return "referral";
    default:
      return null;
  }
}

/** Canonical sign-up campaign links, one per channel. */
export const CAMPAIGN_LINKS = [
  { source: "linkedin", label: "LinkedIn" },
  { source: "instagram", label: "Instagram" },
  { source: "facebook", label: "Facebook" },
].map(({ source, label }) => ({
  source,
  label,
  path: `/owners?utm_source=${source}&utm_medium=social&utm_campaign=founding-shops&utm_content=week1-launch`,
}));
