// Client-safe shapes for the AI business briefing shown on the analytics tab.

export type DriverTone = "positive" | "negative" | "watch";
export type ActionImpact = "high" | "medium" | "low";

export type InsightDriver = {
  metric: string;
  movement: string;
  cause: string;
  tone: DriverTone;
};

export type InsightAction = {
  title: string;
  detail: string;
  impact: ActionImpact;
  evidence: string;
};

export type AnalyticsBriefing = {
  headline: string;
  drivers: InsightDriver[];
  actions: InsightAction[];
  risks: string[];
};

export type AnalyticsInsightsResult =
  | { state: "locked" }
  | { state: "insufficient_data"; message: string }
  | {
      state: "ready";
      briefing: AnalyticsBriefing;
      generatedAt: string;
      rangeDays: number;
      stale: boolean;
      model: string | null;
    };

export const INSIGHTS_MIN_APPOINTMENTS = 3;

export const IMPACT_LABEL: Record<ActionImpact, string> = {
  high: "High impact",
  medium: "Medium impact",
  low: "Low impact",
};
