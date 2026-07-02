import { createFileRoute, Link } from "@tanstack/react-router";

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
  const dotDays = new Set([11, 12, 13, 16, 17, 18, 20, 23, 24, 25]);
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
            <p className="font-body-md text-body-md text-text-muted">Manage your appointments for Thursday, Oct 26</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-surface px-4 py-2 rounded-full border border-border-subtle text-label-sm text-text-muted">
              <Icon name="check_circle" className="text-[16px] text-[#34A853]" filled />
              Google Calendar Synced
            </div>
            <button className="flex-1 md:flex-none bg-primary text-on-primary px-6 py-3 rounded hover:bg-primary-fixed-dim transition-colors font-label-md text-label-md flex items-center justify-center gap-2 font-semibold">
              <Icon name="add" className="text-[20px]" /> Add Appointment
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Left column */}
          <div className="lg:col-span-4 flex flex-col gap-gutter">
            {/* Today's Pulse */}
            <div className="bg-surface rounded-xl p-6 border border-border-subtle relative overflow-hidden group hover:border-primary/50 transition-colors">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline-md text-headline-md text-on-surface">Today's Pulse</h3>
                <button className="text-text-muted hover:text-primary transition-colors">
                  <Icon name="more_horiz" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-container p-4 rounded-lg border border-border-subtle">
                  <p className="font-label-sm text-label-sm text-text-muted mb-1">Appointments</p>
                  <p className="font-headline-md text-headline-md text-primary">8</p>
                </div>
                <div className="bg-surface-container p-4 rounded-lg border border-border-subtle">
                  <p className="font-label-sm text-label-sm text-text-muted mb-1">Expected Revenue</p>
                  <p className="font-headline-md text-headline-md text-on-surface">$320</p>
                </div>
                <div className="col-span-2 bg-surface-container p-4 rounded-lg border border-border-subtle flex items-center justify-between">
                  <div>
                    <p className="font-label-sm text-label-sm text-text-muted mb-1">Completion Rate</p>
                    <div className="flex items-center gap-2">
                      <p className="font-headline-md text-headline-md text-on-surface">37%</p>
                      <span className="text-[12px] text-electric-blue bg-electric-blue/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Icon name="trending_up" className="text-[12px]" /> 3/8 Done
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full border-4 border-surface-container-high border-t-primary border-r-primary" />
                </div>
              </div>
            </div>
            {/* Mini Calendar */}
            <div className="bg-surface rounded-xl p-6 border border-border-subtle">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-label-md text-label-md text-on-surface font-semibold">October 2024</h4>
                <div className="flex gap-2">
                  <button className="p-1 hover:bg-surface-container rounded text-text-muted hover:text-primary transition-colors">
                    <Icon name="chevron_left" className="text-[20px]" />
                  </button>
                  <button className="p-1 hover:bg-surface-container rounded text-text-muted hover:text-primary transition-colors">
                    <Icon name="chevron_right" className="text-[20px]" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {["S","M","T","W","T","F","S"].map((d, i) => (
                  <span key={i} className="font-label-sm text-[10px] text-text-muted">{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center font-label-sm">
                <button className="p-2 text-text-muted/30 rounded-full">29</button>
                <button className="p-2 text-text-muted/30 rounded-full">30</button>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                  const active = d === 26;
                  const dot = dotDays.has(d);
                  return (
                    <button
                      key={d}
                      className={
                        active
                          ? "p-2 bg-primary text-on-primary rounded-full font-bold relative shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                          : "p-2 text-on-surface hover:bg-surface-container rounded-full transition-colors relative"
                      }
                    >
                      {d}
                      {dot && !active && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-text-muted rounded-full" />
                      )}
                    </button>
                  );
                })}
                <button className="p-2 text-text-muted/30 rounded-full">1</button>
                <button className="p-2 text-text-muted/30 rounded-full">2</button>
              </div>
            </div>
          </div>

          {/* Right column: schedule */}
          <div className="lg:col-span-8 bg-surface rounded-xl border border-border-subtle flex flex-col h-[800px] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-container">
              <div className="flex items-center gap-4">
                <h3 className="font-headline-md text-headline-md text-on-surface">Thursday, Oct 26</h3>
                <div className="hidden sm:flex gap-1 bg-surface p-1 rounded border border-border-subtle">
                  <button className="px-3 py-1 bg-surface-container-high text-on-surface rounded font-label-sm text-label-sm shadow-sm border border-border-subtle">Day</button>
                  <button className="px-3 py-1 text-text-muted hover:text-primary rounded font-label-sm text-label-sm">Week</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded border border-border-subtle hover:bg-surface-container text-text-muted hover:text-primary">
                  <Icon name="filter_list" className="text-[20px]" />
                </button>
                <button className="p-2 rounded border border-border-subtle hover:bg-surface-container text-text-muted hover:text-primary">
                  <Icon name="print" className="text-[20px]" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto relative calendar-grid bg-surface-container">
              <div className="flex">
                {/* Time axis */}
                <div className="w-16 flex-shrink-0 border-r border-border-subtle bg-surface flex flex-col text-right pr-2 py-2 text-text-muted font-label-sm text-label-sm sticky left-0 z-20">
                  {["9 AM","10 AM","11 AM","12 PM","1 PM","2 PM","3 PM","4 PM","5 PM","6 PM","7 PM"].map(t => (
                    <div key={t} className="time-slot flex justify-end -mt-3"><span>{t}</span></div>
                  ))}
                </div>
                {/* Appointments */}
                <div className="flex-1 relative min-w-[500px]">
                  <div className="absolute w-full h-[1px] bg-error z-10 pointer-events-none" style={{ top: 150 }}>
                    <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-error" />
                  </div>

                  <div className="absolute left-2 right-4 rounded-lg p-3 border border-border-subtle bg-surface-container opacity-70 flex flex-col justify-between" style={{ top: 10, height: 50 }}>
                    <div className="flex justify-between items-start">
                      <p className="font-label-md text-label-md text-on-surface line-through">Skin Fade &amp; Beard Trim</p>
                      <Icon name="check_circle" className="text-[16px] text-text-muted" />
                    </div>
                    <p className="font-label-sm text-label-sm text-text-muted">Mike T. • 9:10 - 10:00 AM</p>
                  </div>

                  <div className="absolute left-2 right-4 rounded-lg p-3 border border-border-subtle bg-surface-container opacity-70 flex flex-col justify-between" style={{ top: 70, height: 40 }}>
                    <div className="flex justify-between items-center h-full">
                      <p className="font-label-md text-label-md text-on-surface line-through">Classic Haircut</p>
                      <p className="font-label-sm text-label-sm text-text-muted">James W.</p>
                    </div>
                  </div>

                  <div className="absolute left-2 right-4 rounded-lg p-3 border border-primary bg-primary/10 shadow-[0_0_15px_rgba(212,175,55,0.1)] flex flex-col justify-between z-10 cursor-pointer hover:bg-primary/20 transition-colors" style={{ top: 130, height: 80 }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-label-md text-label-md text-primary font-bold mb-1">Executive Grooming Package</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-label-sm text-label-sm text-on-surface px-2 py-0.5 border border-border-subtle rounded-full bg-surface-container">In Progress</span>
                          <p className="font-label-sm text-label-sm text-text-muted">David S. • 11:10 - 12:30 PM</p>
                        </div>
                      </div>
                      <img
                        className="w-6 h-6 rounded-full object-cover border border-border-subtle shrink-0"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDABtw0eVadUrwkMNU7YGwQl0j3EMIprt4W5WJHpSyQxSMxnH7KNggGpquWvFua4xKjGt2s6_3vEKzdlX-75MkeUlSg0Nbe_hLXy85hT_4xA30mOT04jtsNx6jiaIOWzEDrZB_tZkvI14YPXDzGPoyMnkmYhMqWW_kUyICjmhehyGkHQmKc251P8wAU_rWV4W4eZ_BtWyJJIzIicpViIzcRy8nXy_4tOLtGkUUDAieN4ISvxGFWcoik"
                        alt="Client"
                      />
                    </div>
                  </div>

                  <div className="absolute left-2 right-4 rounded-lg border border-border-subtle border-dashed bg-surface-container opacity-50 flex items-center justify-center pointer-events-none" style={{ top: 220, height: 30 }}>
                    <p className="font-label-sm text-label-sm text-text-muted tracking-widest uppercase">Lunch Break</p>
                  </div>

                  <div className="absolute left-2 right-4 rounded-lg p-3 border border-border-subtle bg-surface-container-high text-on-surface flex flex-col justify-between cursor-pointer hover:border-text-muted transition-colors" style={{ top: 260, height: 60 }}>
                    <div className="flex justify-between items-start">
                      <p className="font-label-md text-label-md">Hot Towel Shave</p>
                      <p className="font-label-md text-label-md">$45</p>
                    </div>
                    <p className="font-label-sm text-label-sm text-text-muted">Alex R. • 1:20 - 2:20 PM</p>
                  </div>

                  <div className="absolute left-2 w-1/2 pr-1 rounded-lg p-3 border border-electric-blue/50 bg-electric-blue/10 flex flex-col justify-between cursor-pointer hover:bg-electric-blue/20 transition-colors" style={{ top: 330, height: 50 }}>
                    <div className="flex justify-between items-start">
                      <p className="font-label-md text-label-md text-on-surface truncate pr-2">Dentist Appt (Personal)</p>
                      <Icon name="sync" className="text-[16px] text-electric-blue" />
                    </div>
                    <p className="font-label-sm text-label-sm text-text-muted">Google Cal</p>
                  </div>

                  <div className="absolute right-4 rounded-lg p-3 border border-border-subtle bg-surface-container-high text-on-surface flex flex-col justify-between cursor-pointer hover:border-text-muted transition-colors" style={{ top: 360, height: 40, width: "calc(50% - 12px)" }}>
                    <div className="flex justify-between items-center h-full">
                      <p className="font-label-md text-label-md truncate">Line Up</p>
                      <p className="font-label-sm text-label-sm text-text-muted ml-2">Chris B.</p>
                    </div>
                  </div>

                  <div className="absolute left-2 right-4 rounded-lg p-3 border border-border-subtle bg-surface-container-high text-on-surface flex flex-col justify-between cursor-pointer hover:border-text-muted transition-colors" style={{ top: 490, height: 60 }}>
                    <div className="flex justify-between items-start">
                      <p className="font-label-md text-label-md">Kids Cut</p>
                      <p className="font-label-md text-label-md">$30</p>
                    </div>
                    <p className="font-label-sm text-label-sm text-text-muted">Leo M. • 5:10 - 6:10 PM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
