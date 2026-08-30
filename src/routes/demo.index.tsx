import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AccountNav } from "@/components/account-nav";
import { DemoTour } from "@/components/demo-tour";
import { ShareEmbed } from "@/components/share-embed";
import { SiteBrand } from "@/components/site-brand";
import { listPublicShops } from "@/lib/shops.functions";

const shopsQuery = queryOptions({
  queryKey: ["public", "shops"],
  queryFn: () => listPublicShops(),
});

const DESCRIPTION =
  "See how The Standing Chair works: a bookable shop page, prepayments, automated post-visit surveys, AI feedback analysis and business analytics.";

export const Route = createFileRoute("/demo/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(shopsQuery),
  head: () => ({
    meta: [
      { title: "See the demo — The Standing Chair" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "See the demo — The Standing Chair" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background text-on-surface-variant">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-on-surface">Not found.</div>,
  component: DemoPage,
});

function DemoPage() {
  const { data: shops } = useSuspenseQuery(shopsQuery);

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen">
      <header className="border-b border-border-subtle bg-surface">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-4 flex items-center justify-between gap-4">
          <Link to="/" className="font-headline-md text-headline-md text-primary tracking-tight">
            The Standing Chair
          </Link>
          <AccountNav />
        </div>
      </header>

      <main className="max-w-container-max mx-auto p-margin-mobile md:p-margin-desktop flex flex-col gap-10">
        <DemoTour sampleSlug={shops[0]?.slug ?? null} />
        <ShareEmbed />
      </main>
    </div>
  );
}
