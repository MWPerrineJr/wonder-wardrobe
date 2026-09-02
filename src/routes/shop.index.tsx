import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

import { SiteBrand } from "@/components/site-brand";
import { listPublicShops } from "@/lib/shops.functions";

const searchSchema = z.object({
  slug: fallback(z.string().optional(), undefined).optional(),
});

const shopsQuery = queryOptions({
  queryKey: ["public", "shops"],
  queryFn: () => listPublicShops(),
});

export const Route = createFileRoute("/shop/")({
  validateSearch: zodValidator(searchSchema),
  beforeLoad: ({ search }) => {
    if (search.slug) {
      throw redirect({ to: "/shop/$slug", params: { slug: search.slug } });
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(shopsQuery),
  head: () => ({
    meta: [
      { title: "Browse businesses — The Standing Chair" },
      {
        name: "description",
        content:
          "Every shop on The Standing Chair. Open a shop's page to book your next appointment.",
      },
      { property: "og:title", content: "Browse businesses — The Standing Chair" },
      {
        property: "og:description",
        content:
          "Every shop on The Standing Chair. Open a shop's page to book your next appointment.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://thestandingchair.com/shop" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/shop" }],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 bg-background min-h-screen text-on-surface">
      Couldn't load shops: {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
  component: ShopIndex,
});

const FALLBACK_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuC15Egl3FSRAl6spm53f0jNFHFvfm6gzWI869VRI42pcJfcsd-p1Jd8XgAOYNUXzxtQZvWezIvhwgWIGg9eimf3wql8CXkOgvnb20M_Ry8bUJyECeE6i7sLI27L4O6-AM8bQsnotKz6BzDLQEYzmXKL_iHeqoJxneXmxqwRprP4EEqrG_uh_MmEIBI7b_gYk-yUtKYxb3zpEDnRlqp9CQcK3NQBf9jrpFXFWzFVyMicYzyXbO5Q4JiK";

function ShopIndex() {
  const { data: shops } = useSuspenseQuery(shopsQuery);

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <header className="border-b border-border-subtle">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop h-16 flex items-center justify-between">
          <SiteBrand />
          <Link
            to="/"
            className="text-on-surface-variant hover:text-primary font-label-md text-label-md"
          >
            Marketplace
          </Link>
        </div>
      </header>

      <main className="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-10 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Browse shops
          </h1>
          <p className="text-on-surface-variant text-body-md">
            Open a shop's own page to see services and book a time.
          </p>
        </div>

        {shops.length === 0 ? (
          <div className="bg-surface border border-border-subtle rounded-xl p-8 text-center flex flex-col gap-3">
            <p className="text-on-surface font-headline-md text-[20px]">No shops yet</p>
            <Link
              to="/onboarding/owner"
              className="mx-auto bg-primary text-on-primary px-6 py-2 rounded font-bold font-label-md"
            >
              Become a shop owner
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shops.map((s) => (
              <Link
                key={s.id}
                to="/shop/$slug"
                params={{ slug: s.slug }}
                className="bg-surface border border-border-subtle rounded-xl p-4 flex flex-col gap-4 hover:border-primary transition-colors group shadow-sm"
              >
                <div className="relative w-full h-44 rounded-lg overflow-hidden bg-surface-container">
                  <img
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    src={s.cover_image_url ?? FALLBACK_IMG}
                    alt={s.name}
                    loading="lazy"
                  />
                </div>
                <div className="flex flex-col">
                  <h2 className="font-headline-md text-[20px] text-on-surface">{s.name}</h2>
                  {s.address && (
                    <span className="font-body-md text-body-md text-on-surface-variant">
                      {s.address}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
