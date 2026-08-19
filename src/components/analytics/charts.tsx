import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  ProviderRow,
  Retention,
  SeriesPoint,
  ServiceRow,
  SurveyStats,
  Utilization,
} from "@/lib/analytics-types";
import {
  CHART_COLORS,
  ChartTooltip,
  countAxis,
  EmptyState,
  hourLabel,
  money,
  moneyAxis,
  Panel,
  pct,
  WEEKDAYS,
} from "@/components/analytics/shared";

const AXIS = {
  stroke: "var(--color-outline)",
  tick: { fill: "var(--color-on-surface-variant)", fontSize: 11 },
};

/** Show fewer x labels on dense ranges so they never overlap. */
function tickInterval(count: number): number {
  if (count <= 10) return 0;
  return Math.ceil(count / 10) - 1;
}

export function RevenueTrend({ series }: { series: SeriesPoint[] }) {
  const hasData = series.some((p) => p.revenueBookedCents > 0 || p.revenueCollectedCents > 0);
  return (
    <Panel
      title="Revenue trend"
      subtitle="Booked value is everything on the calendar; collected is what customers prepaid."
    >
      {!hasData ? (
        <EmptyState message="No revenue in this period yet." />
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="bookedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="collectedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CHART_COLORS[1]} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-outline-variant)" vertical={false} />
              <XAxis
                dataKey="label"
                interval={tickInterval(series.length)}
                axisLine={AXIS}
                tickLine={false}
                tick={AXIS.tick}
              />
              <YAxis
                tickFormatter={moneyAxis}
                axisLine={false}
                tickLine={false}
                tick={AXIS.tick}
                width={56}
              />
              <Tooltip content={<ChartTooltip format={(v) => money(v)} />} />
              <Legend
                verticalAlign="top"
                height={28}
                wrapperStyle={{ fontSize: 12, color: "var(--color-on-surface-variant)" }}
              />
              <Area
                type="monotone"
                name="Booked"
                dataKey="revenueBookedCents"
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                fill="url(#bookedFill)"
              />
              <Area
                type="monotone"
                name="Collected"
                dataKey="revenueCollectedCents"
                stroke={CHART_COLORS[1]}
                strokeWidth={2}
                fill="url(#collectedFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

export function BookingsTrend({ series }: { series: SeriesPoint[] }) {
  const hasData = series.some((p) => p.total > 0);
  return (
    <Panel title="Appointments by day" subtitle="Stacked by status, with lost-booking rate overlaid.">
      {!hasData ? (
        <EmptyState message="No appointments booked in this period." />
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-outline-variant)" vertical={false} />
              <XAxis
                dataKey="label"
                interval={tickInterval(series.length)}
                axisLine={AXIS}
                tickLine={false}
                tick={AXIS.tick}
              />
              <YAxis
                allowDecimals={false}
                tickFormatter={countAxis}
                axisLine={false}
                tickLine={false}
                tick={AXIS.tick}
                width={36}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    format={(v, key) => (key === "lostRatePct" ? pct(v, 1) : String(v))}
                  />
                }
              />
              <Legend
                verticalAlign="top"
                height={28}
                wrapperStyle={{ fontSize: 12, color: "var(--color-on-surface-variant)" }}
              />
              <Bar stackId="s" name="Completed" dataKey="completed" fill={CHART_COLORS[1]} />
              <Bar stackId="s" name="Confirmed" dataKey="confirmed" fill={CHART_COLORS[0]} />
              <Bar stackId="s" name="Pending" dataKey="pending" fill={CHART_COLORS[5]} />
              <Bar stackId="s" name="Cancelled" dataKey="cancelled" fill={CHART_COLORS[3]} />
              <Bar
                stackId="s"
                name="No-show"
                dataKey="noShow"
                fill="var(--color-negative)"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

export function LostBookingsTrend({ series }: { series: SeriesPoint[] }) {
  const hasData = series.some((p) => p.cancelled + p.noShow > 0);
  return (
    <Panel title="Cancellations & no-shows" subtitle="Share of appointments lost each period.">
      {!hasData ? (
        <EmptyState message="No cancellations or no-shows — nice." />
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-outline-variant)" vertical={false} />
              <XAxis
                dataKey="label"
                interval={tickInterval(series.length)}
                axisLine={AXIS}
                tickLine={false}
                tick={AXIS.tick}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                axisLine={false}
                tickLine={false}
                tick={AXIS.tick}
                width={44}
              />
              <Tooltip content={<ChartTooltip format={(v) => pct(v, 1)} />} />
              <Line
                type="monotone"
                name="Lost rate"
                dataKey="lostRatePct"
                stroke="var(--color-negative)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

export function ServicePerformance({ services }: { services: ServiceRow[] }) {
  const top = services.slice(0, 8);
  return (
    <Panel title="Sales by service" subtitle="Revenue and volume for every service booked.">
      {top.length === 0 ? (
        <EmptyState message="No services booked in this period." />
      ) : (
        <>
          <div style={{ height: Math.max(160, top.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
              >
                <CartesianGrid stroke="var(--color-outline-variant)" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={moneyAxis}
                  axisLine={false}
                  tickLine={false}
                  tick={AXIS.tick}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  axisLine={false}
                  tickLine={false}
                  tick={AXIS.tick}
                />
                <Tooltip content={<ChartTooltip format={(v) => money(v)} />} />
                <Bar name="Revenue" dataKey="revenueCents" radius={[0, 4, 4, 0]}>
                  {top.map((row, i) => (
                    <Cell key={row.id} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-label-sm">
              <thead>
                <tr className="text-on-surface-variant text-left">
                  <th className="py-2 font-medium">Service</th>
                  <th className="py-2 font-medium text-right">Bookings</th>
                  <th className="py-2 font-medium text-right">Avg price</th>
                  <th className="py-2 font-medium text-right">Revenue</th>
                  <th className="py-2 font-medium text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {services.map((row) => (
                  <tr key={row.id} className="border-t border-border-subtle">
                    <td className="py-2 text-on-surface">{row.name}</td>
                    <td className="py-2 text-right text-on-surface-variant">{row.bookings}</td>
                    <td className="py-2 text-right text-on-surface-variant">
                      {money(row.avgPriceCents)}
                    </td>
                    <td className="py-2 text-right text-on-surface font-semibold">
                      {money(row.revenueCents)}
                    </td>
                    <td className="py-2 text-right text-on-surface-variant">
                      {pct(row.sharePct, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}

export function ProviderPerformance({ providers }: { providers: ProviderRow[] }) {
  return (
    <Panel title="Sales by provider" subtitle="Revenue split and average survey rating per person.">
      {providers.length === 0 ? (
        <EmptyState message="No provider activity in this period." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[220px_1fr] items-center">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={providers}
                  dataKey="revenueCents"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={2}
                  stroke="var(--color-surface)"
                >
                  {providers.map((row, i) => (
                    <Cell key={row.id} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip format={(v) => money(v)} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-label-sm">
              <thead>
                <tr className="text-on-surface-variant text-left">
                  <th className="py-2 font-medium">Provider</th>
                  <th className="py-2 font-medium text-right">Appts</th>
                  <th className="py-2 font-medium text-right">Avg ticket</th>
                  <th className="py-2 font-medium text-right">Rating</th>
                  <th className="py-2 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((row, i) => (
                  <tr key={row.id} className="border-t border-border-subtle">
                    <td className="py-2 text-on-surface flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      {row.name}
                    </td>
                    <td className="py-2 text-right text-on-surface-variant">{row.appointments}</td>
                    <td className="py-2 text-right text-on-surface-variant">
                      {money(row.avgTicketCents)}
                    </td>
                    <td className="py-2 text-right text-on-surface-variant">
                      {row.avgRating === null ? "—" : `${row.avgRating.toFixed(1)}★`}
                    </td>
                    <td className="py-2 text-right text-on-surface font-semibold">
                      {money(row.revenueCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Panel>
  );
}

const SENTIMENT_LABELS: Record<string, string> = {
  very_positive: "Very positive",
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  very_negative: "Very negative",
};

export function SurveyPanel({ surveys }: { surveys: SurveyStats }) {
  const ratingData = surveys.ratingCounts.map((r) => ({ ...r, label: `${r.rating}★` }));
  return (
    <Panel
      title="Surveys & ratings"
      subtitle={`${surveys.responses} of ${surveys.invitesSent} invites completed (${pct(surveys.completionRatePct, 0)})`}
    >
      {surveys.responses === 0 ? (
        <EmptyState message="No survey responses yet in this period." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-outline-variant)" vertical={false} />
                <XAxis dataKey="label" axisLine={AXIS} tickLine={false} tick={AXIS.tick} />
                <YAxis
                  allowDecimals={false}
                  tickFormatter={countAxis}
                  axisLine={false}
                  tickLine={false}
                  tick={AXIS.tick}
                  width={30}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar name="Responses" dataKey="count" radius={[4, 4, 0, 0]}>
                  {ratingData.map((row) => (
                    <Cell
                      key={row.rating}
                      fill={
                        row.rating >= 4
                          ? "var(--color-positive)"
                          : row.rating === 3
                            ? "var(--color-caution)"
                            : "var(--color-negative)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-surface-container p-4">
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wide">
                Average rating
              </p>
              <p className="font-headline-md text-headline-md text-on-surface">
                {surveys.avgRating === null ? "—" : `${surveys.avgRating.toFixed(2)} / 5`}
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {surveys.sentiment.map((s, i) => (
                <li key={s.label} className="flex items-center gap-2 text-label-sm">
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="text-on-surface-variant">
                    {SENTIMENT_LABELS[s.label] ?? s.label}
                  </span>
                  <span className="ml-auto text-on-surface font-semibold">{s.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Panel>
  );
}

export function UtilizationHeatmap({ utilization }: { utilization: Utilization }) {
  const hours = [...new Set(utilization.cells.map((c) => c.hour))].sort((a, b) => a - b);
  const max = Math.max(...utilization.cells.map((c) => c.count), 1);
  const busiest = utilization.busiest;

  return (
    <Panel
      title="Capacity & peak hours"
      subtitle={
        busiest
          ? `Busiest slot: ${WEEKDAYS[busiest.weekday]} at ${hourLabel(busiest.hour)} — ${pct(utilization.capacityUsedPct, 0)} of open hours booked`
          : "No booked hours yet in this period."
      }
    >
      {utilization.cells.length === 0 ? (
        <EmptyState message="Set your opening hours to see utilization." />
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[420px]">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `44px repeat(${hours.length}, minmax(0, 1fr))` }}
            >
              <span />
              {hours.map((h) => (
                <span key={h} className="text-label-sm text-on-surface-variant text-center">
                  {hourLabel(h)}
                </span>
              ))}
              {WEEKDAYS.map((day, weekday) => (
                <div key={day} className="contents">
                  <span className="text-label-sm text-on-surface-variant self-center">{day}</span>
                  {hours.map((hour) => {
                    const cell = utilization.cells.find(
                      (c) => c.weekday === weekday && c.hour === hour,
                    );
                    const count = cell?.count ?? 0;
                    const open = cell?.open ?? false;
                    return (
                      <div
                        key={`${weekday}-${hour}`}
                        title={`${day} ${hourLabel(hour)} — ${count} appointment${count === 1 ? "" : "s"}${open ? "" : " (closed)"}`}
                        className="h-7 rounded"
                        style={{
                          backgroundColor:
                            count === 0
                              ? open
                                ? "var(--color-surface-container)"
                                : "var(--color-surface-dim)"
                              : CHART_COLORS[0],
                          opacity: count === 0 ? (open ? 1 : 0.45) : 0.25 + (count / max) * 0.75,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="text-label-sm text-on-surface-variant mt-3">
              {Math.round(utilization.bookedMinutes / 60)}h booked of ~
              {Math.round(utilization.openMinutes / 60)}h open
            </p>
          </div>
        </div>
      )}
    </Panel>
  );
}

export function RetentionPanel({ retention }: { retention: Retention }) {
  const data = [
    { name: "Returning", value: retention.returningCustomers },
    { name: "New", value: retention.newCustomers },
  ].filter((d) => d.value > 0);

  return (
    <Panel
      title="New vs returning"
      subtitle={`${pct(retention.returningSharePct, 0)} of customers in this period had visited before.`}
    >
      {data.length === 0 ? (
        <EmptyState message="No customers in this period yet." />
      ) : (
        <div className="grid gap-5 md:grid-cols-[200px_1fr] items-center">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={2}
                  stroke="var(--color-surface)"
                >
                  {data.map((row, i) => (
                    <Cell key={row.name} fill={CHART_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wide mb-2">
              Top repeat customers
            </p>
            {retention.topRepeat.length === 0 ? (
              <p className="text-label-sm text-on-surface-variant">No repeat visits yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {retention.topRepeat.map((c) => (
                  <li key={c.name} className="flex items-center gap-2 text-label-sm">
                    <span className="text-on-surface">{c.name}</span>
                    <span className="text-on-surface-variant">· {c.visits} visits</span>
                    <span className="ml-auto text-on-surface font-semibold">
                      {money(c.revenueCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}