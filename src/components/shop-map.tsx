import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMapEmbedUrl } from "@/lib/maps.functions";

type Props = {
  address: string | null | undefined;
  className?: string;
};

/**
 * Embeds a Google Map centered on the given address using the Maps Embed API.
 * The API key is read server-side from the `GOOGLE_MAPS_API_KEY` secret; the
 * server returns a ready-to-use embed URL so the key never reaches the browser.
 */
export function ShopMap({ address, className = "" }: Props) {
  const fetchEmbedUrl = useServerFn(getMapEmbedUrl);
  const query = useQuery({
    queryKey: ["map-embed-url", address],
    queryFn: () => fetchEmbedUrl({ data: { address: address as string } }),
    enabled: !!address,
    staleTime: 5 * 60_000,
  });

  if (!address) return null;

  if (query.isLoading) {
    return (
      <div
        className={`rounded-xl border border-border-subtle bg-surface-container h-[320px] animate-pulse ${className}`}
        aria-label="Loading map"
      />
    );
  }

  const result = query.data;

  // Any failure (missing key, key restrictions, network) falls back to a clean
  // address card so a broken Google error frame is never shown to customers.
  if (query.isError || !result?.ok) {
    return <MapFallback address={address} className={className} />;
  }

  return (
    <div className={`rounded-xl overflow-hidden border border-border-subtle ${className}`}>
      <iframe
        title={`Map of ${address}`}
        src={result.url}
        width="100%"
        height="320"
        style={{ border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
}

function MapFallback({ address, className }: { address: string; className: string }) {
  return (
    <div
      className={`rounded-xl border border-border-subtle bg-surface-container p-6 flex flex-col gap-3 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-primary">location_on</span>
        <div className="flex flex-col">
          <span className="font-label-md text-label-md text-on-surface-variant">Location</span>
          <span className="text-body-md text-on-surface">{address}</span>
        </div>
      </div>
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
        target="_blank"
        rel="noreferrer"
        className="self-start bg-primary text-on-primary rounded-lg px-4 py-2 font-label-md text-label-md font-bold hover:opacity-90 transition-opacity"
      >
        View on Google Maps
      </a>
    </div>
  );
}