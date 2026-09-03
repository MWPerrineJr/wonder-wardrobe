import { buildInsightFacts, generateBriefing } from "@/lib/analytics-insights.server";
import { emptyAnalytics } from "@/lib/analytics-types";

const a = emptyAnalytics(30) as any;
a.kpis = {
  revenueBookedCents: { current: 480000, previous: 410000 },
  revenueCollectedCents: { current: 190000, previous: 200000 },
  appointments: { current: 64, previous: 58 },
  avgTicketCents: { current: 7500, previous: 7100 },
  completionRate: { current: 84, previous: 91 },
  avgRating: { current: 4.4, previous: 4.7 },
};
a.series = [
  { bucket: "2026-08-05", label: "Aug 5", revenueBookedCents: 120000, revenueCollectedCents: 50000, total: 16, completed: 13, confirmed: 1, pending: 0, cancelled: 1, noShow: 1, lostRatePct: 12, returningSharePct: 40 },
  { bucket: "2026-08-12", label: "Aug 12", revenueBookedCents: 90000, revenueCollectedCents: 40000, total: 14, completed: 11, confirmed: 1, pending: 0, cancelled: 2, noShow: 0, lostRatePct: 14, returningSharePct: 35 },
  { bucket: "2026-08-19", label: "Aug 19", revenueBookedCents: 130000, revenueCollectedCents: 55000, total: 18, completed: 15, confirmed: 1, pending: 0, cancelled: 1, noShow: 1, lostRatePct: 11, returningSharePct: 55 },
  { bucket: "2026-08-26", label: "Aug 26", revenueBookedCents: 140000, revenueCollectedCents: 45000, total: 16, completed: 12, confirmed: 1, pending: 0, cancelled: 2, noShow: 1, lostRatePct: 19, returningSharePct: 60 },
];
a.services = [
  { id: "1", name: "Balayage", bookings: 18, revenueCents: 250000, avgPriceCents: 13900, sharePct: 52 },
  { id: "2", name: "Cut & style", bookings: 30, revenueCents: 150000, avgPriceCents: 5000, sharePct: 31 },
  { id: "3", name: "Gel manicure", bookings: 16, revenueCents: 80000, avgPriceCents: 5000, sharePct: 17 },
];
a.providers = [
  { id: "p1", name: "Dana", appointments: 34, revenueCents: 300000, avgTicketCents: 8800, avgRating: 4.8, sharePct: 62 },
  { id: "p2", name: "Marc", appointments: 30, revenueCents: 180000, avgTicketCents: 6000, avgRating: 3.9, sharePct: 38 },
];
a.surveys = { invitesSent: 50, responses: 18, completionRatePct: 36, avgRating: 4.4, ratingCounts: [{rating:1,count:1},{rating:2,count:1},{rating:3,count:2},{rating:4,count:5},{rating:5,count:9}], sentiment: [{label:"positive",count:12},{label:"negative",count:3}] };
a.utilization = { cells: [ {weekday:6,hour:10,count:9,open:false},{weekday:2,hour:11,count:1,open:true},{weekday:5,hour:16,count:8,open:true} ], openHours: [], bookedMinutes: 3600, openMinutes: 9600, capacityUsedPct: 37.5, busiest: {weekday:5,hour:16,count:8} };
a.retention = { newCustomers: 22, returningCustomers: 18, returningSharePct: 45, topRepeat: [{name:"Jess",visits:4,revenueCents:52000}] };

const facts = buildInsightFacts(a);
console.log("fingerprint", facts.fingerprint, "appts", facts.appointments);
const out = await generateBriefing(process.env.LOVABLE_API_KEY!, facts.lines);
console.log(JSON.stringify(out, null, 2));
