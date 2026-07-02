import { useMemo } from "react";

type Props = {
  address: string | null | undefined;
  className?: string;
};

type ValidationResult =
  | { ok: true; key: string }
  | { ok: false; reason: "missing" | "invalid" };

/**
 * Google API keys are typically 39 characters and contain only base64-url-safe
 * characters (A-Z, a-z, 0-9, '-', '_'). This is a lightweight client-side
 * format check; it does not make a network request to Google.
 */
function validateGoogleMapsApiKey(key: string | undefined): ValidationResult {
  if (!key || key.trim() === "") {
    return { ok: false, reason: "missing" };
  }
  const trimmed = key.trim();
  if (trimmed.length < 20 || !/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, key: trimmed };
}

/**
 * Embeds a Google Map centered on the given address using the Maps Embed API.
 *
 * Reads the API key from `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`.
 * When no key is present (e.g. during local building), a clear error card is
 * rendered so the problem is obvious — add your key in `.env` and restart the
 * dev server.
 */
export function ShopMap({ address, className = "" }: Props) {
  const rawKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const validation = useMemo(() => validateGoogleMapsApiKey(rawKey), [rawKey]);

  const src = useMemo(() => {
    if (!validation.ok || !address) return null;
    const q = encodeURIComponent(address);
    return `https://www.google.com/maps/embed/v1/place?key=${validation.key}&q=${q}`;
  }, [validation, address]);

  if (!address) return null;

  if (!validation.ok) {
    const isMissing = validation.reason === "missing";
    return (
      <div
        className={`rounded-xl border border-error bg-error-container p-6 text-on-error-container text-body-md flex flex-col gap-2 ${className}`}
      >
        <span className="font-label-md text-label-md text-on-error-container">
          {isMissing ? "Google Maps API key is missing" : "Google Maps API key looks invalid"}
        </span>
        <span>
          {isMissing
            ? "Set your key as "
            : "The key in "}
          <code className="font-semibold">VITE_GOOGLE_MAPS_API_KEY</code>
          {isMissing
            ? " in "
            : " does not look like a valid Google Maps API key. Update it in "}
          <code className="font-semibold">.env</code>
          {isMissing
            ? " to display the map."
            : " (Google API keys are usually 39 characters long)."}
        </span>
        <span className="text-body-sm opacity-90">
          Save the file, then restart the dev server so the change is picked up.
        </span>
      </div>
    );
  }

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