import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/oauth/google-calendar/return")({
  head: () => ({
    meta: [
      { title: "Finishing Google Calendar connection — The Standing Chair" },
      {
        name: "description",
        content: "Completing the Google Calendar connection for your provider account.",
      },
    ],
  }),
  component: OAuthReturn,
});

const CONNECTOR_ID = "google_calendar";

function OAuthReturn() {
  const [message, setMessage] = useState("Finishing connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      code?: string,
    ) => {
      window.opener?.postMessage(
        { type, connectorId: CONNECTOR_ID, code: code ?? null },
        window.location.origin,
      );
      window.close();
    };

    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "Google did not complete the connection.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        notify("appUserConnectorOAuthComplete");
        return;
      }
      setMessage("Google finished without an exchange code.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    notify("appUserConnectorOAuthComplete", code);
  }, []);

  return (
    <div className="min-h-screen bg-background text-on-background flex items-center justify-center p-8">
      <p className="text-body-md text-on-surface-variant">{message}</p>
    </div>
  );
}
