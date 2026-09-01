import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { SocialLinks } from "@/components/social-links";
import { updateShopLinks } from "@/lib/owner.functions";
import { PLATFORMS, parseCustomLinks, type CustomLink } from "@/lib/social-links";

export type ShopLinkValues = {
  instagram_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  x_url?: string | null;
  youtube_url?: string | null;
  website_url?: string | null;
  contact_phone?: string | null;
  whatsapp?: string | null;
  social_links?: unknown;
};

const field =
  "bg-surface-container border border-border-subtle rounded-lg px-3 py-2 text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:outline-none w-full";
const label = "font-label-md text-label-md text-on-surface-variant";

export function ShopLinksPanel({
  shopId,
  shopName,
  shop,
}: {
  shopId: string;
  shopName: string;
  shop: ShopLinkValues;
}) {
  const qc = useQueryClient();
  const [instagram, setInstagram] = useState(shop.instagram_url ?? "");
  const [facebook, setFacebook] = useState(shop.facebook_url ?? "");
  const [tiktok, setTiktok] = useState(shop.tiktok_url ?? "");
  const [x, setX] = useState(shop.x_url ?? "");
  const [youtube, setYoutube] = useState(shop.youtube_url ?? "");
  const [website, setWebsite] = useState(shop.website_url ?? "");
  const [phone, setPhone] = useState(shop.contact_phone ?? "");
  const [whatsapp, setWhatsapp] = useState(shop.whatsapp ?? "");
  const [custom, setCustom] = useState<CustomLink[]>(parseCustomLinks(shop.social_links));

  const values = { instagram, facebook, tiktok, x, youtube, website };

  const save = useMutation({
    mutationFn: () =>
      updateShopLinks({
        data: {
          shopId,
          links: {
            instagram,
            facebook,
            tiktok,
            x,
            youtube,
            website,
            contact_phone: phone,
            whatsapp,
            custom,
          },
        },
      }),
    onSuccess: async (saved) => {
      setInstagram(saved.instagram_url ?? "");
      setFacebook(saved.facebook_url ?? "");
      setTiktok(saved.tiktok_url ?? "");
      setX(saved.x_url ?? "");
      setYoutube(saved.youtube_url ?? "");
      setWebsite(saved.website_url ?? "");
      setPhone(saved.contact_phone ?? "");
      setWhatsapp(saved.whatsapp ?? "");
      setCustom(parseCustomLinks(saved.social_links));
      await qc.invalidateQueries({ queryKey: ["owner", "shops"] });
      toast.success("Links saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setters: Record<string, (v: string) => void> = {
    instagram: setInstagram,
    facebook: setFacebook,
    tiktok: setTiktok,
    x: setX,
    youtube: setYoutube,
    website: setWebsite,
  };

  const preview: ShopLinkValues = {
    instagram_url: instagram || null,
    facebook_url: facebook || null,
    tiktok_url: tiktok || null,
    x_url: x || null,
    youtube_url: youtube || null,
    website_url: website || null,
    contact_phone: phone || null,
    whatsapp: whatsapp ? whatsapp.replace(/[^\d]/g, "") : null,
    social_links: custom,
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-surface border border-border-subtle rounded-xl p-6 flex flex-col gap-5 shadow-sm">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Social & contact links
          </h2>
          <p className="text-on-surface-variant text-body-md mt-1">
            These appear on your public page. Paste a full link or just your handle — we'll tidy it
            up.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PLATFORMS.map((p) => (
            <label key={p.key} className="flex flex-col gap-1">
              <span className={label}>{p.label}</span>
              <input
                className={field}
                value={values[p.key as keyof typeof values]}
                placeholder={p.placeholder}
                onChange={(e) => setters[p.key](e.target.value)}
              />
            </label>
          ))}
          <label className="flex flex-col gap-1">
            <span className={label}>Phone</span>
            <input
              className={field}
              value={phone}
              placeholder="(555) 123-4567"
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>WhatsApp</span>
            <input
              className={field}
              value={whatsapp}
              placeholder="+1 555 123 4567"
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className={label}>Custom links ({custom.length}/5)</span>
            {custom.length < 5 && (
              <button
                type="button"
                onClick={() => setCustom([...custom, { label: "", url: "" }])}
                className="text-primary font-label-md text-label-md hover:underline"
              >
                + Add link
              </button>
            )}
          </div>
          {custom.length === 0 && (
            <p className="text-on-surface-variant text-body-md">
              Add anything else — a menu, gift cards, a Linktree.
            </p>
          )}
          {custom.map((link, i) => (
            <div key={i} className="flex flex-col md:flex-row gap-2">
              <input
                className={`${field} md:w-48`}
                value={link.label}
                maxLength={30}
                placeholder="Label"
                onChange={(e) =>
                  setCustom(custom.map((c, ci) => (ci === i ? { ...c, label: e.target.value } : c)))
                }
              />
              <input
                className={field}
                value={link.url}
                placeholder="https://…"
                onChange={(e) =>
                  setCustom(custom.map((c, ci) => (ci === i ? { ...c, url: e.target.value } : c)))
                }
              />
              <button
                type="button"
                aria-label="Remove link"
                onClick={() => setCustom(custom.filter((_, ci) => ci !== i))}
                className="border border-border-subtle rounded-lg px-3 py-2 text-on-surface-variant hover:text-on-surface hover:border-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="bg-primary text-on-primary rounded-lg px-5 py-2 font-label-md font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {save.isPending ? "Saving…" : "Save links"}
          </button>
        </div>
      </section>

      <section className="bg-surface border border-border-subtle rounded-xl p-6 flex flex-col gap-3 shadow-sm">
        <h3 className="font-label-md text-label-md text-on-surface-variant">
          Preview on your public page
        </h3>
        <SocialLinks shop={preview} shopName={shopName} />
      </section>
    </div>
  );
}
