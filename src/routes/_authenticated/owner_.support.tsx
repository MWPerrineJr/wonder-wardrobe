import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AccountNav } from "@/components/account-nav";
import { SUPPORT_EMAIL } from "@/lib/support";
import {
  actOnSupportThread,
  getSupportInboxStatus,
  getSupportThread,
  listSupportThreads,
  replySupportThread,
} from "@/lib/support-inbox.functions";

type Filter = "all" | "unread" | "archived";

const statusQuery = queryOptions({
  queryKey: ["support-inbox", "status"],
  queryFn: () => getSupportInboxStatus(),
});

const threadsQuery = (filter: Filter, search: string) =>
  queryOptions({
    queryKey: ["support-inbox", "threads", filter, search],
    queryFn: () => listSupportThreads({ data: { filter, search: search || null } }),
  });

export const Route = createFileRoute("/_authenticated/owner_/support")({
  head: () => ({
    meta: [
      { title: "Support Inbox — Shop Owner Dashboard — The Standing Chair" },
      {
        name: "description",
        content:
          "Read and answer customer support email for The Standing Chair without leaving the owner dashboard.",
      },
      { property: "og:title", content: "Support Inbox — The Standing Chair" },
      {
        property: "og:description",
        content: "A built-in support desk for reading and replying to customer email.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(statusQuery),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-8 text-on-surface bg-background">
      <div>
        <h1 className="font-headline-md text-headline-md mb-2">Something went wrong</h1>
        <p className="text-on-surface-variant">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-on-surface">Not found.</div>,
  component: SupportInboxPage,
});

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

function formatDate(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function displayName(from: string) {
  const match = /^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/.exec(from);
  if (match) return match[1].trim() || match[2];
  return from || "Unknown sender";
}

function SupportInboxPage() {
  const { data: status } = useSuspenseQuery(statusQuery);
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<Filter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const connected = status.connected;

  const threads = useQuery({ ...threadsQuery(filter, search), enabled: connected });
  const thread = useQuery({
    queryKey: ["support-inbox", "thread", selectedId],
    queryFn: () => getSupportThread({ data: { threadId: selectedId! } }),
    enabled: Boolean(connected && selectedId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["support-inbox", "threads"] });
    if (selectedId) {
      queryClient.invalidateQueries({ queryKey: ["support-inbox", "thread", selectedId] });
    }
  };

  const replyMutation = useMutation({
    mutationFn: (body: string) => replySupportThread({ data: { threadId: selectedId!, body } }),
    onSuccess: () => {
      setReply("");
      toast.success("Reply sent");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const actionMutation = useMutation({
    mutationFn: (vars: { action: "read" | "unread" | "archive" | "unarchive" | "trash" }) =>
      actOnSupportThread({ data: { threadId: selectedId!, action: vars.action } }),
    onSuccess: (_res, vars) => {
      toast.success(
        vars.action === "trash"
          ? "Moved to trash"
          : vars.action === "archive"
            ? "Archived"
            : vars.action === "unarchive"
              ? "Moved back to inbox"
              : vars.action === "read"
                ? "Marked as read"
                : "Marked as unread",
      );
      if (vars.action === "trash") setSelectedId(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const notConnected = !connected || threads.data?.error === "not_connected";
  const scopeError =
    threads.data?.error && threads.data.error !== "not_connected" ? threads.data.error : null;

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen">
      <header className="border-b border-border-subtle bg-surface">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-headline-md text-headline-md text-primary tracking-tight">
              The Standing Chair
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-label-md">
              <Link to="/owner" className="text-on-surface-variant hover:text-on-surface">
                Dashboard
              </Link>
              <Link to="/owner/analytics" className="text-on-surface-variant hover:text-on-surface">
                Analytics
              </Link>
              <Link to="/owner/feedback" className="text-on-surface-variant hover:text-on-surface">
                Feedback
              </Link>
              <Link to="/owner/support" className="text-primary font-semibold">
                Support
              </Link>
              <Link to="/owner/contact" className="text-on-surface-variant hover:text-on-surface">
                Contact
              </Link>
            </nav>
          </div>
          <AccountNav />
        </div>
      </header>

      <main className="max-w-container-max mx-auto p-margin-mobile md:p-margin-desktop flex flex-col gap-6">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Support inbox
          </h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            {connected
              ? `Connected mailbox: ${status.email}`
              : `Messages sent to ${SUPPORT_EMAIL} will appear here once the mailbox is connected.`}
          </p>
        </div>

        {notConnected ? (
          <div className="bg-surface border border-border-subtle rounded-2xl p-8 flex flex-col gap-4 shadow-sm max-w-2xl">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="mark_email_unread" className="text-[26px] text-primary" />
              </div>
              <div>
                <h2 className="font-headline-md text-[20px] text-on-surface">
                  Connect your support mailbox
                </h2>
                <p className="text-on-surface-variant text-body-md">
                  Sign in with the Google account that owns {SUPPORT_EMAIL} and approve read, send,
                  and modify access. Ask in chat to open the Gmail connect card.
                </p>
              </div>
            </div>
            <ul className="text-on-surface-variant text-body-md list-disc pl-5 flex flex-col gap-1">
              <li>Nothing is stored in the app — Gmail stays the source of truth.</li>
              <li>Only your owner account can read this inbox.</li>
            </ul>
          </div>
        ) : (
          <>
            {scopeError && (
              <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-body-md text-on-surface">
                {scopeError}
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
              <div className="flex gap-2">
                {(["all", "unread", "archived"] as Filter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setFilter(f);
                      setSelectedId(null);
                    }}
                    className={`px-4 py-2 rounded-lg text-label-md capitalize border transition-colors ${
                      filter === f
                        ? "bg-primary text-on-primary border-primary font-bold"
                        : "bg-surface text-on-surface-variant border-border-subtle hover:text-on-surface"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSearch(searchInput);
                  setSelectedId(null);
                }}
              >
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search mail"
                  className="px-4 py-2 rounded-lg bg-surface border border-border-subtle text-on-surface placeholder:text-on-surface-variant/70 min-w-[200px]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-surface-container border border-border-subtle text-on-surface text-label-md hover:bg-surface"
                >
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => threads.refetch()}
                  className="px-3 py-2 rounded-lg bg-surface-container border border-border-subtle text-on-surface"
                  aria-label="Refresh"
                >
                  <Icon name="refresh" className="text-[18px]" />
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-6">
              <div className="bg-surface border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
                {threads.isLoading ? (
                  <p className="p-6 text-on-surface-variant">Loading messages…</p>
                ) : (threads.data?.threads.length ?? 0) === 0 ? (
                  <p className="p-6 text-on-surface-variant">No messages here.</p>
                ) : (
                  <ul className="divide-y divide-border-subtle max-h-[70vh] overflow-y-auto">
                    {threads.data!.threads.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(t.id);
                            setReply("");
                          }}
                          className={`w-full text-left px-5 py-4 flex flex-col gap-1 transition-colors ${
                            selectedId === t.id
                              ? "bg-surface-container"
                              : "hover:bg-surface-container/60"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span
                              className={`truncate ${t.unread ? "font-bold text-on-surface" : "text-on-surface"}`}
                            >
                              {displayName(t.from)}
                            </span>
                            <span className="text-label-sm text-on-surface-variant shrink-0">
                              {formatDate(t.date)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {t.unread && (
                              <span
                                className="h-2 w-2 rounded-full bg-primary shrink-0"
                                aria-hidden
                              />
                            )}
                            <span className="truncate text-on-surface text-body-md">
                              {t.subject}
                            </span>
                          </div>
                          <span className="truncate text-on-surface-variant text-body-sm">
                            {t.snippet}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-surface border border-border-subtle rounded-2xl p-6 shadow-sm min-h-[300px]">
                {!selectedId ? (
                  <p className="text-on-surface-variant">Select a conversation to read it.</p>
                ) : thread.isLoading ? (
                  <p className="text-on-surface-variant">Loading conversation…</p>
                ) : thread.isError ? (
                  <p className="text-on-surface-variant">{(thread.error as Error).message}</p>
                ) : thread.data ? (
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <h2 className="font-headline-md text-[20px] text-on-surface">
                        {thread.data.subject}
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            actionMutation.mutate({
                              action: thread.data!.unread ? "read" : "unread",
                            })
                          }
                          className="px-3 py-2 rounded-lg border border-border-subtle text-label-sm text-on-surface hover:bg-surface-container"
                        >
                          {thread.data.unread ? "Mark read" : "Mark unread"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            actionMutation.mutate({
                              action: thread.data!.inInbox ? "archive" : "unarchive",
                            })
                          }
                          className="px-3 py-2 rounded-lg border border-border-subtle text-label-sm text-on-surface hover:bg-surface-container"
                        >
                          {thread.data.inInbox ? "Archive" : "Move to inbox"}
                        </button>
                        <button
                          type="button"
                          onClick={() => actionMutation.mutate({ action: "trash" })}
                          className="px-3 py-2 rounded-lg border border-error/40 text-label-sm text-error hover:bg-error/10"
                        >
                          Trash
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 max-h-[46vh] overflow-y-auto">
                      {thread.data.messages.map((m) => (
                        <article
                          key={m.id}
                          className={`rounded-xl border p-4 ${
                            m.outgoing
                              ? "border-primary/30 bg-primary/5"
                              : "border-border-subtle bg-surface-container"
                          }`}
                        >
                          <header className="flex items-center justify-between gap-3 mb-2">
                            <span className="text-label-md text-on-surface font-semibold">
                              {displayName(m.from)}
                            </span>
                            <span className="text-label-sm text-on-surface-variant">
                              {m.date ? new Date(m.date).toLocaleString() : ""}
                            </span>
                          </header>
                          <p className="text-body-md text-on-surface whitespace-pre-wrap break-words">
                            {m.text ||
                              (m.html ? m.html.replace(/<[^>]+>/g, " ").trim() : "(empty message)")}
                          </p>
                        </article>
                      ))}
                    </div>

                    <form
                      className="flex flex-col gap-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (reply.trim()) replyMutation.mutate(reply.trim());
                      }}
                    >
                      <label className="text-label-sm text-on-surface-variant" htmlFor="reply">
                        Reply to {displayName(thread.data.replyTo)}
                      </label>
                      <textarea
                        id="reply"
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        rows={5}
                        placeholder="Write your reply…"
                        className="w-full rounded-xl border border-border-subtle bg-surface-container p-4 text-on-surface placeholder:text-on-surface-variant/70"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={!reply.trim() || replyMutation.isPending}
                          className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-lg font-bold text-label-md disabled:opacity-50"
                        >
                          <Icon name="send" className="text-[18px]" />
                          {replyMutation.isPending ? "Sending…" : "Send reply"}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
