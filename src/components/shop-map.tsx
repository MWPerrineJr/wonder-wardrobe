import { useMemo } from "react";

type Props = {
  address: string | null | undefined;
  className?: string;
};

/**
 * Embeds a Google Map centered on the given address using the Maps Embed API.
 *
 * Reads the API key from `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`.
 * When no key is present (e.g. during local building), a placeholder card is
 * rendered so the UI stays intact — add your key at publish time.
 */
export function ShopMap({ address, className = "" }: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const src = useMemo(() => {
    if (!apiKey || !address) return null;
    const q = encodeURIComponent(address);
    return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${q}`;
  }, [apiKey, address]);

  if (!address) return null;

  if (!src) {
    return (
      <div
        className={`rounded-xl border border-border-subtle bg-surface-container p-6 text-on-surface-variant text-body-md flex flex-col gap-2 ${className}`}
      >
        <span className="font-label-md text-label-md text-on-surface">Map preview</span>
        <span>
          Add a Google Maps API key as{" "}
          <code className="text-primary">VITE_GOOGLE_MAPS_API_KEY</code> in{" "}
          <code className="text-primary">.env</code> to display an interactive map for{" "}
          <span className="text-on-surface">{address}</span>.
        </span>
        <span className="text-body-sm text-on-surface-variant">
          Save the file, then restart the dev server so the change is picked up.
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl overflow-hidden border border-border-subtle ${className}`}>
      <iframe
        title={`Map of ${address}`}
        src={src}
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