import * as React from 'react'

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
} from '@react-email/components'

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
} from './brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Reset your password for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>{siteName}</Text>
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset the password for your {siteName} account. Choose a new one
          with the button below — the link expires shortly.
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Choose a new password
        </Button>
        <Hr style={hr} />
        <Text style={footer}>
          If you didn't request this, you can safely ignore this email — your password stays
          unchanged.
        </Text>
        <Text style={footer}>
          Need help?{' '}
          <Link href={`mailto:${BRAND.supportEmail}`} style={link}>
            {BRAND.supportEmail}
          </Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
