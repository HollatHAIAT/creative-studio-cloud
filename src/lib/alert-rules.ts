import { dayKey, type AlertConfig } from "./analytics";

export type Severity = "critical" | "high" | "moderate";
export const SEVERITIES: Severity[] = ["critical", "high", "moderate"];
export const defaultTargets: Record<Severity, number> = { critical: 3, high: 5, moderate: 7 };
type G = { triggers: { date: string; change: number; recoveredAt?: string }[] };

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** First trigger → linked recovery of the latest episode; ongoing groups count to today. */
export function groupDuration(g: G) {
  const first = g.triggers.reduce((m, t) => (t.date < m ? t.date : m), g.triggers[0]!.date);
  const latest = g.triggers.reduce((m, t) => (t.date > m.date ? t : m), g.triggers[0]!);
  const end = latest.recoveredAt ?? dayKey(Date.now());
  return { first, end, days: daysBetween(first, end), ongoing: !latest.recoveredAt };
}
/** Severity from the group's largest drop. */
export function severity(g: G): Severity {
  const worst = Math.min(...g.triggers.map((t) => t.change));
  return worst <= -0.6 ? "critical" : worst <= -0.45 ? "high" : "moderate";
}
export function targetFor(g: G, cfg: AlertConfig) {
  return (cfg.recoveryTargets ?? defaultTargets)[severity(g)];
}
/** Days past the matching recovery target (0 if within target or recovered). */
export function daysPast(g: G, cfg: AlertConfig) {
  const d = groupDuration(g);
  return d.ongoing ? Math.max(0, d.days - targetFor(g, cfg)) : 0;
}
export const durLabel = (d: ReturnType<typeof groupDuration>) => (d.ongoing ? `${d.days} days · ongoing` : `${d.days} days`);
