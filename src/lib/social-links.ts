import { z } from "zod";

export type SocialPlatform = "instagram" | "facebook" | "tiktok" | "x" | "youtube" | "website";

export type CustomLink = { label: string; url: string };

export type ShopLinks = {
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  x_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
  contact_phone: string | null;
  whatsapp: string | null;
  social_links: CustomLink[];
};

export const PLATFORMS: {
  key: SocialPlatform;
  column: keyof ShopLinks;
  label: string;
  hosts: string[];
  base: string | null;
  placeholder: string;
}[] = [
  {
    key: "instagram",
    column: "instagram_url",
    label: "Instagram",
    hosts: ["instagram.com", "instagr.am"],
    base: "https://instagram.com/",
    placeholder: "@yourshop or https://instagram.com/yourshop",
  },
  {
    key: "facebook",
    column: "facebook_url",
    label: "Facebook",
    hosts: ["facebook.com", "fb.com", "fb.me", "m.facebook.com"],
    base: "https://facebook.com/",
    placeholder: "@yourshop or https://facebook.com/yourshop",
  },
  {
    key: "tiktok",
    column: "tiktok_url",
    label: "TikTok",
    hosts: ["tiktok.com", "vm.tiktok.com"],
    base: "https://tiktok.com/@",
    placeholder: "@yourshop or https://tiktok.com/@yourshop",
  },
  {
    key: "x",
    column: "x_url",
    label: "X (Twitter)",
    hosts: ["x.com", "twitter.com"],
    base: "https://x.com/",
    placeholder: "@yourshop or https://x.com/yourshop",
  },
  {
    key: "youtube",
    column: "youtube_url",
    label: "YouTube",
    hosts: ["youtube.com", "youtu.be", "m.youtube.com"],
    base: "https://youtube.com/@",
    placeholder: "@yourchannel or https://youtube.com/@yourchannel",
  },
  {
    key: "website",
    column: "website_url",
    label: "Website",
    hosts: [],
    base: null,
    placeholder: "https://yourshop.com",
  },
];

const stripAt = (value: string) => value.replace(/^@+/, "").replace(/^\/+|\/+$/g, "");

/** "a Facebook" / "an Instagram" — keeps validation messages readable. */
const article = (label: string) => (/^[AEIOU]/i.test(label) ? "an" : "a");

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Accepts a full URL or a bare handle and returns a canonical https URL.
 * Throws a user-facing message when the value can't be used for this platform.
 */
export function normalizeSocial(platform: SocialPlatform, raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.length > 300) throw new Error("That link is too long (max 300 characters).");

  const meta = PLATFORMS.find((p) => p.key === platform)!;
  const looksLikeUrl = /^(https?:)?\/\//i.test(value) || /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(value);

  if (!looksLikeUrl) {
    if (!meta.base) throw new Error("Enter a full website link starting with https://");
    const handle = stripAt(value);
    if (!/^[A-Za-z0-9._-]{1,60}$/.test(handle)) {
      throw new Error(`That doesn't look like a valid ${meta.label} handle.`);
    }
    return `${meta.base}${handle}`;
  }

  const withScheme = /^https?:\/\//i.test(value)
    ? value
    : value.startsWith("//")
      ? `https:${value}`
      : `https://${value}`;
  if (/^http:\/\//i.test(withScheme)) {
    throw new Error("Links must start with https:// for security.");
  }
  const host = hostOf(withScheme);
  if (!host) throw new Error("That link isn't a valid web address.");
  if (meta.hosts.length > 0 && !meta.hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
    throw new Error(`That link isn't ${article(meta.label)} ${meta.label} address.`);
  }
  return withScheme;
}

export function normalizePhone(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (!/^[+()\d\s.-]{7,30}$/.test(value)) {
    throw new Error("Phone can only contain digits and + ( ) - . spaces.");
  }
  return value;
}

export function normalizeWhatsapp(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length < 7 || digits.length > 15) {
    throw new Error("Enter a WhatsApp number in international format, e.g. +1 555 123 4567.");
  }
  return digits;
}

export const customLinkSchema = z.object({
  label: z.string().trim().min(1, "Add a label").max(30, "Labels can be 30 characters max"),
  url: z.string().trim().max(300),
});

export function normalizeCustomLinks(raw: unknown): CustomLink[] {
  const parsed = z
    .array(customLinkSchema)
    .max(5, "You can add up to 5 custom links")
    .parse(raw ?? []);
  return parsed.map((link) => {
    const url = normalizeSocial("website", link.url);
    if (!url) throw new Error(`Add a link for "${link.label}"`);
    return { label: link.label, url };
  });
}

export function parseCustomLinks(value: unknown): CustomLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { label, url } = entry as { label?: unknown; url?: unknown };
    if (typeof label !== "string" || typeof url !== "string") return [];
    if (!url.startsWith("https://")) return [];
    return [{ label: label.slice(0, 30), url }];
  });
}

/** Absolute profile URLs suitable for JSON-LD sameAs. */
export function sameAsUrls(
  links: Partial<Omit<ShopLinks, "social_links">> | null | undefined,
): string[] {
  if (!links) return [];
  return PLATFORMS.map((p) => links[p.column as keyof typeof links]).filter(
    (v): v is string => typeof v === "string" && v.startsWith("https://"),
  );
}
