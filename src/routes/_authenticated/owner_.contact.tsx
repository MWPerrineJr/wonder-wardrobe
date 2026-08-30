import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { AccountNav } from "@/components/account-nav";
import { OWNER_CONTACT_EMAIL, OWNER_CONTACT_MAILTO } from "@/lib/support";
import { getMyShops } from "@/lib/shops.functions";

const myShopsQuery = queryOptions({
  queryKey: ["owner", "shops"],
  queryFn: () => getMyShops(),
});

export const Route = createFileRoute("/_authenticated/owner_/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Shop Owner Dashboard — The Standing Chair" },
      {
        name: "description",
        content:
          "Get in touch with The Standing Chair team for shop owner support, partnerships, and platform questions.",
      },
      { property: "og:title", content: "Contact — Shop Owner Dashboard — The Standing Chair" },
      {
        property: "og:description",
        content:
          "Reach the team behind The Standing Chair for owner support and partnership questions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(myShopsQuery),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-8 text-on-surface bg-background">
      <div>
        <h1 className="font-headline-md text-headline-md mb-2">Something went wrong</h1>
        <p className="text-on-surface-variant">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-on-surface">Not found.</div>,
  component: ContactPage,
});

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

function ContactPage() {
  const { data: shops } = useSuspenseQuery(myShopsQuery);
  const [selectedId, setSelectedId] = useState<string | null>(shops[0]?.id ?? null);

  const selected = shops.find((s) => s.id === selectedId) ?? shops[0];

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen">
      <header className="border-b border-border-subtle bg-surface">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-headline-md text-headline-md text-primary tracking-tight">
              The Standing Chair
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-label-md">
              <Link to="/owner" className="text-on-surface-variant hover:text-on-surface">
                Dashboard
              </Link>
              <Link to="/owner/analytics" className="text-on-surface-variant hover:text-on-surface">
                Analytics
              </Link>
              <Link to="/owner/feedback" className="text-on-surface-variant hover:text-on-surface">
                Feedback
              </Link>
              <Link to="/owner/subscribe" className="text-on-surface-variant hover:text-on-surface">
                Plans
              </Link>
              <Link to="/owner/contact" className="text-primary font-semibold">
                Contact
              </Link>
            </nav>
          </div>
          <AccountNav />
        </div>
      </header>

      <main className="max-w-container-max mx-auto p-margin-mobile md:p-margin-desktop">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              Contact
            </h1>
            {selected ? (
              <p className="text-on-surface-variant text-body-md mt-1">
                Owner questions for {selected.name} go straight to our team.
              </p>
            ) : (
              <p className="text-on-surface-variant text-body-md mt-1">
                Owner and partnership questions go straight to our team.
              </p>
            )}
          </div>

          <div className="bg-surface border border-border-subtle rounded-2xl p-8 md:p-10 flex flex-col gap-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="mail" className="text-[28px] text-primary" />
              </div>
              <div>
                <h2 className="font-headline-md text-[20px] text-on-surface">
                  Questions about owning a shop?
                </h2>
                <p className="text-on-surface-variant text-body-md">
                  Reach out directly for billing, partnerships, or platform support.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-surface-container rounded-xl border border-border-subtle">
              <div className="flex flex-col gap-1 flex-grow">
                <span className="text-label-sm text-on-surface-variant">Business contact</span>
                <a
                  href={OWNER_CONTACT_MAILTO}
                  className="text-on-surface font-semibold hover:text-primary transition-colors"
                >
                  {OWNER_CONTACT_EMAIL}
                </a>
              </div>
              <a
                href={OWNER_CONTACT_MAILTO}
                className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary font-label-md text-label-md px-5 py-2.5 rounded-lg font-bold hover:bg-primary/90 transition-all"
              >
                <Icon name="send" className="text-[18px]" />
                Email now
              </a>
            </div>

            <p className="text-on-surface-variant text-body-md">
              Replies are sent to the same address. We typically respond within one business day.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
