/**
 * Shared brand styling for The Standing Chair auth + app emails.
 * Body background stays #ffffff for email-client compatibility; brand color
 * appears in the wordmark, buttons, and links.
 */
export const BRAND = {
  name: "The Standing Chair",
  accent: "#8a6d3b",
  ink: "#1c1a17",
  muted: "#57534e",
  faint: "#8a8580",
  surface: "#faf8f5",
  hairline: "#e7e2da",
  supportEmail: "support@thestandingchair.com",
};

export const main = {
  backgroundColor: "#ffffff",
  fontFamily: "Figtree, Helvetica, Arial, sans-serif",
  color: BRAND.ink,
};

export const container = { padding: "32px 28px", maxWidth: "560px" };

export const wordmark = {
  fontFamily: "Outfit, Figtree, Helvetica, Arial, sans-serif",
  fontSize: "18px",
  fontWeight: 700 as const,
  letterSpacing: "-0.01em",
  color: BRAND.accent,
  margin: "0 0 24px",
};

export const h1 = {
  fontFamily: "Outfit, Figtree, Helvetica, Arial, sans-serif",
  fontSize: "24px",
  lineHeight: "1.25",
  fontWeight: 700 as const,
  color: BRAND.ink,
  margin: "0 0 20px",
};

export const text = {
  fontSize: "16px",
  color: BRAND.muted,
  lineHeight: "1.6",
  margin: "0 0 20px",
};

export const link = { color: BRAND.accent, textDecoration: "underline" };

export const button = {
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

export const codeStyle = {
  fontFamily: "Courier, monospace",
  fontSize: "26px",
  letterSpacing: "0.12em",
  fontWeight: 700 as const,
  color: BRAND.ink,
  backgroundColor: BRAND.surface,
  borderRadius: "10px",
  padding: "14px 18px",
  margin: "0 0 28px",
};

export const hr = { borderColor: BRAND.hairline, margin: "28px 0 20px" };

export const footer = { fontSize: "13px", color: BRAND.faint, margin: "0 0 6px" };

// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
export const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #d9b978 !important; color: #1c1a17 !important; border-color: #d9b978 !important; }
  }
  [data-ogsc] .dm-btn { background-color: #d9b978 !important; color: #1c1a17 !important; }
  [data-ogsb] .dm-btn { background-color: #d9b978 !important; color: #1c1a17 !important; }
`;
