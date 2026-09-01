import "./lib/error-capture";

import { inspectPaymentsConfig, logPaymentsConfigOnce } from "./lib/payments-env";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { healthResponse, livenessReport, readinessReport } from "./lib/health";
import { logEvent, redactUnknown } from "./lib/log";
import { applyRequestIdHeader, readRequestId, requestWithId } from "./lib/request-id";
import { applySecurityHeaders } from "./lib/security-headers";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

function finalize(response: Response, request: Request, requestId: string): Response {
  return applySecurityHeaders(applyRequestIdHeader(response, requestId), request);
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
  requestId: string,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const error = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  logEvent("error", {
    component: "ssr",
    event: "unhandled",
    request_id: requestId,
    error: redactUnknown(error),
  });
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const requestId = readRequestId(request);
    const tagged = requestWithId(request, requestId);
    const path = new URL(request.url).pathname;

    if (path === "/api/public/health") {
      return finalize(healthResponse(livenessReport(), 200), tagged, requestId);
    }

    logPaymentsConfigOnce();
    const diagnostic = inspectPaymentsConfig();
    if (path === "/api/public/ready") {
      const body = readinessReport(diagnostic.ok, diagnostic.issues);
      return finalize(healthResponse(body, diagnostic.ok ? 200 : 503), tagged, requestId);
    }

    if (!diagnostic.ok) {
      logEvent("error", {
        component: "payments",
        event: "config_incomplete",
        request_id: requestId,
        error: diagnostic.issues.join("; "),
      });
      return finalize(
        new Response(diagnostic.issues.join("\n"), {
          status: 503,
          headers: { "content-type": "text/plain; charset=utf-8" },
        }),
        tagged,
        requestId,
      );
    }
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(tagged, env, ctx);
      return finalize(
        await normalizeCatastrophicSsrResponse(response, requestId),
        tagged,
        requestId,
      );
    } catch (error) {
      logEvent("error", {
        component: "ssr",
        event: "fetch_failed",
        request_id: requestId,
        error: redactUnknown(error),
      });
      return finalize(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        tagged,
        requestId,
      );
    }
  },
};
