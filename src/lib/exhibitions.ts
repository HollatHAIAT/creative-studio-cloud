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

const EN_M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AR_M = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const EN_D = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const AR_D = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
/** Hand-rolled so server and browser render identical text (no locale-data differences). */
export const fmtDate = (s: string, locale: string, opts: { weekday?: boolean; year?: boolean } = { weekday: true }) => {
  const d = new Date(`${s}T00:00:00Z`);
  const ar = locale === "ar";
  const parts = [opts.weekday ? (ar ? AR_D : EN_D)[d.getUTCDay()] : "", String(d.getUTCDate()), (ar ? AR_M : EN_M)[d.getUTCMonth()], opts.year ? String(d.getUTCFullYear()) : ""];
  return parts.filter(Boolean).join(" ");
};

export const dateRange = (e: Exhibition, locale: string) => {
  const o = { year: true };
  return `${fmtDate(iso(startOf(e)), locale, o)} – ${fmtDate(iso(startOf(e) + (e.days - 1) * DAY), locale, o)}`;
};

/** Deterministic simulated occupancy per slot, so availability looks realistic. */
export function taken(e: Exhibition, date: string, slot: string) {
  let h = 0;
  for (const c of e.id + date + slot) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % (e.capacity + 6) > e.capacity ? e.capacity : h % Math.round(e.capacity * 0.9);
}
