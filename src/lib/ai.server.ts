import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

function createRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }
      const response = await fetch(input, { ...init, headers });
      const next = response.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim();
      if (!runId && next) runId = next;
      return response;
    },
    getRunId: () => runId,
  };
}

/** Server-only Lovable AI Gateway provider. Read LOVABLE_API_KEY inside handlers. */
export function createGateway(lovableApiKey: string, initialRunId?: string) {
  const runIdFetch = createRunIdFetch(initialRunId);
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    supportsStructuredOutputs: true,
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: runIdFetch.fetch as typeof fetch,
  });
  return Object.assign(provider, { getRunId: runIdFetch.getRunId });
}

export const FEEDBACK_MODEL = "openai/gpt-5.6-sol";

export type GatewayFailure = { kind: "pause" | "backoff" | "fatal"; reason: string };

/**
 * Map an AI SDK / gateway error onto the circuit-breaker semantics the
 * background jobs use: 402/403 pause the job, 429/5xx back off, the rest are
 * per-item failures.
 */
export function classifyGatewayError(error: unknown): GatewayFailure {
  const status =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode?: number }).statusCode)
      : undefined;
  const message = error instanceof Error ? error.message : String(error);
  if (status === 402 || status === 403) return { kind: "pause", reason: `${status}: ${message}` };
  if (status === 429 || (status !== undefined && status >= 500))
    return { kind: "backoff", reason: `${status}: ${message}` };
  return { kind: "fatal", reason: message };
}
