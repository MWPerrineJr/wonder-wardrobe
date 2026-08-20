import { useMemo, useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AccountNav } from "@/components/account-nav";
import { WelcomeGate } from "@/components/welcome-gate";
import { listPublicShops } from "@/lib/shops.functions";
import { CATEGORY_ICONS, CATEGORY_LABELS, SERVICE_CATEGORIES, type ServiceCategory } from "@/lib/categories";


const shopsQuery = queryOptions({
  queryKey: ["public", "shops"],
  queryFn: () => listPublicShops(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Standing Chair — Book beauty & wellness services" },
      {
        name: "description",
        content:
          "Browse salons, spas, and studios on The Standing Chair, compare services and prices, and book your next appointment in a few taps.",
      },
      { property: "og:title", content: "The Standing Chair — Book beauty & wellness services" },
      {
        property: "og:description",
        content:
          "Browse salons, spas, and studios, compare services and prices, and book your next appointment in a few taps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),

  loader: ({ context }) => context.queryClient.ensureQueryData(shopsQuery),
  errorComponent: ({ error }) => (
    <div className="p-8 text-on-surface bg-background min-h-screen">
      Couldn't load shops: {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
  component: MarketplacePage,
});

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const HERO_BG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA8cpAj_UG6ago_RiH5Y5HvlAh7URwYB-Lhg9to3EXFyzf9AH_8W1JthLNdq43ksvarR8otGhDrLGRnqVPLzRn2v1qGYEtNYNezkhbbsOws_29yUbWdAH5ot3zwrWR5meCqg74g8ORDITM0fvnQzwUaOKwSngFhPkbB-99a3vmFjtQy1l2hR0z1Z23LA2X5B776bWXhAdtLDUyM6kTsODsp5K7BLaVXeqzVO_onraeIhg5CD3mNx8BS";


const FALLBACK_SHOP_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCGuKuKoUkaNsFqKp3Zjp0Sj0XtbFYL1y3qe1fynBBGO0jzvYr0Wt4LdowxOrSnGETsNuTDc1Dvf9NsWpGU11DEU1bUa6lIypidQCuVCGQ6ZDGj4BlRHgza9bTBML87SeW8jpnRmYyCSP4d7XBhjFYyQItmAdWJc7NoLFPMXA4TP0jCTVmqWPehX198QFQzZSrqS_MNWs4R6lP9KS7Tl54pcN_yEF10uqu4HiiVuUNzESaQoysPGFzc";

function MarketplacePage() {
  const { data: shops } = useSuspenseQuery(shopsQuery);
  const [nameInput, setNameInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [query, setQuery] = useState({ name: "", location: "" });
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);


  const filteredShops = useMemo(() => {
    // Normalize: lowercase, strip accents/punctuation, collapse whitespace.
    // So "Mike's Cuts", "mikes cuts", and "Mikes-Cuts" all normalize the same.
    const norm = (v: string) =>
      v
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    // Levenshtein distance for short tokens.
    const editDistance = (a: string, b: string) => {
      if (a === b) return 0;
      const m = a.length;
      const n2 = b.length;
      if (!m) return n2;
      if (!n2) return m;
      const row = new Array<number>(n2 + 1);
      for (let j = 0; j <= n2; j++) row[j] = j;
      for (let i = 1; i <= m; i++) {
        let prevDiag = row[0];
        row[0] = i;
        for (let j = 1; j <= n2; j++) {
          const temp = row[j];
          const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
          row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prevDiag + cost);
          prevDiag = temp;
        }
      }
      return row[n2];
    };

    // Fuzzy: every query token must match some target token via substring
    // or small edit distance (threshold scales with token length).
    const fuzzyMatch = (queryText: string, target: string) => {
      if (!queryText) return true;
      if (!target) return false;
      if (target.includes(queryText)) return true;
      const qTokens = queryText.split(" ").filter(Boolean);
      const tTokens = target.split(" ").filter(Boolean);
      return qTokens.every((qt) =>
        tTokens.some((tt) => {
          if (tt.includes(qt) || qt.includes(tt)) return true;
          const threshold = qt.length <= 4 ? 1 : qt.length <= 7 ? 2 : 3;
          return editDistance(qt, tt) <= threshold;
        }),
      );
    };

    const n = norm(query.name);
    const l = norm(query.location);
    if (!n && !l && !selectedCategory) return shops;
    return shops.filter((s) => {
      const nameHit =
        !n ||
        fuzzyMatch(n, norm(s.name)) ||
        fuzzyMatch(n, norm(s.description ?? ""));
      const locHit = !l || fuzzyMatch(l, norm(s.address ?? ""));
      const categoryHit =
        !selectedCategory || (s.categories ?? []).includes(selectedCategory);
      return nameHit && locHit && categoryHit;
    });
  }, [shops, query, selectedCategory]);


  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    console.log("[search] submit", { name: nameInput, location: locationInput });
    setQuery({ name: nameInput, location: locationInput });
    if (typeof document !== "undefined") {
      document.getElementById("featured-shops")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="bg-background min-h-screen flex flex-col text-on-background">
      <WelcomeGate />
      {/* Top nav — desktop */}
      <header className="hidden md:flex w-full sticky top-0 z-50 bg-background border-b border-border-subtle">
        <div className="flex justify-between items-center px-margin-desktop h-16 max-w-container-max mx-auto w-full">
          <div className="font-headline-md text-headline-md font-bold text-primary tracking-tight">
            The Standing Chair
          </div>
          <nav className="flex items-center gap-8">
            <Link to="/" className="text-primary font-bold border-b-2 border-primary pb-1 font-label-md text-label-md">
              Marketplace
            </Link>
            <Link to="/shop" className="text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md px-2 py-1 rounded">
              Shops
            </Link>
            <Link to="/demo" className="text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md px-2 py-1 rounded">
              Demo
            </Link>
            <Link to="/provider" className="text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md px-2 py-1 rounded">
              Provider
            </Link>
            <Link to="/owner" className="text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md px-2 py-1 rounded">
              Owner
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <button className="hover:bg-surface-container p-2 rounded transition-all">
                <Icon name="notifications" />
              </button>
            </div>
            <AccountNav />
            <Link
              to="/shop"
              className="bg-primary text-on-primary font-label-md text-label-md px-6 py-2 rounded font-bold hover:opacity-90 transition-opacity"
            >
              Book Now
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col pb-20 md:pb-0">
        {/* Hero — split screen */}
        <section className="w-full border-b border-border-subtle">
          <div className="max-w-container-max mx-auto w-full px-margin-mobile md:px-margin-desktop py-16 md:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="flex flex-col items-start gap-6 max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 py-1 font-label-sm text-label-sm text-on-surface-variant">
                <Icon name="spa" className="text-[16px] text-primary" />
                Beauty & wellness booking, simplified
              </span>
              <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface">
                Find your next appointment
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                Discover top-rated studios, salons, and spas, view their services, and book your next appointment
                seamlessly.
              </p>

              <form
                onSubmit={handleSearch}
                className="w-full bg-surface border border-border-subtle rounded-2xl p-2 flex flex-col gap-2 focus-within:border-primary transition-colors"
              >
                <div className="flex-grow flex items-center bg-surface-container px-4 py-3 rounded-xl border border-border-subtle focus-within:border-primary">
                <Icon name="search" className="text-text-muted mr-3" />
                <input
                  className="bg-transparent border-none outline-none text-on-surface w-full font-body-md text-body-md placeholder:text-text-muted"
                  placeholder="Shop name or style..."
                  type="text"
                  autoComplete="off"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onFocus={() => console.log("[search] name focused")}
                  onClick={() => console.log("[search] name clicked")}
                />
                </div>
                <div className="flex-grow flex items-center bg-surface-container px-4 py-3 rounded-xl border border-border-subtle focus-within:border-primary">
                <Icon name="location_on" className="text-text-muted mr-3" />
                <input
                  className="bg-transparent border-none outline-none text-on-surface w-full font-body-md text-body-md placeholder:text-text-muted"
                  placeholder="Location..."
                  type="text"
                  autoComplete="off"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onFocus={() => {
                    console.log("[search] location focused");
                    if (!import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY) {
                      console.info(
                        "[search] Google Places autocomplete not enabled: no browser-safe Maps key is configured (GOOGLE_MAPS_API_KEY is server-only and used for the map embed). Add VITE_GOOGLE_MAPS_BROWSER_KEY with an HTTP-referrer-restricted key to enable Places suggestions.",
                      );
                    }
                  }}
                  onClick={() => console.log("[search] location clicked")}
                />
                </div>
                <button
                  type="submit"
                  className="bg-primary text-on-primary px-8 py-3 rounded-xl font-label-md text-label-md font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  Search
                </button>
              </form>
            </div>

            <div className="relative">
              <div className="relative aspect-4/5 sm:aspect-video lg:aspect-4/5 w-full overflow-hidden rounded-3xl border border-border-subtle bg-surface-container">
                <img
                  src={HERO_BG}
                  alt="Provider finishing a fresh service in a modern studio"

                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="hidden lg:flex absolute -bottom-6 -left-6 items-center gap-3 rounded-2xl border border-border-subtle bg-surface px-5 py-4">
                <Icon name="event_available" className="text-primary" />
                <div className="flex flex-col">
                  <span className="font-headline-md text-[18px] text-on-surface">
                    {shops.length} {shops.length === 1 ? "shop" : "shops"} listed
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    Book in under a minute
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-container-max mx-auto w-full px-margin-mobile md:px-margin-desktop py-16 flex flex-col gap-24">
          {/* Categories */}
          <section className="flex flex-col gap-6">
            <div className="flex justify-between items-end">
              <h2 className="font-headline-md text-headline-md text-on-surface">Categories</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {SERVICE_CATEGORIES.map((c) => {
                const active = selectedCategory === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setSelectedCategory(active ? null : c.value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border font-label-md text-label-md transition ${
                      active
                        ? "bg-primary text-on-primary border-primary"
                        : "bg-surface border-border-subtle text-on-surface hover:border-primary"
                    }`}
                  >
                    <Icon name={CATEGORY_ICONS[c.value]} className="text-[18px]" />
                    {CATEGORY_LABELS[c.value]}
                  </button>
                );
              })}
            </div>
          </section>


          {/* Featured shops */}
          <section id="featured-shops" className="flex flex-col gap-8 scroll-mt-24">
            <div className="flex justify-between items-end">
              <h2 className="font-headline-md text-headline-md text-on-surface">
                {query.name || query.location || selectedCategory ? "Search Results" : "Featured Shops"}
              </h2>
              {(query.name || query.location || selectedCategory) && (
                <button
                  type="button"
                  onClick={() => {
                    setNameInput("");
                    setLocationInput("");
                    setQuery({ name: "", location: "" });
                    setSelectedCategory(null);
                  }}
                  className="font-label-md text-label-md text-primary hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            {filteredShops.length === 0 ? (
              <div className="bg-surface border border-border-subtle rounded-xl p-8 text-center flex flex-col gap-3">
                <p className="text-on-surface font-headline-md text-[20px]">
                  {shops.length === 0 ? "No shops yet" : "No shops match your search"}
                </p>
                <p className="text-on-surface-variant text-body-md">
                  {shops.length === 0
                    ? "Be the first to list your shop on The Standing Chair."
                    : "Try a different name or location."}
                </p>
                {shops.length === 0 && (
                  <Link
                    to="/onboarding/owner"
                    className="mx-auto mt-2 bg-primary text-on-primary font-label-md text-label-md px-6 py-2 rounded font-bold hover:opacity-90 transition-opacity"
                  >
                    Become a shop owner
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredShops.map((s) => (
                  <Link
                    key={s.id}
                    to="/shop/$slug"
                    params={{ slug: s.slug }}
                    className="bg-surface border border-border-subtle rounded-xl p-4 flex flex-col gap-4 hover:border-primary transition-colors cursor-pointer group shadow-sm"
                  >
                    <div className="relative w-full h-48 rounded-lg overflow-hidden bg-surface-container">
                      <img
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        src={s.cover_image_url ?? FALLBACK_SHOP_IMG}
                        alt={s.name}
                      />
                    </div>
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <h3 className="font-headline-md text-[20px] text-on-surface">{s.name}</h3>
                        {s.address && (
                          <span className="font-body-md text-body-md text-on-surface-variant flex items-center gap-1">
                            <Icon name="location_on" className="text-[16px]" /> {s.address}
                          </span>
                        )}
                      </div>
                    </div>
                    {s.categories && s.categories.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {s.categories.map((cat) => (
                          <span
                            key={cat}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface-container border border-border-subtle text-label-sm text-on-surface-variant"
                          >
                            <Icon name={CATEGORY_ICONS[cat]} className="text-[14px]" />
                            {CATEGORY_LABELS[cat]}
                          </span>
                        ))}
                      </div>
                    )}
                    {s.description && (
                      <p className="text-on-surface-variant text-label-sm line-clamp-2">
                        {s.description}
                      </p>
                    )}

                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-background border-t border-border-subtle w-full py-10 mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center px-margin-desktop max-w-container-max mx-auto gap-gutter">
          <div className="font-headline-md text-headline-md text-on-surface">The Standing Chair</div>
          <nav className="flex flex-wrap justify-center gap-6">
            <a className="text-text-muted hover:text-primary transition-colors font-label-sm text-label-sm" href="#">
              Privacy Policy
            </a>
            <a className="text-text-muted hover:text-primary transition-colors font-label-sm text-label-sm" href="#">
              Terms of Service
            </a>
            <Link to="/demo" className="text-text-muted hover:text-primary transition-colors font-label-sm text-label-sm">
              See the demo
            </Link>

            <a className="text-text-muted hover:text-primary transition-colors font-label-sm text-label-sm" href="#">
              Contact
            </a>
          </nav>
          <div className="font-body-md text-body-md text-text-muted">
            © 2024 The Standing Chair SaaS. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 bg-surface border-t border-border-subtle shadow-lg">
        <div className="flex justify-around items-center h-16 px-margin-mobile">
          <Link to="/" className="flex flex-col items-center justify-center text-primary font-bold p-2 rounded">
            <Icon name="search" />
            <span className="font-label-sm text-label-sm mt-1">Explore</span>
          </Link>
          <Link to="/shop" className="flex flex-col items-center justify-center text-on-surface-variant p-2 rounded">
            <Icon name="event_note" />
            <span className="font-label-sm text-label-sm mt-1">Bookings</span>
          </Link>
          <Link to="/provider" className="flex flex-col items-center justify-center text-on-surface-variant p-2 rounded">
            <Icon name="calendar_today" />
            <span className="font-label-sm text-label-sm mt-1">Provider</span>
          </Link>
          <Link to="/owner" className="flex flex-col items-center justify-center text-on-surface-variant p-2 rounded">
            <Icon name="dashboard" />
            <span className="font-label-sm text-label-sm mt-1">Owner</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
