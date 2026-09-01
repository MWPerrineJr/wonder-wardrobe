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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>You've been invited to join {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>{siteName}</Text>
        <Heading style={h1}>You've been invited</Heading>
        <Text style={text}>
          You've been invited to join{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Accept below to create your account and get started.
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Accept invitation
        </Button>
        <Hr style={hr} />
        <Text style={footer}>
          If you weren't expecting this invitation, you can safely ignore this email.
        </Text>
        <Text style={footer}>
          Questions?{' '}
          <Link href={`mailto:${BRAND.supportEmail}`} style={link}>
            {BRAND.supportEmail}
          </Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
