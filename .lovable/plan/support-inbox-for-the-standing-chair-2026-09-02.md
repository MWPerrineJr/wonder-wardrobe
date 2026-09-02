# Support Inbox for The Standing Chair

Give you a support inbox inside the owner area so you can read and answer messages sent to `support@thestandingchair.com` without leaving the app.

## How it works

Your Google Workspace mailbox is connected once (by you, as the app owner). The app then reads and sends mail from that single inbox — it is your support desk, not a per-customer inbox. Only you (the owner account) can see it.

## What you get

A new page at `/owner/support`, linked from the owner dashboard header:

- **Thread list** — newest support emails first: sender, subject, snippet, date, unread badge.
- **Filters** — All / Unread / Archived, plus a search box using Gmail search.
- **Thread view** — full message body of the selected conversation.
- **Reply** — write a reply that goes out from the support address, threaded correctly so the customer sees it as a normal email response.
- **Actions** — mark read/unread, archive, move to trash.
- **Refresh** — pull the latest messages on demand.

## Step you need to take

I open a connect card for Gmail; you sign in with the Google account that owns `support@thestandingchair.com` and approve read, send, and modify access. Until that's done the page shows a "Connect your support mailbox" state instead of messages.

## Technical notes

- Connect the `google_mail` App connector (workspace-level, builder account) — this is the builder/owner mailbox pattern, not per-end-user OAuth. Scopes: `gmail.readonly`, `gmail.send`, `gmail.modify`.
- All Gmail calls go through the Lovable connector gateway from server functions only (`src/lib/support-inbox.functions.ts` + `support-inbox.server.ts`), reading `LOVABLE_API_KEY` and `GOOGLE_MAIL_API_KEY` from `process.env`. No credentials or gateway calls in browser code.
- List with `users/me/threads?q=...`, hydrate rows via one Gmail multipart batch request (`format=metadata`, max 50 parts per batch); fetch `format=full` only for the opened thread. Surface provider status + body on non-OK responses.
- Replies build an RFC 2822 message with `In-Reply-To`/`References` from the thread's last message, base64url-encoded, posted to `users/me/messages/send` with `threadId`.
- Every server function is gated by `requireSupabaseAuth` plus an owner-role check, so only your account can read the mailbox.
- Route lives under `src/routes/_authenticated/owner_.support.tsx` with its own `head()` metadata; header link added in `src/routes/_authenticated/owner.tsx`.
- On `403 insufficient authentication scopes`, prompt a reconnect with the missing scope rather than retrying.
- No database changes; nothing is stored locally — Gmail stays the source of truth.
