import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { BRAND, container, footer, h1, hr, link, main, text, wordmark } from "./brand";
import type { TemplateEntry } from "./registry";

interface SurveyInviteProps {
  shopName?: string;
  providerName?: string | null;
  customerName?: string | null;
  serviceName?: string | null;
  shopAddress?: string | null;
  surveyUrl?: string;
  starUrls?: string[];
}

const SurveyInviteEmail = ({
  shopName,
  providerName,
  customerName,
  serviceName,
  surveyUrl,
  starUrls,
}: SurveyInviteProps) => {
  const shop = shopName?.trim() || "your recent visit";
  const greeting = customerName?.trim() ? `Hi ${customerName.trim()},` : "Hi there,";
  const stars = Array.isArray(starUrls) && starUrls.length === 5 ? starUrls : null;

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>How was your visit to {shop}?</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={wordmark}>{BRAND.name}</Text>
          <Heading style={h1}>How was your visit?</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            Thanks for visiting <strong>{shop}</strong>
            {serviceName ? ` for ${serviceName}` : ""}
            {providerName ? ` with ${providerName}` : ""}. It would mean a lot if you shared how it
            went — it takes about thirty seconds and goes straight to the shop.
          </Text>

          {stars ? (
            <Section style={starRow}>
              {stars.map((href, i) => (
                <Link key={i} href={href} style={starLink}>
                  {i + 1}
                  {i === 4 ? " ★" : ""}
                </Link>
              ))}
            </Section>
          ) : null}

          {surveyUrl ? (
            <Section style={{ margin: "0 0 24px" }}>
              <Button href={surveyUrl} className="dm-btn" style={cta}>
                Leave your feedback
              </Button>
            </Section>
          ) : null}

          <Hr style={hr} />
          <Text style={footer}>
            Your feedback is private to the shop unless you choose to post a public review.
          </Text>
          {surveyUrl ? (
            <Text style={footer}>
              Trouble with the button? Open{" "}
              <Link href={surveyUrl} style={link}>
                {surveyUrl}
              </Link>
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: SurveyInviteEmail as TemplateEntry["component"],
  subject: (data: Record<string, unknown>) =>
    typeof data["shopName"] === "string" && data["shopName"].trim()
      ? `How was your visit to ${data["shopName"]}?`
      : "How was your visit?",
  displayName: "Post-visit survey invite",
  previewData: {
    shopName: "Crown & Cut",
    providerName: "Alex",
    customerName: "Jordan",
    serviceName: "Skin fade",
    surveyUrl: "https://thestandingchair.com/survey/2f1c9e4a-0d3b-4f7a-9c11-6b2e8a5d4c33",
    starUrls: [1, 2, 3, 4, 5].map(
      (r) =>
        `https://thestandingchair.com/survey/2f1c9e4a-0d3b-4f7a-9c11-6b2e8a5d4c33?r=${r}`,
    ),
  },
} satisfies TemplateEntry;

const starRow = { margin: "0 0 24px" };

const starLink = {
  display: "inline-block",
  width: "40px",
  textAlign: "center" as const,
  padding: "10px 0",
  marginRight: "8px",
  border: `1px solid ${BRAND.hairline}`,
  borderRadius: "8px",
  color: BRAND.accent,
  fontWeight: 700 as const,
  textDecoration: "none",
  backgroundColor: BRAND.surface,
};

const cta = {
  backgroundColor: BRAND.accent,
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600 as const,
  border: `1px solid ${BRAND.accent}`,
  borderRadius: "10px",
  padding: "13px 22px",
  textDecoration: "none",
  display: "inline-block",
};
