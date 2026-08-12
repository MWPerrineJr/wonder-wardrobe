import { createFileRoute, Link } from "@tanstack/react-router";

import { BarberSchedule } from "@/components/barber-schedule";

export const Route = createFileRoute("/barber")({
  head: () => ({
    meta: [
      { title: "My Schedule — The Sharp Edge Barber Terminal" },
      { name: "description", content: "Personal calendar view for barbers — manage appointments and Google Calendar sync." },
      { property: "og:title", content: "My Schedule — Barber Terminal" },
      { property: "og:description", content: "Personal calendar with appointments, breaks and Google Calendar sync." },
    ],
  }),
  component: BarberPage,
});

const Icon = ({ name, className = "", filled = false, style }: { name: string; className?: string; filled?: boolean; style?: React.CSSProperties }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ ...(filled ? { fontVariationSettings: "'FILL' 1" } : {}), ...style }}
  >
    {name}
  </span>
);

const SideLink = ({ icon, label, active = false, filled = false }: { icon: string; label: string; active?: boolean; filled?: boolean }) => (
  <a
    href="#"
    className={
      active
        ? "flex items-center gap-3 px-4 py-3 rounded-lg text-on-primary-fixed bg-primary-container font-bold font-label-md text-label-md"
        : "flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors font-label-md text-label-md group"
    }
  >
    <Icon name={icon} className="text-[20px]" filled={filled} />
    {label}
  </a>
);

function BarberPage() {
  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex">
      {/* Side nav */}
      <nav className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface border-r border-border-subtle p-4 gap-baseline z-50">
        <div className="mb-8 flex items-center gap-4">
          <img
            className="w-10 h-10 rounded-full object-cover border border-border-subtle"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBlnMVdrsWXoratmz9Gxt6KnfXi0FZJCjMgDwTDgKr6NXEPTIaGlz3_-nbmTlhenHAbo6cTKPzFSV1iJqn-q_C_To_RV2eQ2ysyyU4_UT7JStafC7UjHvFBvcjm_QkZl4ja-f6erRRyZkU16Pz-aHa2aLXZ471Z4kWsYPTlC858QXczSdUiBIXuh3GitSngVLx5uzs-SYGutTVB_Dy7ONETFqWlTUW1AECwUs19niZwhCGqVKQLhkCZ"
            alt="Logo"
          />
          <div>
            <h1 className="font-headline-md text-headline-md text-primary tracking-tight">The Sharp Edge</h1>
            <p className="font-label-sm text-label-sm text-text-muted">Barber Terminal</p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <SideLink icon="dashboard" label="Dashboard" />
          <SideLink icon="calendar_today" label="Schedule" active filled />
          <SideLink icon="groups" label="Clients" />
          <SideLink icon="content_cut" label="Services" />
          <SideLink icon="bar_chart" label="Analytics" />
        </div>
        <Link
          to="/"
          className="w-full py-3 mb-4 rounded border border-border-subtle text-on-surface hover:bg-surface-container transition-colors font-label-md text-label-md flex justify-center items-center gap-2"
        >
          View Shop Page <Icon name="open_in_new" className="text-[16px]" />
        </Link>
        <div className="flex flex-col gap-2 mt-auto border-t border-border-subtle pt-4">
          <a href="#" className="flex items-center gap-3 px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors font-label-sm text-label-sm">
            <Icon name="settings" className="text-[18px]" /> Settings
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors font-label-sm text-label-sm">
            <Icon name="help_outline" className="text-[18px]" /> Support
          </a>
        </div>
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

        <BarberSchedule />
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
          <Link to="/barber" className="flex flex-col items-center justify-center text-primary font-bold p-2 rounded">
            <Icon name="calendar_today" filled />
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
