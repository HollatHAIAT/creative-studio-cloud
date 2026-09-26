import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { actions, DEMO_CREATOR, useAllListings, useStore } from "@/lib/store";
import { alertHistory, evaluate, type Metric } from "@/lib/analytics";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Drop alerts — creativestudio" },
      { name: "description", content: "Set thresholds for drops in listing views, favorites and purchases, and review alert history." },
      { property: "og:title", content: "Drop alerts — creativestudio" },
      { property: "og:description", content: "Configure and review listing drop alerts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Alerts,
});

const METRICS: Metric[] = ["views", "favorites", "purchases"];
const card = "rounded-sm border border-border bg-card p-6";
const inp = "rounded-sm border border-border bg-background px-3 py-2";

function Alerts() {
  const { alerts: cfg, review, notify } = useStore();
  const listings = useAllListings().filter((l) => l.creatorId === DEMO_CREATOR && l.status !== "archived");
  const [fListing, setFListing] = useState("all");
  const [fMetric, setFMetric] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const setCfg = (patch: Partial<typeof cfg>) => actions.setAlerts({ ...cfg, ...patch });
  const togglePause = (id: string) => setCfg({ paused: cfg.paused.includes(id) ? cfg.paused.filter((x) => x !== id) : [...cfg.paused, id] });

  const history = useMemo(() => listings.flatMap((l) => cfg.paused.includes(l.id) ? [] : alertHistory(l.id, cfg).map((a) => ({ ...a, title: l.title, key: `${l.id}:${a.metric}:${a.date}` }))).sort((a, b) => b.date.localeCompare(a.date)),
    [listings.map((l) => l.id).join(), JSON.stringify(cfg)]);
  const filtered = history.filter((h) => {
    const st = review[h.key] ?? "open";
    return (fListing === "all" || h.listingId === fListing) && (fMetric === "all" || h.metric === fMetric) && (fStatus === "all" || st === fStatus) && (!from || h.date >= from) && (!to || h.date <= to);
  });

  return (
    <SiteShell>
      <PageTitle eyebrow="Analytics" title="Drop alerts" sub="Get notified when a listing's views, favorites or purchases fall sharply. Based on sample data until live tracking is connected." />
      <div className="mx-auto max-w-7xl space-y-8 px-6">
        <Link to="/analytics" className="text-sm underline">Back to analytics</Link>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={card}>
            <h2 className="font-display text-2xl">Thresholds</h2>
            <p className="mt-1 text-sm text-muted-foreground">Alert when the average of the recent period falls by at least this much vs the comparison period.</p>
            <div className="mt-4 space-y-3">
              {METRICS.map((m) => (
                <label key={m} className="flex items-center justify-between gap-4 text-sm capitalize">{m} drop of
                  <span className="flex items-center gap-2"><input type="number" min={5} max={95} className={`${inp} w-20`} value={cfg.thresholds[m]} onChange={(e) => setCfg({ thresholds: { ...cfg.thresholds, [m]: Math.max(5, Math.min(95, +e.target.value || 5)) } })} />%</span>
                </label>
              ))}
              <label className="flex items-center justify-between text-sm">Recent period
                <select className={inp} value={cfg.recent} onChange={(e) => setCfg({ recent: +e.target.value })}>{[1, 3, 7, 14].map((n) => <option key={n} value={n}>Last {n} day{n > 1 ? "s" : ""}</option>)}</select>
              </label>
              <label className="flex items-center justify-between text-sm">Compared with
                <select className={inp} value={cfg.prior} onChange={(e) => setCfg({ prior: +e.target.value })}>{[7, 14, 30].map((n) => <option key={n} value={n}>Previous {n} days</option>)}</select>
              </label>
            </div>
          </div>
          <div className={card}>
            <h2 className="font-display text-2xl">Notifications</h2>
            <div className="mt-4 space-y-3 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={notify.inApp} onChange={(e) => actions.setNotify({ ...notify, inApp: e.target.checked })} />In-app (banner on analytics)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={notify.email} onChange={(e) => actions.setNotify({ ...notify, email: e.target.checked })} />Email</label>
              {notify.email && (
                <>
                  <input type="email" placeholder="you@studio.com" className={`${inp} w-full`} value={notify.address} onChange={(e) => actions.setNotify({ ...notify, address: e.target.value })} />
                  <select className={inp} value={notify.digest} onChange={(e) => actions.setNotify({ ...notify, digest: e.target.value as "instant" | "daily" })}><option value="instant">Send each alert right away</option><option value="daily">One daily summary</option></select>
                  <p className="text-muted-foreground">Emails start once the email service is connected.</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={card}>
          <h2 className="font-display text-2xl">Preview with recent data</h2>
          <p className="mt-1 text-sm text-muted-foreground">Last {cfg.recent} days vs previous {cfg.prior} days. Red cells would trigger an alert now.</p>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="py-2">Listing</th>{METRICS.map((m) => <th key={m} className="capitalize">{m}</th>)}<th>Alerts</th></tr></thead>
            <tbody>
              {listings.map((l) => {
                const paused = cfg.paused.includes(l.id);
                const ev = evaluate(l.id, cfg);
                return (
                  <tr key={l.id} className={`border-t border-border ${paused ? "opacity-50" : ""}`}>
                    <td className="py-3">{l.title}</td>
                    {ev.map((a) => <td key={a.metric} className={a.triggered && !paused ? "font-medium text-destructive" : ""}>{a.change >= 0 ? "+" : ""}{(a.change * 100).toFixed(0)}% <span className="text-xs text-muted-foreground">/ −{a.threshold}%</span></td>)}
                    <td><button onClick={() => { togglePause(l.id); toast(paused ? `Alerts resumed for ${l.title}` : `Alerts paused for ${l.title}`); }} className="rounded-full border border-border px-3 py-1 text-xs">{paused ? "Resume" : "Pause"}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={card}>
          <h2 className="font-display text-2xl">Alert history</h2>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <select className={inp} value={fListing} onChange={(e) => setFListing(e.target.value)}><option value="all">All listings</option>{listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select>
            <select className={inp} value={fMetric} onChange={(e) => setFMetric(e.target.value)}><option value="all">All metrics</option>{METRICS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
            <select className={inp} value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option></select>
            <input type="date" className={inp} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
            <input type="date" className={inp} value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          </div>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="py-2">Date</th><th>Listing</th><th>Metric</th><th>Change</th><th>Comparison</th><th>Status</th><th /></tr></thead>
            <tbody>
              {filtered.map((h) => {
                const st = review[h.key] ?? "open";
                return (
                  <tr key={h.key} className="border-t border-border">
                    <td className="py-3">{h.date}</td><td>{h.title}</td><td className="capitalize">{h.metric}</td>
                    <td className="text-destructive">{(h.change * 100).toFixed(0)}%</td>
                    <td>{cfg.recent}d vs prior {cfg.prior}d</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-xs ${st === "open" ? "bg-destructive/10 text-destructive" : st === "resolved" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{st}</span></td>
                    <td className="space-x-2 text-right">
                      {st === "open" && <button onClick={() => actions.setReview(h.key, "acknowledged")} className="underline">Acknowledge</button>}
                      {st !== "resolved" && <button onClick={() => actions.setReview(h.key, "resolved")} className="underline">Resolve</button>}
                      {st !== "open" && <button onClick={() => actions.setReview(h.key, null)} className="text-muted-foreground underline">Reopen</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="py-4 text-sm text-muted-foreground">No alerts match these filters.</p>}
        </div>
      </div>
    </SiteShell>
  );
}
