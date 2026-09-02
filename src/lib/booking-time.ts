/** Naive local wall-clock date + time -> exact instant, using the caller's UTC offset. */
export function toInstant(date: string, time: string, tzOffsetMinutes: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0) + tzOffsetMinutes * 60_000);
}
