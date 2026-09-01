import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  handlePaymentsWebhook,
  type StripeEvent,
} from "./payments-webhook.server.ts";

type Row = Record<string, unknown>;

type MemoryOptions = {
  selectError?: { table: string; message: string };
  insertError?: { table: string; message: string; code?: string };
};

function createMemoryAdmin(seed: Record<string, Row[]>, options: MemoryOptions = {}) {
  const tables: Record<string, Row[]> = Object.fromEntries(
    Object.entries(seed).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]),
  );

  function matches(row: Row, filters: Array<[string, unknown]>) {
    return filters.every(([key, value]) => row[key] === value);
  }

  function from(table: string) {
    const query = {
      filters: [] as Array<[string, unknown]>,
      action: "select" as "select" | "insert" | "update" | "upsert",
      payload: null as Row | null,
      select() {
        return query;
      },
      insert(row: Row) {
        query.action = "insert";
        query.payload = row;
        return query;
      },
      update(row: Row) {
        query.action = "update";
        query.payload = row;
        return query;
      },
      upsert(row: Row) {
        query.action = "upsert";
        query.payload = row;
        return query;
      },
      eq(column: string, value: unknown) {
        query.filters.push([column, value]);
        return query;
      },
      maybeSingle() {
        return Promise.resolve(execute("maybeSingle"));
      },
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
        return Promise.resolve(execute("list")).then(resolve, reject);
      },
    };

    function execute(mode: "maybeSingle" | "list") {
      const rows = tables[table] ?? (tables[table] = []);
      if (query.action === "select" && options.selectError?.table === table) {
        return { data: null, error: { message: options.selectError.message } };
      }
      if (query.action === "insert" && options.insertError?.table === table) {
        return {
          data: null,
          error: { message: options.insertError.message, code: options.insertError.code },
        };
      }

      if (query.action === "insert" && query.payload) {
        const key = table === "stripe_webhook_events" ? "stripe_event_id" : "id";
        if (rows.some((row) => row[key] === query.payload![key])) {
          return { data: null, error: { message: "duplicate", code: "23505" } };
        }
        rows.push({ ...query.payload });
        return { data: [{ ...query.payload }], error: null };
      }

      if (query.action === "update" && query.payload) {
        const matched = rows.filter((row) => matches(row, query.filters));
        for (const row of matched) Object.assign(row, query.payload);
        const data = matched.map((row) => ({ ...row }));
        return mode === "maybeSingle" ? { data: data[0] ?? null, error: null } : { data, error: null };
      }

      if (query.action === "upsert" && query.payload) {
        const existing = rows.find(
          (row) =>
            row.shop_id === query.payload!.shop_id && row.environment === query.payload!.environment,
        );
        if (existing) Object.assign(existing, query.payload);
        else rows.push({ id: `row-${rows.length + 1}`, ...query.payload });
        const data = [existing ?? rows[rows.length - 1]];
        return mode === "maybeSingle" ? { data: data[0] ?? null, error: null } : { data, error: null };
      }

      const found = rows.filter((row) => matches(row, query.filters));
      if (mode === "maybeSingle") return { data: found[0] ?? null, error: null };
      return { data: found, error: null };
    }

    return query;
  }

  return { tables, from };
}

const bookingRow = {
  id: "book-1",
  shop_id: "shop-1",
  payment_status: "awaiting_payment",
  status: "pending",
  stripe_checkout_session_id: "cs_1",
  amount_due_cents: 2500,
  payment_environment: "sandbox",
};

function sessionEvent(
  type: string,
  session: Record<string, unknown>,
  id = "evt_1",
): StripeEvent {
  return {
    id,
    type,
    created: 1_725_200_000,
    data: { object: session },
  };
}

function paidSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_1",
    mode: "payment",
    payment_status: "paid",
    currency: "usd",
    amount_total: 2500,
    metadata: { booking_id: "book-1", shop_id: "shop-1" },
    ...overrides,
  };
}

function request(env = "sandbox") {
  return new Request(`https://example.test/api/public/payments/webhook?env=${env}`, {
    method: "POST",
  });
}

async function post(event: StripeEvent, admin: ReturnType<typeof createMemoryAdmin>) {
  return handlePaymentsWebhook(request(), async () => event, admin as never);
}

describe("handlePaymentsWebhook", () => {
  it("returns 400 for an invalid env or signature", async () => {
    const admin = createMemoryAdmin({});
    const badEnv = await handlePaymentsWebhook(
      request("prod"),
      async () => {
        throw new Error("should not verify");
      },
      admin as never,
    );
    assert.equal(badEnv.status, 400);

    const badSig = await handlePaymentsWebhook(
      request(),
      async () => {
        throw new Error("Invalid signature");
      },
      admin as never,
    );
    assert.equal(badSig.status, 400);
  });

  it("returns 500 when the event ledger cannot be read so Stripe retries", async () => {
    const admin = createMemoryAdmin(
      { bookings: [{ ...bookingRow }] },
      { selectError: { table: "stripe_webhook_events", message: "connection refused" } },
    );
    const response = await post(
      sessionEvent("checkout.session.completed", paidSession()),
      admin,
    );
    assert.equal(response.status, 500);
    assert.equal(admin.tables.bookings[0]?.payment_status, "awaiting_payment");
  });

  it("confirms a paid checkout and treats a replay as a duplicate", async () => {
    const admin = createMemoryAdmin({
      bookings: [{ ...bookingRow }],
      stripe_webhook_events: [],
    });
    const event = sessionEvent("checkout.session.completed", paidSession());
    const first = await post(event, admin);
    assert.equal(first.status, 200);
    assert.equal(admin.tables.bookings[0]?.payment_status, "paid");
    assert.equal(admin.tables.bookings[0]?.status, "confirmed");
    assert.equal(admin.tables.stripe_webhook_events[0]?.status, "completed");

    const second = await post(event, admin);
    assert.equal(second.status, 200);
    const body = (await second.json()) as { duplicate?: boolean };
    assert.equal(body.duplicate, true);
    assert.equal(admin.tables.bookings.length, 1);
  });

  it("does not confirm an unpaid asynchronous checkout", async () => {
    const admin = createMemoryAdmin({ bookings: [{ ...bookingRow }] });
    const response = await post(
      sessionEvent(
        "checkout.session.completed",
        paidSession({ payment_status: "unpaid" }),
      ),
      admin,
    );
    assert.equal(response.status, 200);
    assert.equal(admin.tables.bookings[0]?.payment_status, "awaiting_payment");
    assert.equal(admin.tables.stripe_webhook_events[0]?.status, "completed");
  });

  it("does not cancel an already-paid booking on a late expiration", async () => {
    const admin = createMemoryAdmin({
      bookings: [{ ...bookingRow, payment_status: "paid", status: "confirmed" }],
    });
    const response = await post(
      sessionEvent("checkout.session.expired", paidSession({ payment_status: "unpaid" })),
      admin,
    );
    assert.equal(response.status, 200);
    assert.equal(admin.tables.bookings[0]?.payment_status, "paid");
    assert.equal(admin.tables.bookings[0]?.status, "confirmed");
  });

  it("ignores checkout metadata that would update an unrelated booking", async () => {
    const admin = createMemoryAdmin({ bookings: [{ ...bookingRow }] });
    const response = await post(
      sessionEvent(
        "checkout.session.completed",
        paidSession({ metadata: { booking_id: "book-OTHER", shop_id: "shop-1" } }),
      ),
      admin,
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ignored?: boolean };
    assert.equal(body.ignored, true);
    assert.equal(admin.tables.bookings[0]?.payment_status, "awaiting_payment");
    assert.equal(admin.tables.stripe_webhook_events[0]?.status, "ignored");
  });

  it("keeps the newest subscription state when an older event arrives late", async () => {
    const newer = "2026-09-01T12:00:00.000Z";
    const admin = createMemoryAdmin({
      shops: [{ id: "shop-1" }],
      subscriptions: [
        {
          id: "sub-1",
          shop_id: "shop-1",
          environment: "sandbox",
          stripe_customer_id: "cus_1",
          stripe_subscription_id: "sub_1",
          status: "active",
          last_stripe_event_at: newer,
        },
      ],
    });
    const olderCreated = Math.floor(Date.parse(newer) / 1000) - 60;
    const response = await handlePaymentsWebhook(
      request(),
      async () => ({
        id: "evt_old",
        type: "customer.subscription.updated",
        created: olderCreated,
        data: {
          object: {
            id: "sub_1",
            customer: "cus_1",
            status: "canceled",
            metadata: { shop_id: "shop-1" },
          },
        },
      }),
      admin as never,
    );
    assert.equal(response.status, 200);
    assert.equal(admin.tables.subscriptions[0]?.status, "active");
  });
});
