// Simulated analytics until real tracking is connected. Deterministic per listing + day.
export const SOURCES = ["Direct", "Instagram", "Google search", "Newsletter", "Referral sites"] as const;
export type Source = (typeof SOURCES)[number];
export type DayStat = { date: string; views: number; favorites: number; purchases: number };

function rand(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}
const DAY = 86400000;
export function dayKey(t: number) { return new Date(t).toISOString().slice(0, 10); }

export function listingDaily(id: string, days: number, end = Date.now()): DayStat[] {
  const base = 20 + rand(id) * 120;
  const favRate = 0.04 + rand(id + "f") * 0.1;
  const buyRate = 0.08 + rand(id + "b") * 0.25;
  const out: DayStat[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const t = end - i * DAY;
    const k = dayKey(t);
    const wave = 1 + 0.3 * Math.sin((t / DAY) / 4 + rand(id) * 6);
    const dip = rand(id + "dip") > 0.6 && i < 4 ? 0.45 : 1; // some listings drop recently
    const views = Math.round(base * wave * (0.7 + rand(id + k) * 0.6) * dip);
    const favorites = Math.round(views * favRate * (0.6 + rand(id + k + "f") * 0.8));
    const purchases = Math.round(favorites * buyRate * (0.5 + rand(id + k + "b")) * dip);
    out.push({ date: k, views, favorites, purchases });
  }
  return out;
}

export function sourceSplit(id: string) {
  const w = SOURCES.map((s) => 0.3 + rand(id + s));
  const sum = w.reduce((a, b) => a + b, 0);
  return SOURCES.map((s, i) => ({ source: s, share: w[i]! / sum, conv: 0.5 + rand(id + s + "c") }));
}

export function totals(d: DayStat[]) {
  return d.reduce((a, x) => ({ views: a.views + x.views, favorites: a.favorites + x.favorites, purchases: a.purchases + x.purchases }), { views: 0, favorites: 0, purchases: 0 });
}
export const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

export type Metric = "views" | "favorites" | "purchases";
export type AlertConfig = { thresholds: Record<Metric, number>; recent: number; prior: number; paused: string[] };
export const defaultAlertConfig: AlertConfig = { thresholds: { views: 30, favorites: 30, purchases: 40 }, recent: 3, prior: 7, paused: [] };
export type Alert = { listingId: string; metric: Metric; change: number; threshold: number; triggered: boolean; date: string };
/** Compare the average of the last `recent` days vs the `prior` days before, ending `offset` days ago. */
export function evaluate(id: string, cfg: AlertConfig, offset = 0): Alert[] {
  const end = Date.now() - offset * DAY;
  const d = listingDaily(id, cfg.recent + cfg.prior, end);
  const r = totals(d.slice(-cfg.recent)), p = totals(d.slice(0, cfg.prior));
  return (["views", "favorites", "purchases"] as const).map((m) => {
    const ra = r[m] / cfg.recent, pa = p[m] / cfg.prior;
    const change = pa ? (ra - pa) / pa : 0;
    return { listingId: id, metric: m, change, threshold: cfg.thresholds[m], triggered: change * 100 <= -cfg.thresholds[m], date: dayKey(end) };
  });
}
export function detectDrops(id: string, cfg: AlertConfig = defaultAlertConfig) {
  return cfg.paused.includes(id) ? [] : evaluate(id, cfg).filter((a) => a.triggered);
}
/** Triggered alerts over the past `days` days (first day of each episode). */
export function alertHistory(id: string, cfg: AlertConfig, days = 21) {
  const out: Alert[] = [];
  const active = new Set<string>();
  for (let o = days; o >= 0; o--) {
    for (const a of evaluate(id, cfg, o)) {
      if (a.triggered && !active.has(a.metric)) out.push(a);
      if (a.triggered) active.add(a.metric); else active.delete(a.metric);
    }
  }
  return out;
}

export function toCsv(rows: (string | number)[][]) {
  return rows.map((r) => r.map((c) => { const s = String(c); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
}
export function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
