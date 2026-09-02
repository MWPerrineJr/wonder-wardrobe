/**
 * Gmail support-inbox helpers.
 *
 * Every call goes through the Lovable connector gateway using the workspace
 * Gmail connection (the owner's support mailbox). Server-only: the gateway
 * credentials must never reach the browser.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const BATCH_GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/batch/gmail/v1";

export class SupportInboxNotConnectedError extends Error {
  constructor() {
    super("The support mailbox is not connected yet.");
    this.name = "SupportInboxNotConnectedError";
  }
}

export class SupportInboxScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupportInboxScopeError";
  }
}

function credentials() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_MAIL_API_KEY"];
  if (!lovableKey || !connectionKey) throw new SupportInboxNotConnectedError();
  return { lovableKey, connectionKey };
}

export function isSupportInboxConfigured(): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env["GOOGLE_MAIL_API_KEY"]);
}

function gatewayHeaders(extra: Record<string, string> = {}) {
  const { lovableKey, connectionKey } = credentials();
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
    ...extra,
  };
}

async function gmailFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | string[]> } = {},
): Promise<T> {
  const url = new URL(`${GATEWAY_URL}${path}`);
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
    else url.searchParams.set(key, value);
  }

  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: gatewayHeaders(
      init.body ? { "Content-Type": "application/json" } : {},
    ),
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[support-inbox] gmail request failed [${res.status}] ${path}: ${text}`);
    if (res.status === 403 && /insufficient authentication scopes/i.test(text)) {
      throw new SupportInboxScopeError(
        "The connected Google account is missing a Gmail permission this action needs. Reconnect the mailbox and grant read, send, and modify access.",
      );
    }
    if (res.status === 401) throw new SupportInboxNotConnectedError();
    throw new Error(`Gmail request failed [${res.status}]: ${text}`);
  }

  return (await res.json()) as T;
}

type GmailHeader = { name: string; value: string };
type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
};
type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
};
type GmailThread = { id: string; snippet?: string; messages?: GmailMessage[] };

export function headerValue(msg: GmailMessage | undefined, name: string): string {
  const headers = msg?.payload?.headers ?? [];
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

/** Pull the best readable body out of a Gmail message payload. */
export function extractBody(msg: GmailMessage): { text: string; html: string | null } {
  let text = "";
  let html: string | null = null;

  const walk = (part?: GmailPart) => {
    if (!part) return;
    const data = part.body?.data;
    if (data && !part.filename) {
      if (part.mimeType === "text/plain" && !text) text = decodeBase64Url(data);
      else if (part.mimeType === "text/html" && !html) html = decodeBase64Url(data);
    }
    part.parts?.forEach(walk);
  };
  walk(msg.payload);

  if (!text && !html && msg.snippet) text = msg.snippet;
  return { text, html };
}

/**
 * Hydrate many threads with one Gmail multipart batch request (max 50 parts).
 */
async function batchGetThreadMetadata(threadIds: string[]): Promise<GmailThread[]> {
  if (threadIds.length === 0) return [];
  const boundary = `batch_${Math.random().toString(36).slice(2)}`;
  const metaQuery =
    "format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date";

  const body =
    threadIds
      .map(
        (id, i) =>
          `--${boundary}\r\nContent-Type: application/http\r\nContent-ID: <item-${i}>\r\n\r\n` +
          `GET /gmail/v1/users/me/threads/${id}?${metaQuery}\r\n\r\n`,
      )
      .join("") + `--${boundary}--\r\n`;

  const res = await fetch(BATCH_GATEWAY_URL, {
    method: "POST",
    headers: gatewayHeaders({ "Content-Type": `multipart/mixed; boundary=${boundary}` }),
    body,
  });

  const raw = await res.text();
  if (!res.ok) {
    console.error(`[support-inbox] gmail batch failed [${res.status}]: ${raw}`);
    if (res.status === 403 && /insufficient authentication scopes/i.test(raw)) {
      throw new SupportInboxScopeError(
        "The connected Google account is missing the Gmail read permission.",
      );
    }
    if (res.status === 401) throw new SupportInboxNotConnectedError();
    throw new Error(`Gmail batch request failed [${res.status}]: ${raw}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const match = /boundary=("?)([^";]+)\1/i.exec(contentType);
  if (!contentType.includes("multipart/mixed") || !match) {
    throw new Error(`Unexpected Gmail batch response content type: ${contentType}`);
  }
  const responseBoundary = match[2];

  const out: GmailThread[] = [];
  const parts = raw.split(`--${responseBoundary}`);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === "--") continue;
    const statusLine = /HTTP\/\d(?:\.\d)?\s+(\d{3})/.exec(trimmed);
    if (!statusLine) continue;
    const status = Number(statusLine[1]);
    const jsonStart = trimmed.indexOf("{", statusLine.index);
    const jsonEnd = trimmed.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) continue;
    const payload = trimmed.slice(jsonStart, jsonEnd + 1);
    if (status < 200 || status >= 300) {
      console.error(`[support-inbox] gmail batch part failed [${status}]: ${payload}`);
      continue;
    }
    try {
      out.push(JSON.parse(payload) as GmailThread);
    } catch (err) {
      console.error("[support-inbox] could not parse a Gmail batch part", err);
    }
  }
  return out;
}

export type SupportThreadSummary = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string | null;
  unread: boolean;
  messageCount: number;
  inInbox: boolean;
};

export type SupportInboxFilter = "all" | "unread" | "archived";

function buildQuery(filter: SupportInboxFilter, search: string | null): string {
  const parts: string[] = ["-in:chats", "-in:trash"];
  if (filter === "unread") parts.push("is:unread", "in:inbox");
  else if (filter === "archived") parts.push("-in:inbox");
  else parts.push("in:inbox");
  if (search && search.trim()) parts.push(search.trim());
  return parts.join(" ");
}

export async function listThreads(options: {
  filter: SupportInboxFilter;
  search: string | null;
  limit: number;
}): Promise<SupportThreadSummary[]> {
  const list = await gmailFetch<{ threads?: { id: string }[] }>("/users/me/threads", {
    query: {
      maxResults: String(Math.min(options.limit, 50)),
      q: buildQuery(options.filter, options.search),
    },
  });

  const ids = (list.threads ?? []).map((t) => t.id);
  const threads = await batchGetThreadMetadata(ids);
  const byId = new Map(threads.map((t) => [t.id, t]));

  return ids
    .map((id) => byId.get(id))
    .filter((t): t is GmailThread => Boolean(t))
    .map((thread) => {
      const messages = thread.messages ?? [];
      const last = messages[messages.length - 1];
      const first = messages[0];
      const labels = new Set(messages.flatMap((m) => m.labelIds ?? []));
      const internal = last?.internalDate ? Number(last.internalDate) : null;
      return {
        id: thread.id,
        from: headerValue(last, "From") || headerValue(first, "From"),
        subject: headerValue(first, "Subject") || "(no subject)",
        snippet: thread.snippet ?? last?.snippet ?? "",
        date: internal ? new Date(internal).toISOString() : null,
        unread: labels.has("UNREAD"),
        messageCount: messages.length,
        inInbox: labels.has("INBOX"),
      };
    });
}

export type SupportMessage = {
  id: string;
  from: string;
  to: string;
  date: string | null;
  text: string;
  html: string | null;
  outgoing: boolean;
};

export type SupportThreadDetail = {
  id: string;
  subject: string;
  unread: boolean;
  inInbox: boolean;
  messages: SupportMessage[];
  replyTo: string;
  lastMessageId: string | null;
  references: string;
};

export async function getThread(threadId: string): Promise<SupportThreadDetail> {
  const thread = await gmailFetch<GmailThread>(`/users/me/threads/${threadId}`, {
    query: { format: "full" },
  });
  const messages = thread.messages ?? [];
  const first = messages[0];
  const last = messages[messages.length - 1];
  const labels = new Set(messages.flatMap((m) => m.labelIds ?? []));

  return {
    id: thread.id,
    subject: headerValue(first, "Subject") || "(no subject)",
    unread: labels.has("UNREAD"),
    inInbox: labels.has("INBOX"),
    messages: messages.map((m) => {
      const body = extractBody(m);
      const internal = m.internalDate ? Number(m.internalDate) : null;
      return {
        id: m.id,
        from: headerValue(m, "From"),
        to: headerValue(m, "To"),
        date: internal ? new Date(internal).toISOString() : null,
        text: body.text,
        html: body.html,
        outgoing: (m.labelIds ?? []).includes("SENT"),
      };
    }),
    replyTo: headerValue(last, "Reply-To") || headerValue(last, "From"),
    lastMessageId: headerValue(last, "Message-ID") || null,
    references: [headerValue(last, "References"), headerValue(last, "Message-ID")]
      .filter(Boolean)
      .join(" ")
      .trim(),
  };
}

const b64 = (s: string) =>
  Buffer.from(s, "utf8").toString("base64");
const mimeHeader = (v: string) =>
  /^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`;

export async function sendReply(input: {
  threadId: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo: string | null;
  references: string | null;
}): Promise<{ id: string }> {
  const lines = [
    `To: ${input.to}`,
    `Subject: ${mimeHeader(input.subject.startsWith("Re:") ? input.subject : `Re: ${input.subject}`)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ];
  if (input.inReplyTo) lines.push(`In-Reply-To: ${input.inReplyTo}`);
  if (input.references) lines.push(`References: ${input.references}`);
  lines.push("", input.body);

  const raw = b64(lines.join("\r\n"))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return gmailFetch<{ id: string }>("/users/me/messages/send", {
    method: "POST",
    body: { raw, threadId: input.threadId },
  });
}

export type SupportThreadAction = "read" | "unread" | "archive" | "unarchive" | "trash";

export async function applyThreadAction(threadId: string, action: SupportThreadAction) {
  if (action === "trash") {
    await gmailFetch(`/users/me/threads/${threadId}/trash`, { method: "POST", body: {} });
    return;
  }
  const body =
    action === "read"
      ? { removeLabelIds: ["UNREAD"] }
      : action === "unread"
        ? { addLabelIds: ["UNREAD"] }
        : action === "archive"
          ? { removeLabelIds: ["INBOX"] }
          : { addLabelIds: ["INBOX"] };
  await gmailFetch(`/users/me/threads/${threadId}/modify`, { method: "POST", body });
}

export async function getMailboxProfile(): Promise<{ emailAddress: string; total: number }> {
  const profile = await gmailFetch<{ emailAddress: string; messagesTotal?: number }>(
    "/users/me/profile",
  );
  return { emailAddress: profile.emailAddress, total: profile.messagesTotal ?? 0 };
}
