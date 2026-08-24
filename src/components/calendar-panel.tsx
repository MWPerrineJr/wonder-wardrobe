import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  completeCalendarConnect,
  disconnectCalendar,
  getCalendarStatus,
  startCalendarConnect,
} from "@/lib/calendar.functions";

const CONNECTOR_ID = "google_calendar";

function waitForOAuthCompletion(popup: Window) {
  return new Promise<string | null>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== CONNECTOR_ID ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        resolve(typeof event.data?.code === "string" ? event.data.code : null);
        return;
      }
      popup.close();
      reject(new Error("Google did not finish the connection."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("The Google window closed before the connection finished."));
    }, 500);
  });
}

/**
 * Lets a provider connect their own Google Calendar so bookings are mirrored
 * there and their personal busy time blocks public booking slots.
 */
export function CalendarPanel() {
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getCalendarStatus);
  const start = useServerFn(startCalendarConnect);
  const complete = useServerFn(completeCalendarConnect);
  const disconnect = useServerFn(disconnectCalendar);

  const status = useQuery({
    queryKey: ["calendar", "status"],
    queryFn: () => fetchStatus(),
  });

  const connect = useMutation({
    mutationFn: async () => {
      const popup = window.open("", "google-calendar-oauth", "width=600,height=720");
      if (!popup) throw new Error("Popup blocked. Allow popups and try again.");
      let code: string | null;
      try {
        const { authorizationUrl } = await start();
        const completion = waitForOAuthCompletion(popup);
        popup.location.href = authorizationUrl;
        code = await completion;
      } catch (error) {
        popup.close();
        throw error;
      }
      if (code) await complete({ data: { code } });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calendar", "status"] });
      toast.success("Google Calendar connected");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calendar", "status"] });
      toast.success("Google Calendar disconnected");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = status.data;

  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-6 flex flex-col gap-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="font-title-lg text-title-lg text-on-surface">Google Calendar</h2>
        <p className="text-on-surface-variant text-body-md">
          Connect your own Google account. New bookings appear on your calendar, cancellations are
          removed, and anything already busy on your calendar stops clients booking over it. This is
          separate from signing in with Google.
        </p>
      </div>

      {status.isLoading && <p className="text-on-surface-variant text-body-sm">Checking…</p>}

      {data && !data.configured && (
        <div className="rounded-lg border border-border-subtle bg-surface-container p-4 text-body-sm text-on-surface-variant">
          Calendar sync needs a one-time Google setup for this app before providers can connect.
        </div>
      )}

      {data?.configured && !data.connected && (
        <button
          type="button"
          onClick={() => connect.mutate()}
          disabled={connect.isPending}
          className="self-start bg-primary text-on-primary rounded-lg px-5 py-2.5 font-label-md font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {connect.isPending ? "Connecting…" : "Connect Google Calendar"}
        </button>
      )}

      {data?.configured && data.connected && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-body-md text-on-surface">
            <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
            Connected{data.accountEmail ? ` as ${data.accountEmail}` : ""}
          </div>
          <p className="text-body-sm text-on-surface-variant">
            Last synced:{" "}
            {data.lastSyncedAt ? new Date(data.lastSyncedAt).toLocaleString() : "not yet"}
          </p>
          <button
            type="button"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="self-start bg-surface border border-border-subtle text-on-surface rounded-lg px-4 py-2 font-label-md hover:border-primary transition-colors disabled:opacity-60"
          >
            {remove.isPending ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      )}

      {status.isError && (
        <p className="text-body-sm text-error">Could not load calendar status.</p>
      )}
    </div>
  );
}
