import { Link } from "@tanstack/react-router";

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
          src="/panda-silhouette-on-matrix.png"
          alt="Pandagentic matrix panda"
          loading="lazy"
          width={20}
          height={20}
          className="h-5 w-5 shrink-0 rounded-sm object-cover object-center"
        />
        built by pandagentic.ai
      </a>
    </div>
  );
}
