/** Self-reported "How did you hear about us?" options. Must match the DB check constraint. */
export const HEARD_ABOUT_SOURCES = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "google", label: "Google search" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
] as const;

export type HeardAboutSource = (typeof HEARD_ABOUT_SOURCES)[number]["value"];

export const HEARD_ABOUT_VALUES = HEARD_ABOUT_SOURCES.map((s) => s.value) as [
  HeardAboutSource,
  ...HeardAboutSource[],
];

export function heardAboutLabel(value: string | null): string {
  return HEARD_ABOUT_SOURCES.find((s) => s.value === value)?.label ?? "Not answered";
}

/** These choices invite a short free-text note. */
export function wantsHeardAboutDetail(value: string | null): boolean {
  return value === "referral" || value === "other";
}
