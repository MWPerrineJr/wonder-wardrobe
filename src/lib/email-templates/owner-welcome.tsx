import * as React from "react";
import {
  Body,
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

import type { TemplateEntry } from "./registry";

interface OwnerWelcomeProps {
  ownerName?: string;
  shopName?: string;
  shopUrl?: string;
}

const OwnerWelcomeEmail = ({ ownerName, shopName, shopUrl }: OwnerWelcomeProps) => {
  const greeting = ownerName?.trim() ? `Hi ${ownerName.trim()},` : "Hi there,";
  const shop = shopName?.trim() || "your new shop";

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Welcome to The Standing Chair — {shop} is live</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Welcome to The Standing Chair</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            Thank you for setting up <strong>{shop}</strong>. I'm genuinely glad you're here — The
            Standing Chair was built so independent shops get a booking page that looks as good as
            the work you do.
          </Text>
          {shopUrl ? (
            <Section style={section}>
              <Text style={text}>
                Your public booking page:{" "}
                <Link href={shopUrl} style={link}>
                  {shopUrl}
                </Link>
              </Text>
            </Section>
          ) : null}
          <Text style={text}>
            A few good next steps: add your services and prices, set your weekly hours, invite your
            providers, and share your page link with clients.
          </Text>
          <Hr style={hr} />
          <Text style={text}>
            If you ever have a question, an idea, or something isn't working the way you'd expect,
            just reply to this email — it comes straight to me.
          </Text>
          <Text style={signature}>
            Michael
            <br />
            Pandagentic — maker of The Standing Chair
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: OwnerWelcomeEmail as TemplateEntry["component"],
  subject: (data: Record<string, unknown>) =>
    typeof data["shopName"] === "string"
      ? `Welcome to The Standing Chair, ${data["shopName"]}!`
      : "Welcome to The Standing Chair!",
  displayName: "Shop owner welcome",
  previewData: {
    ownerName: "Jordan",
    shopName: "Crown & Cut",
    shopUrl: "https://thestandingchair.com/shop/crown-and-cut",
  },
} satisfies TemplateEntry;

const main = {
  backgroundColor: "#ffffff",
  fontFamily: "Figtree, Helvetica, Arial, sans-serif",
  color: "#1c1a17",
};

const container = { padding: "32px 28px", maxWidth: "560px" };

const heading = {
  fontSize: "24px",
  lineHeight: "1.25",
  fontWeight: 700,
  color: "#1c1a17",
  margin: "0 0 20px",
};

const text = { fontSize: "16px", lineHeight: "1.6", margin: "0 0 16px" };

const section = {
  backgroundColor: "#faf8f5",
  borderRadius: "10px",
  padding: "14px 16px",
  margin: "0 0 16px",
};

const link = { color: "#8a6d3b", textDecoration: "underline" };

const hr = { borderColor: "#e7e2da", margin: "24px 0" };

const signature = { fontSize: "16px", lineHeight: "1.6", margin: "0", color: "#57534e" };
