import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { getPublicShopBySlug } from "@/lib/shops.functions";
import { ShopMap } from "@/components/shop-map";
import { BookingPanel } from "@/components/booking-panel";
import { FeedbackForm } from "@/components/feedback-form";
import { getBookingContext } from "@/lib/booking.functions";

const shopBySlugQuery = (slug: string) =>
  queryOptions({
    queryKey: ["public", "shop", slug],
    queryFn: () => getPublicShopBySlug({ data: { slug } }),
  });

const bookingContextQuery = (slug: string) =>
  queryOptions({
    queryKey: ["public", "booking-context", slug],
    queryFn: () => getBookingContext({ data: { slug } }),
  });

export const Route = createFileRoute("/shop/$slug")({
  loader: async ({ params, context }) => {
    const [detail] = await Promise.all([
      context.queryClient.ensureQueryData(shopBySlugQuery(params.slug)),
      context.queryClient.ensureQueryData(bookingContextQuery(params.slug)),
    ]);
    if (!detail?.shop) throw notFound();
    return {
      name: detail.shop.name,
      description: detail.shop.description,
      cover: detail.shop.cover_image_url,
    };
  },
  head: ({ params, loaderData }) => {
    const url = `/shop/${params.slug}`;
    if (!loaderData) {
      return {
        meta: [
          { title: "Shop unavailable — The Standing Chair" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `${loaderData.name} — Book online | The Standing Chair`;
    const description =
      loaderData.description?.slice(0, 155) ??
      `Book your next appointment at ${loaderData.name}. Pick your provider, service, date and time.`;
    const image =
      loaderData.cover && loaderData.cover.startsWith("https://") ? loaderData.cover : null;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-on-surface bg-background min-h-screen">
      Couldn't load shop: {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="bg-background text-on-background min-h-screen flex flex-col items-center justify-center p-8 gap-4">
      <h1 className="font-headline-md text-headline-md text-on-surface">Shop not found</h1>
      <p className="text-on-surface-variant">This link may have changed or the shop is no longer listed.</p>
      <Link to="/shop" className="bg-primary text-on-primary px-6 py-2 rounded font-bold">
        Browse shops
      </Link>
    </div>
  ),
  component: ShopPage,
});

const FALLBACK_HERO =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuC15Egl3FSRAl6spm53f0jNFHFvfm6gzWI869VRI42pcJfcsd-p1Jd8XgAOYNUXzxtQZvWezIvhwgWIGg9eimf3wql8CXkOgvnb20M_Ry8bUJyECeE6i7sLI27L4O6-AM8bQsnotKz6BzDLQEYzmXKL_iHeqoJxneXmxqwRprP4EEqrG_uh_MmEIBI7b_gYk-yUtKYxb3zpEDnRlqp9CQcK3NQBf9jrpFXFWzFVyMicYzyXbO5Q4JiK";

const Icon = ({ name, className = "", filled = false }: { name: string; className?: string; filled?: boolean }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
  >
    {name}
  </span>
);

function ShopPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(shopBySlugQuery(slug));
  const { data: bookingCtx } = useSuspenseQuery(bookingContextQuery(slug));

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

  const { shop } = data;

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md">
      <nav className="hidden md:flex justify-between items-center px-margin-desktop h-16 max-w-container-max mx-auto w-full sticky top-0 z-50 bg-background border-b border-border-subtle">
        <div className="font-headline-md text-headline-md font-bold text-primary tracking-tight">
          The Standing Chair
        </div>
        <div className="flex items-center gap-gutter">
          <Link to="/" className="text-on-surface-variant hover:text-primary transition-colors px-3 py-2 rounded-lg font-label-md text-label-md">
            Marketplace
          </Link>
          <Link to="/shop" className="text-on-surface-variant hover:text-primary transition-colors px-3 py-2 rounded-lg font-label-md text-label-md">
            Shops
          </Link>
          <Link to="/provider" className="text-on-surface-variant hover:text-primary transition-colors px-3 py-2 rounded-lg font-label-md text-label-md">
            Provider
          </Link>
          <Link to="/owner" className="text-on-surface-variant hover:text-primary transition-colors px-3 py-2 rounded-lg font-label-md text-label-md">
            Owner
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-on-surface-variant hover:text-primary"><Icon name="notifications" /></button>
          <button className="text-on-surface-variant hover:text-primary"><Icon name="account_circle" /></button>
        </div>
      </nav>

      <main className="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-8 md:py-12 flex flex-col gap-12 pb-32 md:pb-12">
        <section className="relative rounded-xl overflow-hidden border border-border-subtle h-[300px] md:h-[400px]">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-60"
            style={{ backgroundImage: `url('${shop.cover_image_url ?? FALLBACK_HERO}')` }}
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

        {shop.address && (
          <section className="flex flex-col gap-3">
            <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
              <Icon name="map" />
              Find us
            </h2>
            <ShopMap address={shop.address} />
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <div className="lg:col-span-8 flex flex-col gap-10">
            {bookingCtx ? (
              <BookingPanel ctx={bookingCtx} slug={slug} />
            ) : (
              <div className="glass-panel rounded-xl p-6 text-on-surface-variant text-body-md">
                Booking is not available for this shop yet.
              </div>
            )}
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="glass-panel rounded-xl p-6 flex flex-col gap-3">
              <h2 className="font-headline-md text-headline-md text-on-surface">About</h2>
              <p className="text-on-surface-variant text-body-md">
                {shop.description ?? "This shop hasn't added a description yet."}
              </p>
              {shop.address && (
                <p className="text-on-surface-variant text-body-md flex items-center gap-2">
                  <Icon name="location_on" className="text-[18px]" />
                  {shop.address}
                </p>
              )}
            </div>
            <FeedbackForm shopId={shop.id} slug={slug} />
          </div>
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 w-full z-50 bg-surface border-t border-border-subtle flex justify-around items-center h-16 px-margin-mobile shadow-lg">
        <Link to="/" className="flex flex-col items-center justify-center text-on-surface-variant w-1/4 h-full">
          <Icon name="search" />
          <span className="font-label-sm text-label-sm mt-1">Explore</span>
        </Link>
        <Link to="/shop" className="flex flex-col items-center justify-center text-primary font-bold w-1/4 h-full">
          <Icon name="event_note" filled />
          <span className="font-label-sm text-label-sm mt-1">Shops</span>
        </Link>
        <Link to="/provider" className="flex flex-col items-center justify-center text-on-surface-variant w-1/4 h-full">
          <Icon name="calendar_today" />
          <span className="font-label-sm text-label-sm mt-1">Provider</span>
        </Link>
        <Link to="/owner" className="flex flex-col items-center justify-center text-on-surface-variant w-1/4 h-full">
          <Icon name="dashboard" />
          <span className="font-label-sm text-label-sm mt-1">Owner</span>
        </Link>
      </nav>
    </div>
  );
}
