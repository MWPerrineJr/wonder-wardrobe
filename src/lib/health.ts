export type HealthStatus = "ok" | "degraded";

export type HealthReport = {
  status: HealthStatus;
  service: "the-standing-chair";
  time: string;
};

export type ReadyReport = {
  status: "ok" | "not_ready";
  service: "the-standing-chair";
  time: string;
  payments: "ok" | "incomplete";
  issues: string[];
};

export function livenessReport(now = new Date()): HealthReport {
  return {
    status: "ok",
    service: "the-standing-chair",
    time: now.toISOString(),
  };
}

export function readinessReport(
  paymentsOk: boolean,
  issues: string[],
  now = new Date(),
): ReadyReport {
  return {
    status: paymentsOk ? "ok" : "not_ready",
    service: "the-standing-chair",
    time: now.toISOString(),
    payments: paymentsOk ? "ok" : "incomplete",
    issues,
  };
}

export function healthResponse(body: object, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}
