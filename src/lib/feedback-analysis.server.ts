import { streamText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";

import { createGateway, FEEDBACK_MODEL } from "./ai.server";

const SENTIMENTS = ["very_positive", "positive", "neutral", "negative", "very_negative"] as const;
const URGENCIES = ["low", "medium", "high"] as const;

const reviewSchema = z.object({
  sentiment_label: z.enum(SENTIMENTS),
  sentiment_score: z.number(),
  emotion: z.string(),
  urgency: z.enum(URGENCIES),
  summary: z.string(),
  explanation: z.string(),
  key_phrases: z.array(z.string()),
  recommended_response: z.string(),
});

export type ReviewAnalysis = z.infer<typeof reviewSchema>;

const REVIEW_SYSTEM = [
  "You analyze customer feedback for beauty and wellness businesses (hair, nails, waxing, makeup, massage, skincare, brows, spa).",
  "sentiment_score is between -1 and 1 with two decimals.",
  "emotion is a single lowercase word such as delighted, satisfied, frustrated, angry, disappointed.",
  "urgency is high only when the business risks losing the customer or there is a health, safety or legal issue.",
  "summary is one sentence of at most 25 words. explanation is one sentence.",
  "key_phrases holds 1 to 5 short phrases drawn from the feedback.",
  "recommended_response is a warm, specific 2 to 4 sentence reply the owner could send, with no placeholders.",
].join(" ");

function clampScore(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return Number(Math.max(-1, Math.min(1, v)).toFixed(2));
}

export async function analyzeReview(
  apiKey: string,
  input: { rating: number | null; source: string | null; message: string },
): Promise<ReviewAnalysis> {
  const gateway = createGateway(apiKey);
  const prompt = [
    `Rating: ${input.rating ?? "not given"} out of 5`,
    `Source: ${input.source ?? "unknown"}`,
    `Feedback: ${input.message}`,
  ].join("\n");

  // Streamed on the wire (consumed server-side) so a slow reasoning call is not
  // severed and re-billed by the hosting platform's idle-request timeout.
  const result = streamText({
    model: gateway(FEEDBACK_MODEL),
    system: REVIEW_SYSTEM,
    prompt,
    output: Output.object({ schema: reviewSchema }),
  });

  const parsed = await result.output;
  return {
    ...parsed,
    sentiment_score: clampScore(parsed.sentiment_score),
    emotion: parsed.emotion.slice(0, 30),
    key_phrases: parsed.key_phrases.slice(0, 5).map((p) => p.slice(0, 120)),
  };
}

const themeSchema = z.object({
  theme: z.string(),
  mentions: z.number(),
  evidence: z.array(z.string()),
});

const suggestionSchema = z.object({
  title: z.string(),
  detail: z.string(),
  impact: z.enum(["high", "medium", "low"]),
  evidence: z.array(z.string()),
});

const reportSchema = z.object({
  summary: z.string(),
  praise_themes: z.array(themeSchema),
  complaint_themes: z.array(themeSchema),
  suggestions: z.array(suggestionSchema),
});

export type ShopReport = z.infer<typeof reportSchema>;

const REPORT_SYSTEM = [
  "You write a short operations report for the owner of a beauty or wellness business from their customers' recent feedback.",
  "summary is 2 to 4 sentences describing the overall picture and any trend.",
  "praise_themes and complaint_themes each hold at most 4 items, ordered by how often they appear; mentions is the number of reviews touching that theme; evidence holds up to 2 short customer quotes.",
  "suggestions holds 1 to 5 concrete improvement actions the owner can act on this month, ordered by impact, each with a short title, a two-sentence detail, and up to 2 supporting quotes.",
  "If the feedback is uniformly positive, still give at least one suggestion for keeping or extending what works.",
  "Never invent feedback that is not in the input.",
].join(" ");

export async function analyzeShopReport(
  apiKey: string,
  rows: { rating: number | null; message: string | null; created_at: string; source: string | null }[],
): Promise<ShopReport> {
  const gateway = createGateway(apiKey);
  const body = rows
    .slice(0, 120)
    .map(
      (r, i) =>
        `${i + 1}. [${r.created_at.slice(0, 10)}] ${r.rating ?? "?"}/5 via ${r.source ?? "unknown"}: ${(r.message ?? "").slice(0, 600)}`,
    )
    .join("\n");

  try {
    const result = streamText({
      model: gateway(FEEDBACK_MODEL),
      system: REPORT_SYSTEM,
      prompt: `Here are ${rows.length} recent customer reviews, newest last:\n\n${body}`,
      output: Output.object({ schema: reportSchema }),
    });
    const out = await result.output;
    return {
      summary: out.summary,
      praise_themes: out.praise_themes.slice(0, 4),
      complaint_themes: out.complaint_themes.slice(0, 4),
      suggestions: out.suggestions.slice(0, 5),
    };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error("The model returned an unusable report; it will retry on the next run.");
    }
    throw error;
  }
}