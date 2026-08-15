import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";

export function PublicLinkCard({ slug, shopName }: { slug: string; shopName: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}/shop/${slug}`);
  }, [slug]);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 220,
      margin: 1,
      color: { dark: "#1C1917", light: "#FFFFFF" },
    }).catch(() => toast.error("Couldn't render the QR code"));
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy — select the link and copy manually");
    }
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${slug}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <section className="bg-surface border border-border-subtle rounded-xl p-6 flex flex-col md:flex-row gap-6 shadow-sm">
      <div className="flex flex-col gap-3 flex-grow">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <span className="material-symbols-outlined text-primary">link</span>
          <span className="font-label-md text-label-md">Your public link</span>
        </div>
        <p className="text-on-surface-variant text-body-md">
          Share this page with clients — it shows {shopName}'s services and lets them book online.
        </p>
        <code className="bg-surface-container border border-border-subtle rounded-lg px-3 py-2 text-on-surface text-body-md break-all">
          {url || `/shop/${slug}`}
        </code>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={copy}
            className="bg-primary text-on-primary rounded-lg px-4 py-2 font-label-md font-bold hover:opacity-90 transition-opacity"
          >
            Copy link
          </button>
          <a
            href={url || `/shop/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="bg-surface border border-border-subtle text-on-surface rounded-lg px-4 py-2 hover:border-primary transition-colors font-label-md"
          >
            Open page
          </a>
          <button
            type="button"
            onClick={download}
            className="bg-surface border border-border-subtle text-on-surface rounded-lg px-4 py-2 hover:border-primary transition-colors font-label-md"
          >
            Download QR (PNG)
          </button>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 shrink-0">
        <div className="bg-white p-3 rounded-lg border border-border-subtle">
          <canvas ref={canvasRef} className="block" />
        </div>
        <span className="text-label-sm text-on-surface-variant">Scan to book</span>
      </div>
    </section>
  );
}
