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

  if (query.isError) {
    return (
      <div
        className={`rounded-xl border border-error bg-error-container p-6 text-on-error-container text-body-md flex flex-col gap-2 ${className}`}
      >
        <span className="font-label-md text-label-md text-on-error-container">
          Unable to load map
        </span>
        <span>Something went wrong while preparing the map. Please try again.</span>
      </div>
    );
  }

  const result = query.data;

  if (result && !result.ok) {
    return (
      <div
        className={`rounded-xl border border-error bg-error-container p-6 text-on-error-container text-body-md flex flex-col gap-2 ${className}`}
      >
        <span className="font-label-md text-label-md text-on-error-container">
          Google Maps API key is missing
        </span>
        <span>
          Set the <code className="font-semibold">GOOGLE_MAPS_API_KEY</code> secret in your
          backend to display the map.
        </span>
      </div>
    );
  }

  if (!result?.ok) return null;

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