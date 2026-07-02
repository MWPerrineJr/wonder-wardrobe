import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/owner")({
  head: () => ({
    meta: [
      { title: "Shop Owner Dashboard — The Sharp Edge" },
      { name: "description", content: "Today's shop performance at a glance — revenue, bookings, staff." },
      { property: "og:title", content: "Shop Owner Dashboard — The Sharp Edge" },
      { property: "og:description", content: "Revenue, bookings, and staff performance in one view." },
    ],
  }),
  component: OwnerPage,
});

const Icon = ({ name, className = "", filled = false }: { name: string; className?: string; filled?: boolean }) => (
  <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>
    {name}
  </span>
);

function OwnerPage() {
  return (
    <div className="bg-surface-deep text-white font-body-md min-h-screen flex">
      {/* Side nav */}
      <nav className="hidden md:flex h-screen w-64 fixed left-0 top-0 border-r border-border-subtle bg-[#0b0b0b] z-50 flex-col p-4 gap-baseline">
        <div className="mb-8 px-2 flex flex-col gap-2">
          <div className="w-12 h-12 rounded-full overflow-hidden mb-2 ring-1 ring-border-subtle">
            <img
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBwMuFwOJWcjnkpHayxydHXbMp75e6sFcOv2qOmDzmZBP6f1hqeZ21LeIli8WHe5h2eQaVCYd7HzAtc7XoqLV_SqSgimh-2Cf82w-DM52xJHHfpLr4Htu9wrUDrtiheV8hn585gOfZ2TgWCC_7dI7Iip4a07HLz_Ga7GtCpzfJUAeQqQElmJk5kB7u69czj7lKg6KCKbtrwJxxeNxBPwQs4G3q5LeWWGEftJ_k0ZE8RG1GZQUQp_LTT"
              alt="Shop logo"
            />
          </div>
          <h1 className="font-headline-md text-headline-md text-primary tracking-tight">The Sharp Edge</h1>
          <p className="font-label-md text-label-md text-text-muted">Admin Terminal</p>
        </div>
        <div className="flex flex-col gap-2 flex-grow">
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-on-primary-fixed bg-primary-container rounded-lg font-bold">
            <Icon name="dashboard" filled /> <span className="font-label-md text-label-md">Dashboard</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-elevated rounded-lg transition-colors">
            <Icon name="calendar_today" /> <span className="font-label-md text-label-md">Schedule</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-elevated rounded-lg transition-colors">
            <Icon name="groups" /> <span className="font-label-md text-label-md">Clients</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-elevated rounded-lg transition-colors">
            <Icon name="content_cut" /> <span className="font-label-md text-label-md">Services</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-elevated rounded-lg transition-colors">
            <Icon name="bar_chart" /> <span className="font-label-md text-label-md">Analytics</span>
          </a>
        </div>
        <div className="mt-auto flex flex-col gap-2 border-t border-border-subtle pt-4">
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-elevated rounded-lg transition-colors">
            <Icon name="settings" /> <span className="font-label-sm text-label-sm">Settings</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-elevated rounded-lg transition-colors">
            <Icon name="help_outline" /> <span className="font-label-sm text-label-sm">Support</span>
          </a>
          <Link to="/" className="mt-4 w-full py-2 px-4 bg-transparent border border-border-subtle text-white font-label-md text-label-md rounded-lg hover:bg-surface-elevated transition-colors text-center">
            View Shop Page
          </Link>
        </div>
      </nav>

      <main className="flex-1 md:ml-64 p-margin-mobile md:p-margin-desktop w-full max-w-container-max mx-auto min-h-screen flex flex-col gap-8 pb-24 md:pb-margin-desktop">
        <header className="flex justify-between items-center w-full mb-4">
          <div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-white">Overview</h2>
            <p className="font-body-md text-body-md text-text-muted mt-1">Today's shop performance at a glance.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-surface-elevated px-4 py-2 rounded-full border border-border-subtle">
              <span className="font-label-sm text-label-sm text-white">Accepting Walk-ins</span>
              <button className="w-10 h-5 bg-primary-container rounded-full relative">
                <span className="absolute right-1 top-1 w-3 h-3 bg-on-primary-fixed rounded-full" />
              </button>
            </div>
          </div>
        </header>

        {/* Stats */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {[
            { icon: "payments", label: "Total Revenue", value: "$4,250.00", delta: "+12.5%", deltaClass: "text-electric-blue", deltaIcon: "trending_up" },
            { icon: "calendar_month", label: "Weekly Bookings", value: "128", delta: "0%", deltaClass: "text-text-muted", deltaIcon: "trending_flat" },
            { icon: "person_add", label: "New Clients", value: "24", delta: "+8.2%", deltaClass: "text-electric-blue", deltaIcon: "trending_up" },
          ].map((s) => (
            <div key={s.label} className="bg-surface-elevated border border-border-subtle rounded-xl p-6 flex flex-col justify-between hover:border-primary transition-colors group">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-[#0b0b0b] rounded-lg border border-border-subtle group-hover:border-primary transition-colors">
                  <Icon name={s.icon} className="text-primary" />
                </div>
                <span className={`font-label-sm text-label-sm ${s.deltaClass} flex items-center gap-1`}>
                  <Icon name={s.deltaIcon} className="text-[14px]" /> {s.delta}
                </span>
              </div>
              <div>
                <p className="font-label-md text-label-md text-text-muted mb-1">{s.label}</p>
                <h3 className="font-headline-md text-headline-md text-white">{s.value}</h3>
                <p className="font-label-sm text-label-sm text-text-muted mt-2">Past 7 days</p>
              </div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-gutter flex-1">
          {/* Upcoming */}
          <div className="lg:col-span-1 flex flex-col gap-4 bg-surface-elevated border border-border-subtle rounded-xl p-6">
            <div className="flex justify-between items-center mb-2 border-b border-border-subtle pb-4">
              <h3 className="font-headline-md text-[20px] font-semibold text-white">Upcoming Appointments</h3>
              <button className="font-label-sm text-label-sm text-primary hover:underline">View All</button>
            </div>
            <div className="flex flex-col gap-4 overflow-y-auto pr-2" style={{ maxHeight: 400 }}>
              <AppointmentRow initials="JD" name="John Doe" service="Classic Fade • Marcus" time="10:00 AM" hint="In 15 mins" highlight />
              <AppointmentRow imgSrc="https://lh3.googleusercontent.com/aida-public/AB6AXuCoI565qlreKHBi45eVmRm-cwQoztm48AKjW8Q1KJO7BEBU_-6W9djit3XO3S3oO4qcxIcGmkNMPwkeINheVWP_jXpwjuV8AAaRkrpkjs-91rsGop5lwRPfD6XXpm-YbOzEAAYAw7dNEJ280fcfoc4E0v8L9BQEZlqOsmBs9sODMI16r9oEJAi9YPhshv3AKkVflTR85-2gGOrgrAIYP8IrdRIlVhLJUs1GHO2QiskzpKlbw0GW6Cpa" name="Alex Rivera" service="Beard Trim • Sarah" time="10:45 AM" />
              <AppointmentRow initials="MK" name="Mike Kim" service="Hot Towel Shave • Marcus" time="11:30 AM" />
            </div>
            <button className="mt-auto w-full py-3 bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:opacity-90 transition-opacity">
              + New Appointment
            </button>
          </div>

          {/* Chart + Staff */}
          <div className="lg:col-span-2 flex flex-col gap-gutter">
            <div className="bg-surface-elevated border border-border-subtle rounded-xl p-6 flex flex-col h-64 relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4 z-10 relative">
                <h3 className="font-headline-md text-[20px] font-semibold text-white">Revenue Trend</h3>
                <div className="flex gap-2">
                  <span className="inline-block px-2 py-1 rounded border border-border-subtle font-label-sm text-label-sm text-text-muted bg-surface-deep">This Week</span>
                </div>
              </div>
              <div className="flex-1 w-full flex items-end justify-between gap-2 z-10 relative px-4 pb-2 border-b border-border-subtle">
                <div className="w-full flex justify-between items-end h-full gap-2 opacity-80">
                  {[
                    { h: 30, active: false },
                    { h: 50, active: false },
                    { h: 40, active: false },
                    { h: 80, active: true },
                    { h: 65, active: false },
                    { h: 90, active: false },
                    { h: 20, active: false },
                  ].map((b, i) => (
                    <div
                      key={i}
                      className={
                        b.active
                          ? "flex-1 bg-primary rounded-t-sm shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                          : "flex-1 bg-surface-container-highest hover:bg-primary transition-colors cursor-pointer rounded-t-sm"
                      }
                      style={{ height: `${b.h}%` }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-between w-full px-4 pt-2 z-10 relative">
                {["M","T","W","T","F","S","S"].map((d, i) => (
                  <span key={i} className={`font-label-sm text-label-sm ${i === 3 ? "text-primary font-bold" : "text-text-muted"}`}>{d}</span>
                ))}
              </div>
            </div>

            <div className="bg-surface-elevated border border-border-subtle rounded-xl p-6 flex flex-col flex-1">
              <h3 className="font-headline-md text-[20px] font-semibold text-white mb-6 border-b border-border-subtle pb-4">Barber Performance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BarberCard
                  name="Marcus T."
                  role="Senior Master"
                  pct={85}
                  detail="85% ($850 / $1000)"
                  tags={["Fades", "Lines"]}
                  img="https://lh3.googleusercontent.com/aida-public/AB6AXuDe6P4s1_t-k3Nfe2p65cHyrrYtfiY2QwWaijL51ovS1fWltEDb_4mEgdiRg764HfgS3yt_dyKkm1t3FAY80XdKcJp9ItTxtXjJDtLv3JFB_BuxxgQop51qJxBEe2re1Ewl1ZPhPkMu1jhgWBf4YDKHbVTdyyfEs4EcEaOcS5pBYmk7xKVM1OyPH-MC5xs-DcTEWsHlmRfC788cl1yU_7m9aKztC2CGM22K7lBxPsfnWJQBK_hLYwSp"
                />
                <BarberCard
                  name="Sarah J."
                  role="Specialist"
                  pct={60}
                  detail="60% ($480 / $800)"
                  tags={["Beards", "Shaves"]}
                  img="https://lh3.googleusercontent.com/aida-public/AB6AXuB5IKjp4aA7mb_A28kpUsyjVUYRxRjFIoSGN4CDP4fd93TqVLoIMqhxIJZVQnEk0aYYlToLPZd9TXITrl1nqT0YuGhajuLpznIFhf3nN97YrNHHfv0xv4ODv3a-juw5EaAH19721MVHJWXCVD0m-866haNhqipD0iCd4bRAMQrX5yV1K02hCSVo5xNFGXV_DCwy-xFwjO7_zGDcWKDx5D8K5GzpNn8BEjorpzjcjlM-s-HrArTaV5kp"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 bg-surface-elevated border-t border-border-subtle shadow-lg">
        <div className="flex justify-around items-center h-16 px-margin-mobile">
          <Link to="/" className="flex flex-col items-center justify-center text-secondary-fixed-dim w-full h-full">
            <Icon name="search" className="text-[24px]" />
            <span className="font-label-sm text-[10px] mt-1">Explore</span>
          </Link>
          <Link to="/shop" className="flex flex-col items-center justify-center text-secondary-fixed-dim w-full h-full">
            <Icon name="event_note" className="text-[24px]" />
            <span className="font-label-sm text-[10px] mt-1">Bookings</span>
          </Link>
          <Link to="/barber" className="flex flex-col items-center justify-center text-secondary-fixed-dim w-full h-full">
            <Icon name="calendar_today" className="text-[24px]" />
            <span className="font-label-sm text-[10px] mt-1">Barber</span>
          </Link>
          <Link to="/owner" className="flex flex-col items-center justify-center text-primary font-bold w-full h-full">
            <Icon name="dashboard" className="text-[24px]" filled />
            <span className="font-label-sm text-[10px] mt-1">Owner</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

function AppointmentRow({
  initials,
  imgSrc,
  name,
  service,
  time,
  hint,
  highlight,
}: {
  initials?: string;
  imgSrc?: string;
  name: string;
  service: string;
  time: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center p-3 rounded-lg hover:bg-surface-elevated transition-colors border border-transparent hover:border-border-subtle cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-surface-container-highest text-black flex items-center justify-center font-label-md overflow-hidden">
          {imgSrc ? <img className="w-full h-full object-cover" src={imgSrc} alt={name} /> : initials}
        </div>
        <div>
          <p className="font-label-md text-label-md text-white">{name}</p>
          <p className="font-label-sm text-label-sm text-text-muted">{service}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`font-label-md text-label-md ${highlight ? "text-primary" : "text-white"}`}>{time}</p>
        {hint && <p className="font-label-sm text-label-sm text-text-muted">{hint}</p>}
      </div>
    </div>
  );
}

function BarberCard({
  name,
  role,
  pct,
  detail,
  tags,
  img,
}: {
  name: string;
  role: string;
  pct: number;
  detail: string;
  tags: string[];
  img: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden border border-border-subtle">
          <img className="w-full h-full object-cover" src={img} alt={name} />
        </div>
        <div>
          <p className="font-label-md text-label-md text-white">{name}</p>
          <p className="font-label-sm text-label-sm text-text-muted">{role}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between font-label-sm text-label-sm">
          <span className="text-text-muted">Daily Target</span>
          <span className="text-white">{detail}</span>
        </div>
        <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
          <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        {tags.map((t) => (
          <span key={t} className="px-2 py-1 border border-border-subtle rounded-full font-label-sm text-label-sm text-text-muted">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}