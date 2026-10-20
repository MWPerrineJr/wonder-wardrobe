import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Photo = { id: string; image_url: string; caption: string | null; storage_path: string };

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 30;

function usePortfolio(shopId: string) {
  return useQuery({
    queryKey: ["portfolio", shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_portfolio")
        .select("id, image_url, caption, storage_path")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Photo[];
    },
  });
}

export function PortfolioGallery({ shopId }: { shopId: string }) {
  const { data } = usePortfolio(shopId);
  if (!data?.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-headline-md text-headline-md text-on-surface">Our work</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {data.map((p) => (
          <figure key={p.id} className="rounded-lg overflow-hidden border border-border-subtle bg-surface">
            <img src={p.image_url} alt={p.caption ?? "Work sample"} loading="lazy" className="aspect-square w-full object-cover" />
            {p.caption && <figcaption className="px-2 py-1.5 text-body-sm text-on-surface-variant">{p.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  );
}

export function PortfolioManager({ shopId }: { shopId: string }) {
  const qc = useQueryClient();
  const { data = [] } = usePortfolio(shopId);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState("");
  const bucket = supabase.storage.from("shop-images");

  async function upload(files: FileList) {
    const list = Array.from(files).slice(0, MAX_PHOTOS - data.length);
    if (!list.length) return toast.error(`You can show up to ${MAX_PHOTOS} photos.`);
    setBusy(true);
    try {
      for (const file of list) {
        if (file.size > MAX_BYTES) { toast.error(`${file.name} is over 5 MB.`); continue; }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${shopId}/portfolio/${crypto.randomUUID()}.${ext}`;
        const { error } = await bucket.upload(path, file, { contentType: file.type });
        if (error) throw error;
        const { data: s, error: e2 } = await bucket.createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
        if (e2 || !s) throw e2 ?? new Error("Could not get image link");
        const { error: e3 } = await supabase.from("shop_portfolio").insert({
          shop_id: shopId, storage_path: path, image_url: s.signedUrl, caption: caption.trim() || null,
        });
        if (e3) throw e3;
      }
      setCaption("");
      toast.success("Photos added to your shop page.");
    } catch (err) {
      toast.error((err as Error).message || "Upload failed");
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["portfolio", shopId] });
    }
  }

  async function remove(p: Photo) {
    const { error } = await supabase.from("shop_portfolio").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    await bucket.remove([p.storage_path]);
    qc.invalidateQueries({ queryKey: ["portfolio", shopId] });
  }

  return (
    <div className="mt-8 border-t border-border-subtle pt-6">
      <h3 className="font-label-md text-label-md font-semibold text-on-surface mb-1">Portfolio</h3>
      <p className="text-on-surface-variant text-body-sm mb-3">
        Show off your work. These photos appear in an “Our work” gallery on your public shop page.
      </p>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={caption}
          maxLength={200}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Optional caption, e.g. Balayage refresh"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-md border border-border-subtle bg-surface text-body-sm"
        />
        <label className="cursor-pointer px-4 py-2 rounded-md bg-primary text-on-primary text-label-sm font-bold">
          {busy ? "Uploading…" : "Add photos"}
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy}
            onChange={(e) => { const f = e.target.files; if (f) upload(f); e.target.value = ""; }} />
        </label>
      </div>
      {data.length === 0 ? (
        <p className="text-on-surface-variant text-body-sm">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.map((p) => (
            <div key={p.id} className="relative group rounded overflow-hidden border border-border-subtle">
              <img src={p.image_url} alt={p.caption ?? "Portfolio photo"} className="aspect-square w-full object-cover" />
              <button type="button" onClick={() => remove(p)} aria-label="Remove photo"
                className="absolute top-1 right-1 rounded bg-surface/90 px-2 py-0.5 text-label-sm text-error">
                Remove
              </button>
              {p.caption && <p className="px-2 py-1 text-body-sm text-on-surface-variant truncate">{p.caption}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
