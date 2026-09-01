import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Per-provider Google Calendar connection. Every handler loads the server-only
 * helpers dynamically so no gateway secret can reach the browser bundle.
 */

export type CalendarStatus = {
  /** false when the workspace Google OAuth client has not been linked yet */
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
  lastSyncedAt: string | null;
};

export const getCalendarStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CalendarStatus> => {
    const { calendarClientApiKey, CALENDAR_CONNECTOR_ID } =
      await import("@/server/googleCalendar.server");
    const configured = !!calendarClientApiKey();
    const { getConnectionRowForUser } = await import("@/server/appUserConnections.server");
    const row = await getConnectionRowForUser(context.userId, CALENDAR_CONNECTOR_ID);
    return {
      configured,
      connected: !!row,
      accountEmail: row?.account_email ?? null,
      lastSyncedAt: row?.last_synced_at ?? null,
    };
  });

export const startCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ authorizationUrl: string }> => {
    const {
      calendarClientApiKey,
      CALENDAR_CONNECTOR_ID,
      GATEWAY_BASE_URL,
      GOOGLE_CALENDAR_SCOPES,
    } = await import("@/server/googleCalendar.server");
    const clientAPIKey = calendarClientApiKey();
    if (!clientAPIKey) {
      throw new Error("Google Calendar is not set up for this project yet.");
    }

    const request = getRequest();
    if (!request) throw new Error("Connecting must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost =
      url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL(
      "/oauth/google-calendar/return",
      sandboxHost ? `https://${sandboxHost}` : url.origin,
    ).toString();

    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const existing = await getConnectionKeyForUser(context.userId, CALENDAR_CONNECTOR_ID);

    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CALENDAR_CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey,
      returnUrl,
      connectionAPIKey: existing ?? undefined,
      credentialsConfiguration: { scopes: GOOGLE_CALENDAR_SCOPES },
    });
    return { authorizationUrl };
  });

export const completeCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { CALENDAR_CONNECTOR_ID, GATEWAY_BASE_URL, fetchAccountEmail } =
      await import("@/server/googleCalendar.server");
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (connectorId !== CALENDAR_CONNECTOR_ID) {
      throw new Error("Sign-in returned the wrong calendar connector");
    }
    const email = await fetchAccountEmail(connectionAPIKey);
    const { saveConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey, email);
    return { ok: true };
  });

export const disconnectCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { CALENDAR_CONNECTOR_ID, GATEWAY_BASE_URL } =
      await import("@/server/googleCalendar.server");
    const { getConnectionKeyForUser, deleteConnectionForUser } =
      await import("@/server/appUserConnections.server");
    const key = await getConnectionKeyForUser(context.userId, CALENDAR_CONNECTOR_ID);
    if (key) {
      const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
      try {
        await disconnectAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: CALENDAR_CONNECTOR_ID,
        });
      } catch (e) {
        console.error("[gcal] gateway disconnect failed", e);
      }
    }
    await deleteConnectionForUser(context.userId, CALENDAR_CONNECTOR_ID);
    return { ok: true };
  });
