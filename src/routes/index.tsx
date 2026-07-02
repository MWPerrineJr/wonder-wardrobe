import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AccountNav } from "@/components/account-nav";
import { listPublicShops } from "@/lib/shops.functions";

const shopsQuery = queryOptions({
  queryKey: ["public", "shops"],
  queryFn: () => listPublicShops(),
});

export const Route = createFileRoute("/")({
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

const CATEGORIES = [
  {
    title: "Modern",
    subtitle: "Fades & Textures",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCBQ_oo-9XZF7b4hy_fMXTatFfMq5bP45UHmBWLOkgdUaOhkyC-oybJfGB2NOrfAUh936eyvN6kne76GW3xm9yMKJ-YLVwClw3GK35nzZs2kmS01338RefCXUlzE0tIGZ7iBRGSOKFcRBcVXd1FCvic9fPMCahko7oD55rfU33JqibpSf-HYeXE3Lkj_lSHHEMyFYdU5SLXijMMN7wOgENOG02ghiI9Qk9ujLi9bRKZZuhkhZ7OpasT",
  },
  {
    title: "Classic",
    subtitle: "Traditional Cuts",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuC3wxEk68Iu4BXiO3ixsL0qXahqZfQ6Knjw-nppPdnNQTwfZI6v7xvyb1-ETeq3Vzdq3i7S6OKOw5cYjkqujuwgL5ZCRHtG1lmxCP4JudYwc3T1Jhy-VTnkVzZE9yT4oHOlHxIK0rR7jEv9QwNKTg7g8V-CrI9DKbmaeur9muJGV4M7kc-qAO4yb8JkarjKv2nwgY-WRPBA0nWGVb2305TNKY5n3Rw7Uyz4GZ17EJMeh5uvEldfpvNT",
  },
  {
    title: "Beard Specialist",
    subtitle: "Trims & Hot Towels",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBFYwKYZ5F9KZ4gYLGZCMx0HgVg4VuqkKHsiYwoSxokWLL7Izl41hG5luyukEmFiXcZJ_NnNqIpJAiw9A-N3HiB9hHWysHWk6chLbVc7qXFWMzKX4b81L5H-MMJW6uVDLd69hYEH-ZwrDYJno2yU-n5-7sm4hJAcGqC1t1WjUhRuiwTB-3Kxo_gdfqXfQ6ChLMKVfpuP8YcYBelhnHW__EBytLWkxSvXyrndy_kN0A1Xjlncf-aPTHz",
  },
];

const FALLBACK_SHOP_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCGuKuKoUkaNsFqKp3Zjp0Sj0XtbFYL1y3qe1fynBBGO0jzvYr0Wt4LdowxOrSnGETsNuTDc1Dvf9NsWpGU11DEU1bUa6lIypidQCuVCGQ6ZDGj4BlRHgza9bTBML87SeW8jpnRmYyCSP4d7XBhjFYyQItmAdWJc7NoLFPMXA4TP0jCTVmqWPehX198QFQzZSrqS_MNWs4R6lP9KS7Tl54pcN_yEF10uqu4HiiVuUNzESaQoysPGFzc";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _UNUSED_SHOPS = [
  {
    name: "Apex Grooming",
    area: "Westside",
    price: "$$",
    rating: "4.8",
    tags: ["Classic", "Beard"],
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDnI4vCQdhMt1Nm_2VW42IcYNud83dAazJP8k040PRWAa_nKmJe0D0ikORWhyu-cHpg9TmFPjlH-BURHm-ZB9qS8WMDxE8ZnC4itKsiT71HWWQdHiotSLwiNfaEOE17H3zkKHznzuq07jG8ZChcuf18NGoJOgH3VUhOb2d81KfSG35474XgMsV7oTcVSSIx6JemoH0apiS6AOs24Lyfupr7H2I7DVEH66-onDiVrk5_kAqnU4jyMVTf",
  },
];

function MarketplacePage() {
  return (
    <div className="bg-background min-h-screen flex flex-col text-on-background">
      {/* Top nav — desktop */}
      <header className="hidden md:flex w-full sticky top-0 z-50 bg-background border-b border-border-subtle">
        <div className="flex justify-between items-center px-margin-desktop h-16 max-w-container-max mx-auto w-full">
          <div className="font-headline-md text-headline-md font-bold text-primary tracking-tight">
            Crown &amp; Cut
          </div>
          <nav className="flex items-center gap-8">
            <Link to="/" className="text-primary font-bold border-b-2 border-primary pb-1 font-label-md text-label-md">
              Marketplace
            </Link>
            <Link to="/shop" className="text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md px-2 py-1 rounded">
              Services
            </Link>
            <Link to="/barber" className="text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md px-2 py-1 rounded">
              Barber
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
        {/* Hero */}
        <section className="relative w-full py-20 px-margin-mobile md:px-margin-desktop flex flex-col items-center justify-center min-h-[614px] border-b border-border-subtle overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div
              className="bg-cover bg-center w-full h-full opacity-30"
              style={{ backgroundImage: `url('${HERO_BG}')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
          </div>
          <div className="relative z-10 max-w-3xl mx-auto text-center flex flex-col items-center gap-8">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface">
              Find your next cut
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
              Discover premium barbers, view their portfolios, and book your next appointment seamlessly.
            </p>
            <div className="w-full max-w-2xl bg-surface border border-border-subtle rounded-xl p-2 flex flex-col md:flex-row gap-2 focus-within:border-primary transition-colors shadow-sm">
              <div className="flex-grow flex items-center bg-surface-container px-4 py-3 rounded-lg border border-border-subtle focus-within:border-primary">
                <Icon name="search" className="text-text-muted mr-3" />
                <input
                  className="bg-transparent border-none outline-none text-on-surface w-full font-body-md text-body-md placeholder:text-text-muted"
                  placeholder="Shop name or style..."
                  type="text"
                />
              </div>
              <div className="flex-grow flex items-center bg-surface-container px-4 py-3 rounded-lg border border-border-subtle focus-within:border-primary">
                <Icon name="location_on" className="text-text-muted mr-3" />
                <input
                  className="bg-transparent border-none outline-none text-on-surface w-full font-body-md text-body-md placeholder:text-text-muted"
                  placeholder="Location..."
                  type="text"
                />
              </div>
              <button className="bg-primary text-on-primary px-8 py-3 rounded-lg font-label-md text-label-md font-bold hover:opacity-90 transition-opacity whitespace-nowrap">
                Search
              </button>
            </div>
          </div>
        </section>

        <div className="max-w-container-max mx-auto w-full px-margin-mobile md:px-margin-desktop py-16 flex flex-col gap-24">
          {/* Categories */}
          <section className="flex flex-col gap-8">
            <div className="flex justify-between items-end">
              <h2 className="font-headline-md text-headline-md text-on-surface">Categories</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {CATEGORIES.map((c) => (
                <div
                  key={c.title}
                  className="group relative h-48 rounded-xl overflow-hidden border border-border-subtle hover:border-primary transition-colors cursor-pointer bg-surface"
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity"
                    style={{ backgroundImage: `url('${c.img}')` }}
                  />
                  <div className="absolute inset-0 p-6 flex flex-col justify-end bg-gradient-to-t from-background/90 via-background/60 to-transparent">
                    <span className="font-headline-md text-headline-md text-on-surface">{c.title}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">{c.subtitle}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Featured shops */}
          <section className="flex flex-col gap-8">
            <div className="flex justify-between items-end">
              <h2 className="font-headline-md text-headline-md text-on-surface">Featured Shops</h2>
              <a className="font-label-md text-label-md text-primary hover:underline" href="#">
                View All
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SHOPS.map((s) => (
                <Link
                  key={s.name}
                  to="/shop"
                  className="bg-surface border border-border-subtle rounded-xl p-4 flex flex-col gap-4 hover:border-primary transition-colors cursor-pointer group shadow-sm"
                >
                  <div className="relative w-full h-48 rounded-lg overflow-hidden bg-surface-container">
                    <img
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      src={s.img}
                      alt={s.name}
                    />
                    <div className="absolute top-2 right-2 bg-surface/90 backdrop-blur-sm px-2 py-1 rounded border border-border-subtle flex items-center gap-1">
                      <Icon name="star" className="text-primary text-[14px]" />
                      <span className="font-label-sm text-label-sm text-on-surface">{s.rating}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <h3 className="font-headline-md text-[20px] text-on-surface">{s.name}</h3>
                      <span className="font-body-md text-body-md text-on-surface-variant flex items-center gap-1">
                        <Icon name="location_on" className="text-[16px]" /> {s.area}
                      </span>
                    </div>
                    <span className="font-label-md text-label-md text-on-surface bg-surface-container px-2 py-1 rounded border border-border-subtle">
                      {s.price}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {s.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-1 rounded-full border border-border-subtle text-label-sm font-label-sm text-on-surface-variant"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-background border-t border-border-subtle w-full py-10 mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center px-margin-desktop max-w-container-max mx-auto gap-gutter">
          <div className="font-headline-md text-headline-md text-on-surface">Crown &amp; Cut</div>
          <nav className="flex flex-wrap justify-center gap-6">
            <a className="text-text-muted hover:text-primary transition-colors font-label-sm text-label-sm" href="#">
              Privacy Policy
            </a>
            <a className="text-text-muted hover:text-primary transition-colors font-label-sm text-label-sm" href="#">
              Terms of Service
            </a>
            <a className="text-text-muted hover:text-primary transition-colors font-label-sm text-label-sm" href="#">
              For Barbers
            </a>
            <a className="text-text-muted hover:text-primary transition-colors font-label-sm text-label-sm" href="#">
              Contact
            </a>
          </nav>
          <div className="font-body-md text-body-md text-text-muted">
            © 2024 Crown &amp; Cut SaaS. All rights reserved.
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
          <Link to="/barber" className="flex flex-col items-center justify-center text-on-surface-variant p-2 rounded">
            <Icon name="calendar_today" />
            <span className="font-label-sm text-label-sm mt-1">Barber</span>
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
