// Simulated alert delivery until real channels are connected. Deterministic per alert + channel + attempt.
import { alertHistory, dayKey, type AlertConfig } from "./analytics";
import type { Severity } from "./alert-rules";

export const CHANNELS = ["In-app", "Email", "SMS", "Slack", "Webhook"] as const;
export type Channel = (typeof CHANNELS)[number];
export type RouteRule = { id: string; service: string; severity: Severity | "all"; responder: string; primary: Channel; fallbacks: Channel[] };
export type RetryPolicy = { intervalMin: number; maxAttempts: number };
export type Slo = { id: string; channel: Channel | "all"; service: string; severity: Severity | "all"; minSuccess: number; maxLatency: number };
export type Attempt = { channel: Channel; n: number; ok: boolean; latency: number; at: number; error?: string };
export type DeliveryRecord = {
  id: string; alertKey: string; service: string; title: string; metric: string; severity: Severity; date: string;
  responder: string; rule: string; attempts: Attempt[]; outcome: "delivered" | "exhausted"; deliveredVia?: Channel; manual?: boolean;
};

export const defaultRetry: RetryPolicy = { intervalMin: 5, maxAttempts: 3 };
const FAIL: Record<Channel, number> = { "In-app": 0.02, Email: 0.12, SMS: 0.2, Slack: 0.1, Webhook: 0.28 };
const LAT: Record<Channel, number> = { "In-app": 0.4, Email: 6, SMS: 4, Slack: 2, Webhook: 1.5 };
const ERR: Record<Channel, string> = { "In-app": "Client offline", Email: "Mailbox unavailable", SMS: "Carrier rejected", Slack: "Channel not found", Webhook: "Endpoint returned 503" };

function rand(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}
const sevOf = (c: number): Severity => (c <= -0.6 ? "critical" : c <= -0.45 ? "high" : "moderate");

/** Most specific matching rule wins: service+severity > service > severity > catch-all. */
export function matchRule(rules: RouteRule[], service: string, sev: Severity) {
  const score = (r: RouteRule) => (r.service === service ? 2 : r.service === "all" ? 0 : -9) + (r.severity === sev ? 1 : r.severity === "all" ? 0 : -9);
  return [...rules].map((r) => ({ r, s: score(r) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s)[0]?.r;
}

export function buildDeliveries(listings: { id: string; title: string }[], cfg: AlertConfig, rules: RouteRule[], retry: RetryPolicy, overrides: Record<string, Channel>, days = 60): DeliveryRecord[] {
  const out: DeliveryRecord[] = [];
  for (const l of listings) for (const g of alertHistory(l.id, cfg, days)) for (const t of g.triggers) {
    const sev = sevOf(t.change);
    const rule = matchRule(rules, l.id, sev) ?? { id: "default", service: "all", severity: "all" as const, responder: "You", primary: "In-app" as Channel, fallbacks: ["Email" as Channel] };
    const id = `${l.id}:${g.metric}:${t.date}`;
    const attempts: Attempt[] = [];
    let at = Date.parse(t.date) + 9 * 3600000;
    let via: Channel | undefined;
    for (const ch of [rule.primary, ...rule.fallbacks]) {
      for (let n = 1; n <= retry.maxAttempts; n++) {
        const ok = rand(`${id}:${ch}:${n}`) > FAIL[ch] * (n === 1 ? 1.6 : 1);
        const latency = +(LAT[ch] * (0.5 + rand(`${id}:${ch}:${n}:l`) * 1.5)).toFixed(1);
        attempts.push({ channel: ch, n, ok, latency, at, ...(ok ? {} : { error: ERR[ch] }) });
        at += retry.intervalMin * 60000;
        if (ok) { via = ch; break; }
      }
      if (via) break;
    }
    const manual = overrides[id];
    if (!via && manual) attempts.push({ channel: manual, n: attempts.filter((a) => a.channel === manual).length + 1, ok: true, latency: LAT[manual], at: Date.now() });
    out.push({ id, alertKey: `${l.id}:${g.metric}`, service: l.id, title: l.title, metric: g.metric, severity: sev, date: t.date, responder: rule.responder, rule: rule.id,
      attempts, outcome: via || manual ? "delivered" : "exhausted", ...(via || manual ? { deliveredVia: (via ?? manual)! } : {}), ...(manual && !via ? { manual: true } : {}) });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export type Perf = { key: string; sent: number; delivered: number; success: number; latency: number; retries: number };
export function perf(records: DeliveryRecord[], by: (r: DeliveryRecord, a: Attempt) => string): Perf[] {
  const m = new Map<string, { sent: number; ok: number; lat: number; retries: number }>();
  for (const r of records) for (const a of r.attempts) {
    const k = by(r, a); const x = m.get(k) ?? { sent: 0, ok: 0, lat: 0, retries: 0 };
    x.sent++; if (a.ok) { x.ok++; x.lat += a.latency; } if (a.n > 1) x.retries++;
    m.set(k, x);
  }
  return [...m.entries()].map(([key, x]) => ({ key, sent: x.sent, delivered: x.ok, success: x.sent ? (x.ok / x.sent) * 100 : 0, latency: x.ok ? x.lat / x.ok : 0, retries: x.retries }));
}
export function inRange(r: DeliveryRecord, from: number, to: number) { const t = Date.parse(r.date); return t >= from && t < to; }
export const today = () => Date.parse(dayKey(Date.now())) + 86400000;

const matches = (s: Slo, r: DeliveryRecord, a: Attempt) =>
  (s.channel === "all" || s.channel === a.channel) && (s.service === "all" || s.service === r.service) && (s.severity === "all" || s.severity === r.severity);

/** Daily success % and latency for attempts an SLO covers. */
export function sloDaily(s: Slo, records: DeliveryRecord[]) {
  const m = new Map<string, { sent: number; ok: number; lat: number }>();
  for (const r of records) for (const a of r.attempts) if (matches(s, r, a)) {
    const d = dayKey(a.at); const x = m.get(d) ?? { sent: 0, ok: 0, lat: 0 };
    x.sent++; if (a.ok) { x.ok++; x.lat += a.latency; } m.set(d, x);
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, x]) => ({ date, sent: x.sent, success: (x.ok / x.sent) * 100, latency: x.ok ? x.lat / x.ok : 0 }));
}
export type Breach = { id: string; slo: Slo; start: string; end?: string; kind: ("success" | "latency")[]; worstSuccess: number; worstLatency: number };
/** Consecutive days violating an SLO form one breach episode; the first compliant day is its recovery. */
export function breaches(slos: Slo[], records: DeliveryRecord[]): Breach[] {
  const out: Breach[] = [];
  for (const s of slos) {
    let cur: Breach | undefined;
    for (const d of sloDaily(s, records)) {
      const kind: Breach["kind"] = [];
      if (d.success < s.minSuccess) kind.push("success");
      if (d.latency > s.maxLatency) kind.push("latency");
      if (kind.length) {
        if (!cur) { cur = { id: `${s.id}:${d.date}`, slo: s, start: d.date, kind: [], worstSuccess: 100, worstLatency: 0 }; out.push(cur); }
        cur.kind = [...new Set([...cur.kind, ...kind])]; cur.worstSuccess = Math.min(cur.worstSuccess, d.success); cur.worstLatency = Math.max(cur.worstLatency, d.latency);
      } else if (cur) { cur.end = d.date; cur = undefined; }
    }
  }
  return out.sort((a, b) => b.start.localeCompare(a.start));
}
/** Error budget over a window: allowed failures = (1 − target) × attempts. Burn rate 1 = consuming budget exactly as fast as allowed. */
export function errorBudget(s: Slo, records: DeliveryRecord[]) {
  let sent = 0, failed = 0;
  for (const r of records) for (const a of r.attempts) if (matches(s, r, a)) { sent++; if (!a.ok) failed++; }
  const allowed = sent * (1 - s.minSuccess / 100);
  const consumed = allowed ? (failed / allowed) * 100 : failed ? Infinity : 0;
  const burn = sent && s.minSuccess < 100 ? (failed / sent) / (1 - s.minSuccess / 100) : 0;
  return { sent, failed, allowed: Math.round(allowed), consumed, remaining: Math.max(0, 100 - consumed), burn };
}
