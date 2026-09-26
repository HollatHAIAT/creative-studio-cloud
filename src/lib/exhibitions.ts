import type { Exhibition } from "./data";

const DAY = 86400_000;
/** Exhibition days are relative to 26 Sep 2026 (UTC) so the demo schedule stays stable. */
const BASE = Date.UTC(2026, 8, 26);
export const startOf = (e: Exhibition) => BASE + e.startDay * DAY;
export const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function openDates(e: Exhibition, limit = 14) {
  const out: string[] = [];
  for (let i = 0; i < e.days && out.length < limit; i++) {
    const d = startOf(e) + i * DAY;
    if (d < BASE) continue;
    if (e.closedWeekday !== undefined && new Date(d).getUTCDay() === e.closedWeekday) continue;
    out.push(iso(d));
  }
  return out;
}

export const fmtDate = (s: string, locale: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Date(`${s}T00:00:00Z`).toLocaleDateString(locale === "ar" ? "ar-SA-u-ca-gregory" : "en-GB", { ...opts, timeZone: "UTC" });

export const dateRange = (e: Exhibition, locale: string) => {
  const o = { day: "numeric", month: "short", year: "numeric" } as const;
  return `${fmtDate(iso(startOf(e)), locale, o)} – ${fmtDate(iso(startOf(e) + (e.days - 1) * DAY), locale, o)}`;
};

/** Deterministic simulated occupancy per slot, so availability looks realistic. */
export function taken(e: Exhibition, date: string, slot: string) {
  let h = 0;
  for (const c of e.id + date + slot) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % (e.capacity + 6) > e.capacity ? e.capacity : h % Math.round(e.capacity * 0.9);
}
