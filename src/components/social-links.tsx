import { PLATFORMS, parseCustomLinks, type ShopLinks } from "@/lib/social-links";

type ShopLinkSource = Partial<Omit<ShopLinks, "social_links">> & { social_links?: unknown };

const Brand = {
  instagram: (
    <path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 1.8.25 2.2.42.6.23 1 .5 1.4.9.4.4.7.8.9 1.4.17.4.36 1 .42 2.2.07 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.2-.25 1.8-.42 2.2-.23.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.17-1 .36-2.2.42-1.3.07-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.06-1.8-.25-2.2-.42-.6-.23-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.17-.4-.36-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.2.25-1.8.42-2.2.23-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.17 1-.36 2.2-.42C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.14 0-3.5.01-4.73.07-.94.04-1.4.2-1.73.32-.42.16-.7.35-1 .65-.3.3-.49.58-.65 1-.13.33-.28.79-.32 1.73C3.5 8.8 3.5 9.16 3.5 12s.01 3.2.07 4.43c.04.94.2 1.4.32 1.73.16.42.35.7.65 1 .3.3.58.49 1 .65.33.13.79.28 1.73.32 1.23.06 1.59.07 4.73.07s3.5-.01 4.73-.07c.94-.04 1.4-.2 1.73-.32.42-.16.7-.35 1-.65.3-.3.49-.58.65-1 .13-.33.28-.79.32-1.73.06-1.23.07-1.59.07-4.43s-.01-3.2-.07-4.43c-.04-.94-.2-1.4-.32-1.73a2.7 2.7 0 0 0-.65-1c-.3-.3-.58-.49-1-.65-.33-.13-.79-.28-1.73-.32C15.5 4.01 15.14 4 12 4Zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 1.8a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2Zm5.2-2.3a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z" />
  ),
  facebook: (
    <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6c-.29-.04-1.3-.12-2.47-.12-2.45 0-4.13 1.5-4.13 4.24V9.9H7.4V13h2.2v8h3.9Z" />
  ),
  tiktok: (
    <path d="M16.6 2h-3v13.1a2.5 2.5 0 1 1-2.5-2.5c.26 0 .5.04.74.11V9.6a5.6 5.6 0 1 0 4.76 5.53V8.4a6.3 6.3 0 0 0 3.4 1.06V6.4a3.4 3.4 0 0 1-3.4-3.4V2Z" />
  ),
  x: (
    <path d="M17.6 3h3.1l-6.8 7.8 7.4 10.2h-6l-4.4-6-5 6H2.8l7.1-8.2L2.8 3h6.1l4.1 5.6L17.6 3Zm-1.1 16.2h1.7L7.3 4.7H5.5l11 14.5Z" />
  ),
  youtube: (
    <path d="M21.6 7.4c-.23-.86-.9-1.53-1.76-1.76C18.25 5.2 12 5.2 12 5.2s-6.25 0-7.84.44c-.86.23-1.53.9-1.76 1.76C2 9 2 12 2 12s0 3 .4 4.6c.23.86.9 1.53 1.76 1.76 1.59.44 7.84.44 7.84.44s6.25 0 7.84-.44c.86-.23 1.53-.9 1.76-1.76.4-1.6.4-4.6.4-4.6s0-3-.4-4.6ZM10 15.2V8.8L15.5 12 10 15.2Z" />
  ),
} as const;

function BrandIcon({ platform }: { platform: keyof typeof Brand }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-current">
      {Brand[platform]}
    </svg>
  );
}

const pill =
  "inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-4 py-2 text-on-surface hover:border-primary hover:text-primary transition-colors font-label-md text-label-md";

export function SocialLinks({ shop, shopName }: { shop: ShopLinkSource; shopName: string }) {
  const custom = parseCustomLinks(shop.social_links);
  const socials = PLATFORMS.filter((p) => p.key !== "website")
    .map((p) => ({ ...p, url: shop[p.column as keyof ShopLinkSource] as string | undefined }))
    .filter((p): p is typeof p & { url: string } => typeof p.url === "string" && !!p.url);

  const hasAny =
    socials.length > 0 ||
    custom.length > 0 ||
    !!shop.website_url ||
    !!shop.contact_phone ||
    !!shop.whatsapp;
  if (!hasAny) return null;

  return (
    <section aria-label={`Follow and contact ${shopName}`} className="flex flex-wrap gap-3">
      {socials.map((p) => (
        <a
          key={p.key}
          href={p.url}
          target="_blank"
          rel="noreferrer"
          className={pill}
          title={p.label}
        >
          <BrandIcon platform={p.key as keyof typeof Brand} />
          <span>{p.label}</span>
        </a>
      ))}
      {shop.website_url && (
        <a href={shop.website_url} target="_blank" rel="noreferrer" className={pill}>
          <span className="material-symbols-outlined text-[20px]">language</span>
          <span>Website</span>
        </a>
      )}
      {shop.contact_phone && (
        <a href={`tel:${shop.contact_phone.replace(/[^\d+]/g, "")}`} className={pill}>
          <span className="material-symbols-outlined text-[20px]">call</span>
          <span>{shop.contact_phone}</span>
        </a>
      )}
      {shop.whatsapp && (
        <a
          href={`https://wa.me/${shop.whatsapp}`}
          target="_blank"
          rel="noreferrer"
          className={pill}
        >
          <span className="material-symbols-outlined text-[20px]">chat</span>
          <span>WhatsApp</span>
        </a>
      )}
      {custom.map((link) => (
        <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className={pill}>
          <span className="material-symbols-outlined text-[20px]">link</span>
          <span>{link.label}</span>
        </a>
      ))}
    </section>
  );
}
