import * as React from 'react'

import {
  Body,
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
  codeStyle,
  container,
  footer,
  h1,
  hr,
  link,
  main,
  text,
  wordmark,
} from './brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>{BRAND.name}</Text>
        <Heading style={h1}>Confirm it's you</Heading>
        <Text style={text}>Use this code to confirm your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Hr style={hr} />
        <Text style={footer}>
          The code expires shortly. If you didn't request it, you can safely ignore this email.
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

export default ReauthenticationEmail
