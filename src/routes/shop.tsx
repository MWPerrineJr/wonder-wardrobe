import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

import { getPublicShopBySlug } from "@/lib/shops.functions";

const shopSearchSchema = z.object({
  slug: fallback(z.string(), "").default(""),
});

const shopBySlugQuery = (slug: string) =>
  queryOptions({
    queryKey: ["public", "shop", slug],
    queryFn: () => getPublicShopBySlug({ data: { slug } }),
    enabled: !!slug,
  });

export const Route = createFileRoute("/shop")({
  validateSearch: zodValidator(shopSearchSchema),
  loaderDeps: ({ search: { slug } }) => ({ slug }),
  loader: ({ deps, context }) => {
    if (deps.slug) context.queryClient.ensureQueryData(shopBySlugQuery(deps.slug));
  },
  head: () => ({
    meta: [
      { title: "Book an appointment — Crown & Cut" },
      { name: "description", content: "Pick your barber, service, date and time." },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-on-surface bg-background min-h-screen">
      Couldn't load shop: {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Shop not found.</div>,
  component: ShopPage,
});

const FALLBACK_HERO =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuC15Egl3FSRAl6spm53f0jNFHFvfm6gzWI869VRI42pcJfcsd-p1Jd8XgAOYNUXzxtQZvWezIvhwgWIGg9eimf3wql8CXkOgvnb20M_Ry8bUJyECeE6i7sLI27L4O6-AM8bQsnotKz6BzDLQEYzmXKL_iHeqoJxneXmxqwRprP4EEqrG_uh_MmEIBI7b_gYk-yUtKYxb3zpEDnRlqp9CQcK3NQBf9jrpFXFWzFVyMicYzyXbO5Q4JiK";

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

const Icon = ({ name, className = "", filled = false }: { name: string; className?: string; filled?: boolean }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
  >
    {name}
  </span>
);

function ShopPage() {
  const { slug } = Route.useSearch();
  if (!slug) {
    return (
      <div className="bg-background text-on-background min-h-screen flex flex-col items-center justify-center p-8 gap-4">
        <h1 className="font-headline-md text-headline-md text-on-surface">No shop selected</h1>
        <p className="text-on-surface-variant">Pick a shop from the marketplace to book.</p>
        <Link to="/" className="bg-primary text-on-primary px-6 py-2 rounded font-bold">
          Browse shops
        </Link>
      </div>
    );
  }
  return <ShopContent slug={slug} />;
}

function ShopContent({ slug }: { slug: string }) {
  const { data } = useSuspenseQuery(shopBySlugQuery(slug));
  if (!data) {
    return (
      <div className="bg-background text-on-background min-h-screen flex flex-col items-center justify-center p-8 gap-4">
        <h1 className="font-headline-md text-headline-md text-on-surface">Shop not found</h1>
        <Link to="/" className="bg-primary text-on-primary px-6 py-2 rounded font-bold">
          Back to marketplace
        </Link>
      </div>
    );
  }

  const { shop, services } = data;

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md">
      {/* Top nav */}
      <nav className="hidden md:flex justify-between items-center px-margin-desktop h-16 max-w-container-max mx-auto w-full sticky top-0 z-50 bg-background border-b border-border-subtle">
        <div className="font-headline-md text-headline-md font-bold text-primary tracking-tight">
          Crown &amp; Cut
        </div>
        <div className="flex items-center gap-gutter">
          <Link to="/" className="text-on-surface-variant hover:text-primary transition-colors px-3 py-2 rounded-lg font-label-md text-label-md">
            Marketplace
          </Link>
          <Link to="/shop" className="text-primary font-bold border-b-2 border-primary pb-1 px-3 py-2 font-label-md text-label-md">
            Services
          </Link>
          <Link to="/barber" className="text-on-surface-variant hover:text-primary transition-colors px-3 py-2 rounded-lg font-label-md text-label-md">
            Barber
          </Link>
          <Link to="/owner" className="text-on-surface-variant hover:text-primary transition-colors px-3 py-2 rounded-lg font-label-md text-label-md">
            Owner
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-on-surface-variant hover:text-primary"><Icon name="notifications" /></button>
          <button className="text-on-surface-variant hover:text-primary"><Icon name="account_circle" /></button>
          <button className="bg-primary text-on-primary font-label-md text-label-md px-4 py-2 rounded font-bold">Book Now</button>
        </div>
      </nav>

      <main className="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-8 md:py-12 flex flex-col gap-12 pb-32 md:pb-12">
        {/* Hero */}
        <section className="relative rounded-xl overflow-hidden border border-border-subtle h-[300px] md:h-[400px]">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-60"
            style={{
              backgroundImage: `url('${shop.cover_image_url ?? FALLBACK_HERO}')`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/60 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6 md:p-10 flex flex-col md:flex-row items-end gap-6 w-full">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-primary overflow-hidden shrink-0 bg-surface flex items-center justify-center text-primary font-headline-lg">
              {shop.name.charAt(0)}
            </div>
            <div className="flex-grow">
              <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
                {shop.name}
              </h1>
              {shop.address && (
                <p className="font-body-lg text-body-lg text-on-surface-variant flex items-center gap-2">
                  <Icon name="location_on" className="text-[18px]" />
                  {shop.address}
                </p>
              )}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Left column */}
          <div className="lg:col-span-8 flex flex-col gap-10">
            {/* Step 1 Barber */}
            <section className="glass-panel rounded-xl p-6 md:p-8">
              <h2 className="font-headline-md text-headline-md text-on-surface mb-6 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-container text-on-primary-container font-label-md text-label-md">1</span>
                Select Barber
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <button className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border-subtle hover:border-primary bg-surface-container transition-all group">
                  <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors">
                    <Icon name="group" className="text-[32px]" />
                  </div>
                  <span className="font-label-md text-label-md text-on-surface">No Preference</span>
                </button>
                <button className="flex flex-col items-center gap-3 p-4 rounded-lg border border-primary bg-surface transition-all relative">
                  <div className="absolute top-2 right-2 text-primary">
                    <Icon name="check_circle" className="text-[20px]" filled />
                  </div>
                  <img
                    className="w-16 h-16 rounded-full object-cover border border-border-subtle"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBBfoFjMva9zWROLFbYfrJtP45n4LOaO707DjYTKkIMbzPKiPGo9H39799FTrmS_znxJ2tsSKvUB3EVCzRS5nz-uNNdrgsVUOan4BE2Xjl-UcLpxn3aiYv8sdSJRJszW9rZjep0xl2ddjxFlppOhLvHjjLvm08nWy3smANIn8s2i_rtfMgYZgS7fcBuAfJQVUTr2dzyr2oOh4Fjwj-cgru22z3cy97FCO6_RGZi93TLizH_8yK1Jw8Y"
                    alt="Marcus T."
                  />
                  <span className="font-label-md text-label-md text-on-surface">Marcus T.</span>
                  <div className="flex gap-1 flex-wrap justify-center">
                    <span className="text-[10px] uppercase font-semibold tracking-wider border border-border-subtle rounded px-2 py-0.5 text-on-surface-variant bg-surface-container">Fades</span>
                    <span className="text-[10px] uppercase font-semibold tracking-wider border border-border-subtle rounded px-2 py-0.5 text-on-surface-variant bg-surface-container">Beards</span>
                  </div>
                </button>
                <button className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border-subtle hover:border-primary bg-surface-container transition-all">
                  <img
                    className="w-16 h-16 rounded-full object-cover border border-border-subtle"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuChmFqpygZd8-G-38rX7qPMExVfXr-JlqAaSafaIwl0qcblRAeRtTNQA9AtyXCED1PZ32RnsyEFPAYa_rz4k3wRt8P-hciTxtHs30PRn0bWX2uTSdy0_36nHMKo4d8GGxX5zRRzJB0i4YeLE4yw5jouuoShnJf5ah207LRVl-2KcZIk_BhTgKstCa7LhE_tfIfOzxXBIYY_e7NuDg2ULf7OExbnO7hAdTatgBuI6EGhtvAD2xarqEcG"
                    alt="Sarah J."
                  />
                  <span className="font-label-md text-label-md text-on-surface">Sarah J.</span>
                  <div className="flex gap-1 flex-wrap justify-center">
                    <span className="text-[10px] uppercase font-semibold tracking-wider border border-border-subtle rounded px-2 py-0.5 text-on-surface-variant bg-surface-container">Scissors</span>
                    <span className="text-[10px] uppercase font-semibold tracking-wider border border-border-subtle rounded px-2 py-0.5 text-on-surface-variant bg-surface-container">Color</span>
                  </div>
                </button>
              </div>
            </section>

            {/* Step 2 Services */}
            <section className="glass-panel rounded-xl p-6 md:p-8">
              <h2 className="font-headline-md text-headline-md text-on-surface mb-6 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant font-label-md text-label-md border border-border-subtle">2</span>
                Choose Services
              </h2>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between p-4 rounded-lg bg-surface-container border border-primary relative overflow-hidden group cursor-pointer">
                  <div className="flex flex-col gap-1">
                    <span className="font-label-md text-label-md text-on-surface">Signature Haircut</span>
                    <span className="font-body-md text-body-md text-on-surface-variant text-sm">45 mins • Classic cut, wash, and style</span>
                  </div>
                  <div className="font-headline-md text-headline-md text-primary">$45</div>
                  <div className="absolute inset-y-0 right-0 w-1 bg-primary" />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-surface-container border border-border-subtle hover:border-primary/50 group cursor-pointer transition-all">
                  <div className="flex flex-col gap-1">
                    <span className="font-label-md text-label-md text-on-surface">Precision Beard Trim</span>
                    <span className="font-body-md text-body-md text-on-surface-variant text-sm">30 mins • Shaping, straight razor line-up, hot towel</span>
                  </div>
                  <div className="font-headline-md text-headline-md text-on-surface group-hover:text-primary transition-colors">$30</div>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-surface-container border border-border-subtle hover:border-primary/50 group cursor-pointer transition-all">
                  <div className="flex flex-col gap-1">
                    <span className="font-label-md text-label-md text-on-surface">The Executive Package</span>
                    <span className="font-body-md text-body-md text-on-surface-variant text-sm">75 mins • Haircut, beard trim, facial massage</span>
                  </div>
                  <div className="font-headline-md text-headline-md text-on-surface group-hover:text-primary transition-colors">$70</div>
                </div>
              </div>
            </section>

            {/* Step 3 Date & Time */}
            <section className="glass-panel rounded-xl p-6 md:p-8">
              <h2 className="font-headline-md text-headline-md text-on-surface mb-6 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant font-label-md text-label-md border border-border-subtle">3</span>
                Date &amp; Time
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="border border-border-subtle p-4 rounded-lg bg-surface-container">
                  <div className="flex justify-between items-center mb-4">
                    <button className="text-on-surface-variant hover:text-primary"><Icon name="chevron_left" /></button>
                    <span className="font-label-md text-label-md text-on-surface">October 2024</span>
                    <button className="text-on-surface-variant hover:text-primary"><Icon name="chevron_right" /></button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center font-label-sm text-label-sm text-on-surface-variant mb-2">
                    {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d}>{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center font-body-md text-body-md text-on-surface">
                    <div className="p-2 opacity-20">29</div>
                    <div className="p-2 opacity-20">30</div>
                    {[1,2].map(d => (
                      <div key={d} className="p-2 border border-border-subtle rounded cursor-pointer hover:border-primary">{d}</div>
                    ))}
                    <div className="p-2 border border-primary rounded text-primary font-bold">3</div>
                    {[4,5,6,7].map(d => (
                      <div key={d} className="p-2 border border-border-subtle rounded cursor-pointer hover:border-primary">{d}</div>
                    ))}
                    {Array.from({length: 24}, (_,i) => i+8).map(d => (
                      <div key={d} className="p-2 border border-border-subtle rounded cursor-pointer hover:border-primary">{d}</div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <h3 className="font-label-md text-label-md text-on-surface-variant mb-2 border-b border-border-subtle pb-2">
                    Available Slots on Oct 3
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button className="p-2 border border-border-subtle rounded font-body-md text-body-md hover:border-primary bg-surface-container transition-colors text-on-surface">09:00 AM</button>
                    <button className="p-2 border border-border-subtle rounded font-body-md text-body-md hover:border-primary bg-surface-container transition-colors text-on-surface">09:45 AM</button>
                    <button className="p-2 border border-primary rounded font-body-md text-body-md text-primary font-bold bg-surface">10:30 AM</button>
                    <button className="p-2 border border-border-subtle rounded font-body-md text-body-md opacity-20 cursor-not-allowed">11:15 AM</button>
                    <button className="p-2 border border-border-subtle rounded font-body-md text-body-md hover:border-primary bg-surface-container transition-colors text-on-surface">01:00 PM</button>
                    <button className="p-2 border border-border-subtle rounded font-body-md text-body-md hover:border-primary bg-surface-container transition-colors text-on-surface">01:45 PM</button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right column: summary */}
          <div className="lg:col-span-4">
            <div className="glass-panel rounded-xl p-6 md:p-8 lg:sticky lg:top-24 flex flex-col gap-6">
              <h2 className="font-headline-md text-headline-md text-on-surface border-b border-border-subtle pb-4">Booking Summary</h2>
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface">Signature Haircut</span>
                    <span className="font-body-md text-body-md text-on-surface-variant text-sm">Marcus T.</span>
                  </div>
                  <span className="font-label-md text-label-md text-primary">$45</span>
                </div>
                <div className="flex items-center gap-2 text-on-surface-variant font-body-md text-body-md text-sm border-t border-border-subtle pt-4">
                  <Icon name="calendar_today" className="text-[16px]" />
                  Oct 3, 2024 at 10:30 AM (45m)
                </div>
              </div>
              <div className="border-t border-border-subtle pt-4 mt-2">
                <div className="flex justify-between items-center mb-6">
                  <span className="font-label-md text-label-md text-on-surface">Total</span>
                  <span className="font-headline-md text-headline-md text-primary">$45</span>
                </div>
                <div className="flex flex-col gap-4 mb-6">
                  <div>
                    <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Full Name</label>
                    <input className="w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:ring-0 font-body-md text-body-md placeholder:text-text-muted" placeholder="John Doe" type="text" />
                  </div>
                  <div>
                    <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Phone Number</label>
                    <input className="w-full bg-surface-container border border-border-subtle rounded p-3 text-on-surface focus:border-primary focus:ring-0 font-body-md text-body-md placeholder:text-text-muted" placeholder="(555) 000-0000" type="tel" />
                  </div>
                </div>
                <button className="w-full bg-primary text-on-primary font-headline-md text-headline-md py-4 rounded-lg font-bold hover:bg-primary/90 transition-all">
                  Confirm Booking
                </button>
                <p className="font-label-sm text-label-sm text-center text-on-surface-variant mt-4">
                  By booking, you agree to our cancellation policy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 bg-surface border-t border-border-subtle flex justify-around items-center h-16 px-margin-mobile shadow-lg">
        <Link to="/" className="flex flex-col items-center justify-center text-on-surface-variant w-1/4 h-full">
          <Icon name="search" />
          <span className="font-label-sm text-label-sm mt-1">Explore</span>
        </Link>
        <Link to="/shop" className="flex flex-col items-center justify-center text-primary font-bold w-1/4 h-full">
          <Icon name="event_note" filled />
          <span className="font-label-sm text-label-sm mt-1">Bookings</span>
        </Link>
        <Link to="/barber" className="flex flex-col items-center justify-center text-on-surface-variant w-1/4 h-full">
          <Icon name="calendar_today" />
          <span className="font-label-sm text-label-sm mt-1">Barber</span>
        </Link>
        <Link to="/owner" className="flex flex-col items-center justify-center text-on-surface-variant w-1/4 h-full">
          <Icon name="dashboard" />
          <span className="font-label-sm text-label-sm mt-1">Owner</span>
        </Link>
      </nav>
    </div>
  );
}
