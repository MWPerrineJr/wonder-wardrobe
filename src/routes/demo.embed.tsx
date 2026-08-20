import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { DemoTour } from "@/components/demo-tour";
import { listPublicShops } from "@/lib/shops.functions";

const shopsQuery = queryOptions({
  queryKey: ["public", "shops"],
  queryFn: () => listPublicShops(),
});

export const Route = createFileRoute("/demo/embed")({
  loader: ({ context }) => context.queryClient.ensureQueryData(shopsQuery),
  head: () => ({
    meta: [
      { title: "The Standing Chair — embedded demo" },
      {
        name: "description",
        content:
          "Embeddable guided tour of The Standing Chair: bookings, prepayments, client surveys and analytics.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "The Standing Chair — embedded demo" },
      {
        property: "og:description",
        content: "Guided tour of bookings, prepayments, client surveys and analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-6 text-on-surface-variant">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-on-surface">Not found.</div>,
  component: DemoEmbedPage,
});

function DemoEmbedPage() {
  const { data: shops } = useSuspenseQuery(shopsQuery);
  return (
    <div className="bg-background text-on-background font-body-md p-6">
      <DemoTour sampleSlug={shops[0]?.slug ?? null} compact />
    </div>
  );
}
