import { Link } from "@tanstack/react-router";

import pandaMark from "@/assets/pandagentic-mark.png.asset.json";

export function SiteBrand() {
  return (
    <div className="flex flex-col">
      <Link
        to="/"
        className="font-headline-md text-headline-md font-bold text-primary tracking-tight leading-tight"
      >
        The Standing Chair
      </Link>
      <a
        href="https://pandagentic.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="font-label-sm text-label-sm text-text-muted hover:text-primary transition-colors inline-flex items-center gap-1"
      >
        <img
          src={pandaMark.url}
          alt="Pandagentic"
          loading="lazy"
          width={16}
          height={16}
          className="h-4 w-4 shrink-0"
        />
        built by pandagentic.ai
      </a>
    </div>
  );
}
