// Server-only: turn the aggregated analytics DTO into a briefing for the owner.
// All arithmetic happens here; the model only explains and prioritises.
import { streamText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";

import { createGateway, FEEDBACK_MODEL } from "./ai.server";
import type { ShopAnalytics } from "./analytics-types";
import type { AnalyticsBriefing } from "./analytics-insights-types";

const briefingSchema = z.object({
  headline: z.string(),
  drivers: z
    .array(
      z.object({
        metric: z.string(),
        movement: z.string(),
        cause: z.string(),
        tone: z.enum(["positive", "negative", "watch"]),
      }),
    )
    .min(1),
  actions: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        impact: z.enum(["high", "medium", "low"]),
        evidence: z.string(),
      }),
    )
    .min(1),
  risks: z.array(z.string()),
});

const SYSTEM = [
  "You are an operations analyst for a small beauty or wellness business (hair, nails, waxing, makeup, massage, skincare, brows, spa).",
  "You are given already-computed metrics for a date range and the previous equal-length range. Never recompute or invent numbers: quote only figures present in the input, verbatim.",
  "headline is ONE sentence naming the single most important thing that happened, with the numbers behind it.",
  "drivers holds 3 to 5 items. metric is the short name of what moved. movement states direction and size using the given figures. cause names the specific service, provider, weekday/hour block, cancellation behaviour or customer-mix shift in the data that explains it. tone is positive, negative, or watch.",
  "actions holds 3 to 4 decisions the owner can make this month, ordered by expected impact, each with a short imperative title, two sentences of detail, and evidence quoting the numbers that justify it.",
  "risks holds 0 to 4 short warnings such as revenue concentrated in one service or provider, falling ratings, low survey response, unused capacity, or rising no-shows.",
  "Never mention SQL, tables, the dashboard, or that you are an AI. Write plainly to the owner. Never use placeholders.",
  "If the data is thin, say so honestly in the headline instead of overstating a trend.",
].join(" ");

const cents = (v: number) => `$${(v / 100).toFixed(2)}`;
const pct = (v: number) => `${v.toFixed(1)}%`;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function hour12(h: number) {
  const suffix = h >= 12 ? "pm" : "am";
  return `${h % 12 === 0 ? 12 : h % 12}${suffix}`;
}

function delta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "no change (both periods zero)" : "no prior baseline";
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs previous period`;
}

/**
 * Deterministic facts derived from the analytics DTO. This is the whole factual
 * basis of the briefing — the model receives nothing else.
 */
export function buildInsightFacts(a: Omit<ShopAnalytics, "locked">) {
  const { kpis, series, services, providers, surveys, utilization, retention } = a;

  const totals = series.reduce(
    (acc, p) => {
      acc.cancelled += p.cancelled;
      acc.noShow += p.noShow;
      acc.total += p.total;
      return acc;
    },
    { cancelled: 0, noShow: 0, total: 0 },
  );

  const lostCount = totals.cancelled + totals.noShow;
  const avgTicket = kpis.avgTicketCents.current;
  const lostValueCents = lostCount * avgTicket;

  const half = Math.floor(series.length / 2);
  const firstHalf = series.slice(0, half);
  const secondHalf = series.slice(half);
  const sumRev = (rows: typeof series) => rows.reduce((s, p) => s + p.revenueBookedCents, 0);

  const busiestPeriods = [...series].sort((x, y) => y.total - x.total).slice(0, 3);
  const openCells = utilization.cells.filter((c) => c.open);
  const quietOpen = [...openCells].sort((x, y) => x.count - y.count).slice(0, 3);
  const peakOpen = [...openCells].sort((x, y) => y.count - x.count).slice(0, 3);
  const closedButRequested = utilization.cells
    .filter((c) => !c.open && c.count > 0)
    .sort((x, y) => y.count - x.count)
    .slice(0, 3);

  const topServiceShare = services[0]?.sharePct ?? 0;
  const topProviderShare = providers[0]?.sharePct ?? 0;
  const unpaidShare =
    kpis.revenueBookedCents.current === 0
      ? 0
      : (1 - kpis.revenueCollectedCents.current / kpis.revenueBookedCents.current) * 100;

  return {
    appointments: kpis.appointments.current,
    lines: [
      `Range: last ${a.range.days} days, bucketed by ${a.range.granularity}.`,
      "",
      "KPIs (current vs previous equal-length period):",
      `- Booked revenue: ${cents(kpis.revenueBookedCents.current)} (prev ${cents(kpis.revenueBookedCents.previous)}, ${delta(kpis.revenueBookedCents.current, kpis.revenueBookedCents.previous)})`,
      `- Collected up front: ${cents(kpis.revenueCollectedCents.current)} (prev ${cents(kpis.revenueCollectedCents.previous)}, ${delta(kpis.revenueCollectedCents.current, kpis.revenueCollectedCents.previous)}); ${pct(unpaidShare)} of booked value is not prepaid`,
      `- Appointments: ${kpis.appointments.current} (prev ${kpis.appointments.previous}, ${delta(kpis.appointments.current, kpis.appointments.previous)})`,
      `- Average ticket: ${cents(kpis.avgTicketCents.current)} (prev ${cents(kpis.avgTicketCents.previous)}, ${delta(kpis.avgTicketCents.current, kpis.avgTicketCents.previous)})`,
      `- Completion rate: ${pct(kpis.completionRate.current)} (prev ${pct(kpis.completionRate.previous)})`,
      `- Average survey rating: ${kpis.avgRating.current === 0 ? "no ratings" : kpis.avgRating.current.toFixed(2)} out of 5 (prev ${kpis.avgRating.previous === 0 ? "no ratings" : kpis.avgRating.previous.toFixed(2)})`,
      "",
      "Momentum inside the range:",
      `- First half booked revenue ${cents(sumRev(firstHalf))}, second half ${cents(sumRev(secondHalf))} (${delta(sumRev(secondHalf), sumRev(firstHalf))})`,
      `- Strongest periods by volume: ${busiestPeriods.map((p) => `${p.label} (${p.total} appts, ${cents(p.revenueBookedCents)})`).join("; ") || "none"}`,
      "",
      "Lost bookings:",
      `- ${totals.cancelled} cancellations and ${totals.noShow} no-shows out of ${totals.total} appointments (${pct(totals.total === 0 ? 0 : (lostCount / totals.total) * 100)} lost)`,
      `- Estimated value of lost slots at the current average ticket: ${cents(lostValueCents)}`,
      "",
      "Services (by booked revenue):",
      ...(services.length === 0
        ? ["- none"]
        : services
            .slice(0, 8)
            .map(
              (s) =>
                `- ${s.name}: ${s.bookings} bookings, ${cents(s.revenueCents)}, avg ${cents(s.avgPriceCents)}, ${pct(s.sharePct)} of revenue`,
            )),
      `- Top service holds ${pct(topServiceShare)} of revenue.`,
      "",
      "Providers:",
      ...(providers.length === 0
        ? ["- none"]
        : providers.map(
            (p) =>
              `- ${p.name}: ${p.appointments} appointments, ${cents(p.revenueCents)}, avg ticket ${cents(p.avgTicketCents)}, rating ${p.avgRating === null ? "none yet" : p.avgRating.toFixed(2)}, ${pct(p.sharePct)} of revenue`,
          )),
      `- Top provider holds ${pct(topProviderShare)} of revenue.`,
      "",
      "Surveys and sentiment:",
      `- ${surveys.invitesSent} invites sent, ${surveys.responses} responses (${pct(surveys.completionRatePct)} response rate), average rating ${surveys.avgRating === null ? "none" : surveys.avgRating.toFixed(2)}`,
      `- Rating counts: ${surveys.ratingCounts.map((r) => `${r.rating}★ ${r.count}`).join(", ") || "none"}`,
      `- Sentiment: ${surveys.sentiment.map((s) => `${s.label.replace(/_/g, " ")} ${s.count}`).join(", ") || "none"}`,
      "",
      "Capacity:",
      `- ${Math.round(utilization.bookedMinutes / 60)} booked hours against ${Math.round(utilization.openMinutes / 60)} open hours (${pct(utilization.capacityUsedPct)} of capacity used)`,
      `- Busiest open slots: ${peakOpen.map((c) => `${WEEKDAYS[c.weekday]} ${hour12(c.hour)} (${c.count})`).join("; ") || "none"}`,
      `- Quietest open slots: ${quietOpen.map((c) => `${WEEKDAYS[c.weekday]} ${hour12(c.hour)} (${c.count})`).join("; ") || "none"}`,
      `- Appointments requested outside posted hours: ${closedButRequested.map((c) => `${WEEKDAYS[c.weekday]} ${hour12(c.hour)} (${c.count})`).join("; ") || "none"}`,
      "",
      "Customer mix:",
      `- ${retention.newCustomers} new customers, ${retention.returningCustomers} returning (${pct(retention.returningSharePct)} returning share)`,
      `- Top repeat customers: ${retention.topRepeat.map((c) => `${c.name} (${c.visits} visits, ${cents(c.revenueCents)})`).join("; ") || "none"}`,
    ].join("\n"),
    fingerprint: fingerprintOf([
      a.range.days,
      kpis.revenueBookedCents.current,
      kpis.revenueCollectedCents.current,
      kpis.appointments.current,
      kpis.avgTicketCents.current,
      Math.round(kpis.completionRate.current * 10),
      Math.round(kpis.avgRating.current * 100),
      totals.cancelled,
      totals.noShow,
      services.length,
      providers.length,
      surveys.responses,
      Math.round(utilization.capacityUsedPct),
      retention.newCustomers,
      retention.returningCustomers,
    ]),
  };
}

function fingerprintOf(values: number[]): string {
  const source = values.join("|");
  let hash = 5381;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) + hash + source.charCodeAt(i)) | 0;
  }
  return `v1-${(hash >>> 0).toString(36)}`;
}

export async function generateBriefing(apiKey: string, facts: string): Promise<AnalyticsBriefing> {
  const gateway = createGateway(apiKey);
  try {
    // Streamed on the wire (consumed server-side) so a slow reasoning call is
    // not severed and re-billed by the hosting platform's idle-request timeout.
    const result = streamText({
      model: gateway(FEEDBACK_MODEL),
      system: SYSTEM,
      prompt: `Here are this business's computed metrics. Write the briefing.\n\n${facts}`,
      output: Output.object({ schema: briefingSchema }),
    });
    const out = await result.output;
    return {
      headline: out.headline,
      drivers: out.drivers.slice(0, 5),
      actions: out.actions.slice(0, 4),
      risks: out.risks.slice(0, 4),
    };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error("The model returned an unusable briefing. Try refreshing again.");
    }
    throw error;
  }
}
