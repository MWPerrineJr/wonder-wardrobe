import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  addClientNote,
  deleteClientNote,
  getClientDetail,
  listClients,
  type ClientSummary,
} from "@/lib/clients.functions";
import { LAPSED_DAYS, recallMessage } from "@/lib/clients";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const money = (c: number) => `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

type Filter = "all" | "active" | "lapsed";

export function ClientsPanel({
  shopId,
  shopName,
  shopSlug,
}: {
  shopId: string;
  shopName: string;
  shopSlug: string;
}) {
  const fetchClients = useServerFn(listClients);
  const q = useQuery({
    queryKey: ["clients", shopId],
    queryFn: () => fetchClients({ data: { shopId } }),
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<ClientSummary | null>(null);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter((c) => {
      if (filter === "lapsed" && !c.lapsed) return false;
      if (filter === "active" && c.lapsed) return false;
      if (!s) return true;
      return [c.name, c.email, c.phone].some((v) => v?.toLowerCase().includes(s));
    });
  }, [q.data, search, filter]);

  const lapsedCount = (q.data ?? []).filter((c) => c.lapsed).length;
  const bookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/shop/${shopSlug}`
      : `/shop/${shopSlug}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Total clients" value={q.data?.length ?? 0} />
        <Stat label={`Not seen in ${LAPSED_DAYS}+ days`} value={lapsedCount} />
        <Stat
          label="Lifetime revenue"
          value={money((q.data ?? []).reduce((s, c) => s + c.total_spent_cents, 0))}
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          aria-label="Search clients"
          placeholder="Search name, email or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-surface border border-border-subtle rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:outline-none"
        />
        {(["all", "active", "lapsed"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-lg border text-label-sm font-semibold capitalize ${
              filter === f
                ? "bg-primary text-on-primary border-primary"
                : "bg-surface border-border-subtle text-on-surface-variant"
            }`}
          >
            {f === "lapsed" ? "Needs a recall" : f}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border-subtle rounded-xl overflow-x-auto shadow-sm">
        {q.isPending ? (
          <p className="p-6 text-on-surface-variant">Loading clients…</p>
        ) : q.isError ? (
          <p className="p-6 text-error">{(q.error as Error).message}</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-on-surface-variant">
            No clients yet — they appear here after their first booking.
          </p>
        ) : (
          <table className="w-full text-left text-body-md">
            <thead className="text-label-sm text-on-surface-variant border-b border-border-subtle">
              <tr>
                <th className="p-3">Client</th>
                <th className="p-3">Visits</th>
                <th className="p-3">Spent</th>
                <th className="p-3">Last visit</th>
                <th className="p-3">Next</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.key} className="border-b last:border-b-0 border-border-subtle">
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => setOpen(c)}
                      className="text-on-surface font-semibold hover:text-primary text-left"
                    >
                      {c.name}
                    </button>
                    <div className="text-label-sm text-text-muted">{c.email ?? c.phone ?? ""}</div>
                  </td>
                  <td className="p-3">
                    {c.visits}
                    {c.no_shows > 0 && (
                      <span className="text-error text-label-sm"> · {c.no_shows} no-show</span>
                    )}
                  </td>
                  <td className="p-3">{money(c.total_spent_cents)}</td>
                  <td className="p-3">
                    {day(c.last_visit)}
                    {c.lapsed && (
                      <span className="ml-2 text-[11px] uppercase border border-error text-error rounded px-1.5 py-0.5">
                        Lapsed
                      </span>
                    )}
                  </td>
                  <td className="p-3">{day(c.next_visit)}</td>
                  <td className="p-3">
                    <RecallButtons client={c} shopName={shopName} bookUrl={bookUrl} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl bg-surface max-h-[85vh] overflow-y-auto">
          {open && (
            <ClientDetail shopId={shopId} client={open} shopName={shopName} bookUrl={bookUrl} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecallButtons({
  client,
  shopName,
  bookUrl,
}: {
  client: ClientSummary;
  shopName: string;
  bookUrl: string;
}) {
  const msg = recallMessage(client.name, shopName, bookUrl);
  return (
    <div className="flex gap-2 justify-end">
      {client.email && (
        <a
          className="text-label-sm border border-border-subtle rounded px-2 py-1 hover:border-primary hover:text-primary"
          href={`mailto:${client.email}?subject=${encodeURIComponent(`We miss you at ${shopName}`)}&body=${encodeURIComponent(msg)}`}
        >
          Email
        </a>
      )}
      {client.phone && (
        <a
          className="text-label-sm border border-border-subtle rounded px-2 py-1 hover:border-primary hover:text-primary"
          href={`sms:${client.phone}?&body=${encodeURIComponent(msg)}`}
        >
          Text
        </a>
      )}
    </div>
  );
}

function ClientDetail({
  shopId,
  client,
  shopName,
  bookUrl,
}: {
  shopId: string;
  client: ClientSummary;
  shopName: string;
  bookUrl: string;
}) {
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getClientDetail);
  const add = useServerFn(addClientNote);
  const del = useServerFn(deleteClientNote);
  const key = ["client-detail", shopId, client.key];
  const q = useQuery({
    queryKey: key,
    queryFn: () => fetchDetail({
        data: {
          shopId,
          customerId: client.customer_id,
          walkInPhone: client.walk_in ? client.phone : null,
        },
      }),
  });
  const [note, setNote] = useState("");
  const addM = useMutation({
    mutationFn: () => add({ data: { shopId, customerId: client.customer_id, body: note } }),
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: key });
      toast.success("Note saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (noteId: string) => del({ data: { noteId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-on-surface">{client.name}</DialogTitle>
      </DialogHeader>
      <div className="text-body-md text-on-surface-variant flex flex-col gap-1">
        {client.email && <span>{client.email}</span>}
        {client.phone && <span>{client.phone}</span>}
        <span>
          Client since {day(client.first_visit)} · {client.visits} visits ·{" "}
          {money(client.total_spent_cents)} spent
        </span>
      </div>
      <RecallButtons client={client} shopName={shopName} bookUrl={bookUrl} />

      {client.walk_in ? (
        <p className="text-label-sm text-text-muted">
          Walk-in client (signed in at the front desk). Private notes are available for clients
          with an account.
        </p>
      ) : (
      <section className="flex flex-col gap-2">
        <h3 className="font-label-md text-on-surface font-semibold">Private notes</h3>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          placeholder="Preferences, formulas, allergies… (only your shop sees these)"
          className="bg-surface-container border border-border-subtle rounded p-3 text-on-surface min-h-[80px] focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          disabled={!note.trim() || addM.isPending}
          onClick={() => addM.mutate()}
          className="self-start bg-primary text-on-primary rounded-lg px-4 py-2 font-semibold disabled:opacity-50"
        >
          Add note
        </button>
        {(q.data?.notes ?? []).map((n) => (
          <div
            key={n.id}
            className="border border-border-subtle rounded p-3 flex justify-between gap-3"
          >
            <div>
              <p className="text-on-surface whitespace-pre-wrap">{n.body}</p>
              <p className="text-label-sm text-text-muted">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => delM.mutate(n.id)}
              className="text-label-sm text-error self-start"
            >
              Delete
            </button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-label-md text-on-surface font-semibold">Appointment history</h3>
        {q.isPending ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : (
          (q.data?.bookings ?? []).map((b) => (
            <div
              key={b.id}
              className="border border-border-subtle rounded p-3 flex justify-between gap-3 text-body-md"
            >
              <div>
                <p className="text-on-surface">
                  {b.service ?? "Service"}
                  {b.provider && ` · ${b.provider}`}
                </p>
                <p className="text-label-sm text-text-muted">
                  {new Date(b.starts_at).toLocaleString()}
                </p>
                {b.notes && <p className="text-label-sm text-on-surface-variant">{b.notes}</p>}
              </div>
              <div className="text-right">
                <p className="text-on-surface">{money(b.price_cents)}</p>
                <p className="text-label-sm capitalize text-on-surface-variant">
                  {b.status.replace("_", " ")}
                </p>
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="font-headline-md text-headline-md text-on-surface">{value}</p>
    </div>
  );
}
