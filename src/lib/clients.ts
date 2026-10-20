/** Pure CRM helpers shared by server and UI. */

export const LAPSED_DAYS = 45;

export type ClientSummary = {
  /** Unique row key: the account id, or `walkin:<phone>` for walk-ins. */
  key: string;
  customer_id: string;
  /** Walk-ins have no account of their own; they are identified by phone. */
  walk_in: boolean;
  name: string;
  phone: string | null;
  email: string | null;
  first_visit: string | null;
  last_visit: string | null;
  next_visit: string | null;
  visits: number;
  no_shows: number;
  total_spent_cents: number;
  days_since_last_visit: number | null;
  lapsed: boolean;
};

type BookingRow = {
  customer_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  starts_at: string;
  status: string;
  price_cents: number;
  source?: string | null;
};

export function summarizeClients(rows: BookingRow[], now: Date): ClientSummary[] {
  const map = new Map<string, ClientSummary>();
  for (const r of rows) {
    // Walk-ins have no account of their own; group them by phone.
    const key =
      r.source === "walk_in" && r.customer_phone ? `walkin:${r.customer_phone}` : r.customer_id;
    let c = map.get(key);
    if (!c) {
      c = {
        key,
        customer_id: r.customer_id,
        walk_in: key !== r.customer_id,
        name: r.customer_name?.trim() || "Client",
        phone: r.customer_phone,
        email: null,
        first_visit: null,
        last_visit: null,
        next_visit: null,
        visits: 0,
        no_shows: 0,
        total_spent_cents: 0,
        days_since_last_visit: null,
        lapsed: false,
      };
      map.set(key, c);
    }
    if (!c.phone && r.customer_phone) c.phone = r.customer_phone;
    const t = new Date(r.starts_at);
    if (r.status === "no_show") c.no_shows += 1;
    if (r.status === "cancelled" || r.status === "no_show") continue;
    if (t > now) {
      if (!c.next_visit || t < new Date(c.next_visit)) c.next_visit = r.starts_at;
      continue;
    }
    c.visits += 1;
    if (r.status === "completed") c.total_spent_cents += r.price_cents;
    if (!c.first_visit || t < new Date(c.first_visit)) c.first_visit = r.starts_at;
    if (!c.last_visit || t > new Date(c.last_visit)) c.last_visit = r.starts_at;
  }
  for (const c of map.values()) {
    if (c.last_visit) {
      c.days_since_last_visit = Math.floor(
        (now.getTime() - new Date(c.last_visit).getTime()) / 86_400_000,
      );
      c.lapsed = !c.next_visit && c.days_since_last_visit >= LAPSED_DAYS;
    }
  }
  return [...map.values()].sort((a, b) => b.total_spent_cents - a.total_spent_cents);
}

export function recallMessage(clientName: string, shopName: string, bookUrl: string) {
  const first = clientName.split(" ")[0] || "there";
  return `Hi ${first}, it's been a while since your last visit at ${shopName} — we'd love to see you again! Book your next appointment here: ${bookUrl}`;
}
