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
  Text,
} from "@react-email/components";

import {
  BRAND,
  button,
  container,
  darkModeCss,
  footer,
  h1,
  hr,
  link,
  main,
  text,
  wordmark,
} from "./brand";

interface EmailChangeEmailProps {
  siteName: string;
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string;
  email: string;
  newEmail: string;
  confirmationUrl: string;
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Confirm your email change for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>{siteName}</Text>
        <Heading style={h1}>Confirm your new email</Heading>
        <Text style={text}>
          You asked to change the email on your {siteName} account from{" "}
          <Link href={`mailto:${oldEmail}`} style={link}>
            {oldEmail}
          </Link>{" "}
          to{" "}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Confirm email change
        </Button>
        <Hr style={hr} />
        <Text style={footer}>
          If you didn't request this change, please secure your account right away.
        </Text>
        <Text style={footer}>
          Contact us:{" "}
          <Link href={`mailto:${BRAND.supportEmail}`} style={link}>
            {BRAND.supportEmail}
          </Link>
        </Text>
      </Container>
    </Body>
  </Html>
);

export default EmailChangeEmail;
