import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { ProviderSchedule } from "@/components/provider-schedule";
import { useAuth } from "@/hooks/use-auth";
import { getMyProviderProfile } from "@/lib/provider.functions";

export const Route = createFileRoute("/provider")({
  head: () => ({
    meta: [
      { title: "My Schedule — The Standing Chair" },
      { name: "description", content: "Personal calendar view for providers — manage appointments and Google Calendar sync." },
      { property: "og:title", content: "My Schedule — The Standing Chair" },
      { property: "og:description", content: "Personal calendar with appointments, breaks and Google Calendar sync." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProviderPage,
});

const Icon = ({ name, className = "", filled = false, style }: { name: string; className?: string; filled?: boolean; style?: React.CSSProperties }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ ...(filled ? { fontVariationSettings: "'FILL' 1" } : {}), ...style }}
  >
    {name}
  </span>
);

const sideClass = (active: boolean) =>
  active
    ? "flex items-center gap-3 px-4 py-3 rounded-lg text-on-primary-fixed bg-primary-container font-bold font-label-md text-label-md"
    : "flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors font-label-md text-label-md";

function ProviderPage() {
  const { user } = useAuth();
  const profileQuery = useQuery({
    queryKey: ["my-provider-profile"],
    enabled: !!user,
    queryFn: () => getMyProviderProfile(),
  });
  const profile = profileQuery.data ?? null;
  const initial = (profile?.displayName ?? user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex">
      {/* Side nav */}
      <nav className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface border-r border-border-subtle p-4 gap-baseline z-50">
        <div className="mb-8 flex items-center gap-4">
          {profile?.avatarUrl ? (
            <img
              className="w-10 h-10 rounded-full object-cover border border-border-subtle"
              src={profile.avatarUrl}
              alt={profile.displayName}
            />
          ) : (
            <span className="w-10 h-10 rounded-full border border-border-subtle bg-surface-container flex items-center justify-center text-primary font-bold">
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="font-headline-md text-headline-md text-primary tracking-tight truncate">
              {profile?.shopName ?? "Provider Terminal"}
            </h1>
            <p className="font-label-sm text-label-sm text-text-muted truncate">
              {profile?.displayName ?? "My schedule"}
            </p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <Link to="/provider" className={sideClass(true)}>
            <Icon name="calendar_today" className="text-[20px]" filled />
            Schedule
          </Link>
          <Link to="/account" className={sideClass(false)}>
            <Icon name="person" className="text-[20px]" />
            My account
          </Link>
          <Link to="/" className={sideClass(false)}>
            <Icon name="search" className="text-[20px]" />
            Explore shops
          </Link>
          <Link to="/owner" className={sideClass(false)}>
            <Icon name="dashboard" className="text-[20px]" />
            Owner dashboard
          </Link>
        </div>
        {profile?.shopSlug && (
          <Link
            to="/shop/$slug"
            params={{ slug: profile.shopSlug }}
            className="w-full py-3 mb-4 mt-auto rounded border border-border-subtle text-on-surface hover:bg-surface-container transition-colors font-label-md text-label-md flex justify-center items-center gap-2"
          >
            View shop page <Icon name="open_in_new" className="text-[16px]" />
          </Link>
        )}
      </nav>

      <main className="flex-1 md:ml-64 p-margin-mobile md:p-margin-desktop max-w-container-max mx-auto w-full min-h-screen pb-24 md:pb-margin-desktop">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">My Schedule</h2>
            <p className="font-body-md text-body-md text-text-muted">Manage your appointments and update their status</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Link
              to="/"
              className="flex-1 md:flex-none bg-primary text-on-primary px-6 py-3 rounded hover:bg-primary-fixed-dim transition-colors font-label-md text-label-md flex items-center justify-center gap-2 font-semibold"
            >
              <Icon name="storefront" className="text-[20px]" /> Browse shops
            </Link>
          </div>
        </header>

        <ProviderSchedule />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 bg-surface border-t border-border-subtle shadow-lg">
        <div className="flex justify-around items-center h-16 px-margin-mobile">
          <Link to="/" className="flex flex-col items-center justify-center text-on-surface-variant p-2 rounded">
            <Icon name="search" />
            <span className="font-label-sm text-label-sm mt-1">Explore</span>
          </Link>
          <Link to="/shop" className="flex flex-col items-center justify-center text-on-surface-variant p-2 rounded">
            <Icon name="event_note" />
            <span className="font-label-sm text-label-sm mt-1">Bookings</span>
          </Link>
          <Link to="/provider" className="flex flex-col items-center justify-center text-primary font-bold p-2 rounded">
            <Icon name="calendar_today" filled />
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
