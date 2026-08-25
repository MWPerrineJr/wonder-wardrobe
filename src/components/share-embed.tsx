import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getPublicOrigin } from "@/lib/site-origin";

async function copy(text: string, message: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch {
    toast.error("Copy failed — select the text and copy manually.");
  }
}

const SHARE_TITLE = "The Standing Chair — bookings, surveys and analytics for your shop";

/** Copy link, social share buttons and a website embed snippet for the demo. */
export function ShareEmbed({
  path = "/demo",
  heading = "Share the demo",
  blurb = "Send the guided tour to clients and colleagues, or drop it straight into your own website.",
}: {
  path?: string;
  heading?: string;
  blurb?: string;
}) {
  const origin = getPublicOrigin();
  const url = `${origin}${path}`;
  const embedSrc = `${origin}${path === "/demo" ? "/demo/embed" : path}`;
  const snippet = `<iframe src="${embedSrc}" title="The Standing Chair demo" width="100%" height="720" style="border:0;border-radius:12px" loading="lazy"></iframe>`;

  const encoded = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(SHARE_TITLE);

  const shares = [
    { label: "X", href: `https://twitter.com/intent/tweet?url=${encoded}&text=${encodedTitle}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}` },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,
    },
    { label: "WhatsApp", href: `https://wa.me/?text=${encodedTitle}%20${encoded}` },
    { label: "Email", href: `mailto:?subject=${encodedTitle}&body=${encoded}` },
  ];

  return (
    <section className="bg-surface border border-border-subtle rounded-xl p-6 shadow-sm flex flex-col gap-5">
      <div>
        <h2 className="font-headline-md text-headline-md text-on-surface">{heading}</h2>
        <p className="text-body-md text-on-surface-variant mt-1">{blurb}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          readOnly
          value={url}
          aria-label="Demo link"
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 bg-background border border-border-subtle rounded-lg px-3 py-2 text-on-surface font-mono text-label-md"
        />
        <Button className="font-bold" onClick={() => void copy(url, "Demo link copied.")}>
          Copy link
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {shares.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-label-md border border-border-subtle rounded-full px-4 py-1.5 text-on-surface-variant hover:text-primary hover:border-primary transition-colors"
          >
            {s.label}
          </a>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-label-md text-on-surface uppercase tracking-wide">
          Embed on your website
        </p>
        <p className="text-label-sm text-on-surface-variant">
          Paste this snippet into any page or site builder to show the tour inline.
        </p>
        <textarea
          readOnly
          rows={3}
          value={snippet}
          aria-label="Embed code"
          onFocus={(e) => e.currentTarget.select()}
          className="bg-background border border-border-subtle rounded-lg px-3 py-2 text-on-surface-variant font-mono text-label-sm resize-none"
        />
        <div>
          <Button variant="outline" onClick={() => void copy(snippet, "Embed code copied.")}>
            Copy embed code
          </Button>
        </div>
      </div>
    </section>
  );
}
