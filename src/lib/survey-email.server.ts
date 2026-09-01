// Sends the "how was your visit?" review request.
//
// Delivery goes through the app's own email endpoint. Until an email domain is
// configured for this project that endpoint does not exist, so the invite row
// is still created and marked `blocked` with a reason instead of silently
// vanishing — the owner sees it in the delivery list and the row is retried
// once email is live.

export type SurveyEmailOutcome = { status: "sent" | "blocked" | "failed"; error?: string };

export type SurveyEmailInput = {
  token: string;
  shopName: string;
  providerName: string | null;
  customerName: string | null;
  customerEmail: string;
  serviceName: string | null;
  shopAddress: string | null;
};

export function surveyUrl(appUrl: string, token: string, rating?: number) {
  const base = `${appUrl.replace(/\/$/, "")}/survey/${token}`;
  return rating ? `${base}?r=${rating}` : base;
}

export async function sendSurveyInviteEmail(
  input: SurveyEmailInput,
  appUrl = process.env["APP_URL"] ?? "",
): Promise<SurveyEmailOutcome> {
  if (!appUrl) {
    return { status: "blocked", error: "APP_URL is not configured for this deployment." };
  }
  if (!process.env["JOB_SECRET"] || process.env["JOB_SECRET"].length < 32) {
    return { status: "blocked", error: "JOB_SECRET is not configured for this deployment." };
  }

  const payload = {
    templateName: "survey-invite",
    recipientEmail: input.customerEmail,
    idempotencyKey: `survey-invite-${input.token}`,
    templateData: {
      shopName: input.shopName,
      providerName: input.providerName,
      customerName: input.customerName,
      serviceName: input.serviceName,
      shopAddress: input.shopAddress,
      surveyUrl: surveyUrl(appUrl, input.token),
      starUrls: [1, 2, 3, 4, 5].map((r) => surveyUrl(appUrl, input.token, r)),
    },
  };

  try {
    const response = await fetch(`${appUrl.replace(/\/$/, "")}/api/public/emails/survey-invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env["JOB_SECRET"] ?? ""}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 404 || response.status === 501) {
      return {
        status: "blocked",
        error: "Email sending is not set up yet — configure an email domain to start sending.",
      };
    }
    if (!response.ok) {
      return { status: "failed", error: (await response.text()).slice(0, 400) };
    }
    return { status: "sent" };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
}