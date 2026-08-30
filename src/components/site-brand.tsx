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
        className="font-label-sm text-label-sm text-text-muted hover:text-primary transition-colors"
      >
        built by pandagentic.ai
      </a>
    </div>
  );
}
