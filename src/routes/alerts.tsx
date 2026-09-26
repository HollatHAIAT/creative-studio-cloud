import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { actions, DEMO_CREATOR, useAllListings, useStore } from "@/lib/store";
import { alertHistory, dayKey, download, evaluate, toCsv, type Metric } from "@/lib/analytics";

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

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
/** First trigger → linked recovery of the latest episode; ongoing groups count to today. */
function groupDuration(g: { triggers: { date: string; recoveredAt?: string }[] }) {
  const first = g.triggers.reduce((m, t) => (t.date < m ? t.date : m), g.triggers[0]!.date);
  const latest = g.triggers.reduce((m, t) => (t.date > m.date ? t : m), g.triggers[0]!);
  const end = latest.recoveredAt ?? dayKey(Date.now());
  return { first, end, days: daysBetween(first, end), ongoing: !latest.recoveredAt };
}
const durLabel = (d: ReturnType<typeof groupDuration>) => d.ongoing ? `${d.days} days · ongoing` : `${d.days} days`;
const METRICS: Metric[] = ["views", "favorites", "purchases"];
const card = "rounded-sm border border-border bg-card p-6";
const inp = "rounded-sm border border-border bg-background px-3 py-2";

function Alerts() {
  const { alerts: cfg, review, notify, alertSort, alertPresets } = useStore();
  const [page, setPage] = useState(1);
  const PAGE = 5;
  const sortBy = alertSort.by, dir = alertSort.dir === "asc" ? -1 : 1;
  const [open, setOpen] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"acknowledged" | "resolved" | null>(null);
  const listings = useAllListings().filter((l) => l.creatorId === DEMO_CREATOR && l.status !== "archived");
  const [fListing, setFListing] = useState("all");
  const [fMetric, setFMetric] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fRecovery, setFRecovery] = useState("all");
  const target = cfg.recoveryTarget ?? 7;
  const overdue = (g: Parameters<typeof groupDuration>[0]) => { const d = groupDuration(g); return d.ongoing && d.days > target; };

  const setCfg = (patch: Partial<typeof cfg>) => actions.setAlerts({ ...cfg, ...patch });
  const togglePause = (id: string) => setCfg({ paused: cfg.paused.includes(id) ? cfg.paused.filter((x) => x !== id) : [...cfg.paused, id] });

  const history = useMemo(() => listings.flatMap((l) => cfg.paused.includes(l.id) ? [] : alertHistory(l.id, cfg).map((g) => ({ ...g, title: l.title, key: `${l.id}:${g.metric}` }))),
    [listings.map((l) => l.id).join(), JSON.stringify(cfg)]);
  const periodDays = Math.max(7, cfg.recent + cfg.prior);
  const filtered = history
    .map((h) => ({ ...h, triggers: h.triggers.filter((t) => (!from || t.date >= from) && (!to || t.date <= to)) }))
    .filter((h) => {
      const st = review[h.key] ?? "open";
      const rec = groupDuration(h).ongoing ? "ongoing" : "recovered";
      return h.triggers.length > 0 && (fRecovery === "all" || rec === fRecovery) && (fListing === "all" || h.listingId === fListing) && (fMetric === "all" || h.metric === fMetric) && (fStatus === "all" || st === fStatus);
    })
    .sort((x, y) => dir * (sortBy === "ongoing" ? (Number(groupDuration(y).ongoing) - Number(groupDuration(x).ongoing)) * 1000 + groupDuration(y).days - groupDuration(x).days : sortBy === "duration" ? groupDuration(y).days - groupDuration(x).days : sortBy === "repeats" ? y.triggers.length - x.triggers.length
      : sortBy === "drop" ? Math.min(...x.triggers.map((t) => t.change)) - Math.min(...y.triggers.map((t) => t.change))
      : y.triggers[0]!.date.localeCompare(x.triggers[0]!.date)));

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const curPage = Math.min(page, pages);
  const pageItems = filtered.slice((curPage - 1) * PAGE, curPage * PAGE);
  const recoveryInfo = (h: (typeof filtered)[number]) => {
    const d = groupDuration(h);
    return d.ongoing ? `Ongoing — ${d.days} days since first trigger on ${d.first}, not yet recovered` : `Recovered in ${d.days} days (first trigger ${d.first} → recovery ${d.end})`;
  };
  function savePreset() {
    const name = prompt("Name this preset")?.trim();
    if (!name) return;
    actions.saveAlertPreset({ id: Date.now().toString(36), name: name.slice(0, 60), listing: fListing, metric: fMetric, status: fStatus, from, to, recovery: fRecovery });
    toast.success("Preset saved");
  }

  function runBulk() {
    if (!bulkAction) return;
    const keys = filtered.map((h) => h.key);
    const undo = actions.setReviewMany(keys, bulkAction);
    toast.success(`${keys.length} alert group${keys.length > 1 ? "s" : ""} marked ${bulkAction}`, { action: { label: "Undo", onClick: undo }, duration: 10000 });
    setBulkAction(null);
  }

  function exportCsv() {
    const origin = window.location.origin;
    const rows: (string | number)[][] = [["Listing", "Metric", "Review status", "Trigger date", "Change %", "Recovered on", "Recovery change %", "Comparison", "Group duration (days)", "Group duration status", "Over recovery target", "Analytics link"]];
    filtered.forEach((h) => h.triggers.forEach((t) => rows.push([h.title, h.metric, review[h.key] ?? "open", t.date, (t.change * 100).toFixed(1), t.recoveredAt ?? "", t.recoveryChange != null ? (t.recoveryChange * 100).toFixed(1) : "", `${cfg.recent}d vs prior ${cfg.prior}d`, groupDuration(h).days, groupDuration(h).ongoing ? "ongoing" : "recovered", overdue(h) ? "yes" : "no", `${origin}/analytics?listing=${h.listingId}&days=${periodDays}`])));
    download("creativestudio-alert-history.csv", toCsv(rows));
  }
  const DAYS = 30;
  const dayList = Array.from({ length: DAYS + 1 }, (_, i) => dayKey(Date.now() - (DAYS - i) * 86400000));

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
              <label className="flex items-center justify-between text-sm">Recovery target
                <span className="flex items-center gap-2"><input type="number" min={1} max={90} className={`${inp} w-20`} value={target} onChange={(e) => setCfg({ recoveryTarget: Math.max(1, Math.min(90, +e.target.value || 1)) })} />days</span>
              </label>
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
          <h2 className="font-display text-2xl">Timeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">Last {DAYS} days. Red spans are active drops, green dots mark the linked recovery.</p>
          <div className="mt-4 space-y-2">
            {filtered.map((h) => (
              <div key={h.key} className="grid grid-cols-[180px_1fr] items-center gap-3 text-xs">
                <span className="truncate">{h.title} · <span className="capitalize">{h.metric}</span></span>
                <div className="relative h-5 rounded-sm bg-muted">
                  {h.triggers.map((t) => {
                    const s0 = Math.max(0, dayList.indexOf(t.date));
                    const e0 = t.recoveredAt ? dayList.indexOf(t.recoveredAt) : DAYS;
                    return (
                      <span key={t.date}>
                        <span title={`Drop ${(t.change * 100).toFixed(0)}% on ${t.date}`} className="absolute top-0 h-5 rounded-sm bg-destructive/60" style={{ left: `${(s0 / DAYS) * 100}%`, width: `${Math.max(1, ((e0 - s0) / DAYS) * 100)}%` }} />
                        {t.recoveredAt && <span title={`Recovered ${t.recoveredAt}`} className="absolute top-1 h-3 w-3 -translate-x-1/2 rounded-full bg-chart-2" style={{ left: `${(e0 / DAYS) * 100}%` }} />}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
            {filtered.length > 0 && <div className="grid grid-cols-[180px_1fr] text-xs text-muted-foreground"><span /><span className="flex justify-between"><span>{dayList[0]}</span><span>today</span></span></div>}
          </div>
        </div>

        <div className={card}>
          <h2 className="font-display text-2xl">Alert history</h2>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <select className={inp} value={fListing} onChange={(e) => { setFListing(e.target.value); setPage(1); }}><option value="all">All listings</option>{listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select>
            <select className={inp} value={fMetric} onChange={(e) => { setFMetric(e.target.value); setPage(1); }}><option value="all">All metrics</option>{METRICS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
            <select className={inp} value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(1); }}><option value="all">All statuses</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option></select>
            <input type="date" className={inp} value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From date" />
            <input type="date" className={inp} value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To date" />
            <select className={inp} value={sortBy} onChange={(e) => actions.setAlertSort({ ...alertSort, by: e.target.value as typeof sortBy })} aria-label="Sort"><option value="latest">Latest trigger</option><option value="repeats">Most repeats</option><option value="drop">Largest drop</option><option value="duration">Longest recovery</option><option value="ongoing">Ongoing, longest-running first</option></select>
            <button className={inp} onClick={() => actions.setAlertSort({ ...alertSort, dir: alertSort.dir === "desc" ? "asc" : "desc" })} aria-label="Toggle sort direction">{alertSort.dir === "desc" ? "↓ Desc" : "↑ Asc"}</button>
            <button className={inp} disabled={!filtered.length} onClick={() => setBulkAction("acknowledged")}>Acknowledge all ({filtered.length})</button>
            <button className={inp} disabled={!filtered.length} onClick={() => setBulkAction("resolved")}>Resolve all ({filtered.length})</button>
            <select className={inp} value={fRecovery} onChange={(e) => { setFRecovery(e.target.value); setPage(1); }} aria-label="Recovery status"><option value="all">Ongoing + recovered</option><option value="ongoing">Ongoing only</option><option value="recovered">Recovered only</option></select>
            <button className={inp} onClick={savePreset}>Save preset</button>
            <button onClick={exportCsv} disabled={!filtered.length} className="ml-auto rounded-full bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">Export CSV</button>
          </div>
          {alertPresets.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="text-muted-foreground">Presets:</span>
              {alertPresets.map((p) => (
                <span key={p.id} className="flex items-center gap-2 rounded-full bg-muted px-3 py-1">
                  <button onClick={() => { setFListing(p.listing); setFMetric(p.metric); setFStatus(p.status); setFrom(p.from); setTo(p.to); setFRecovery(p.recovery ?? "all"); setPage(1); }}>{p.name}</button>
                  <button aria-label="Delete preset" onClick={() => actions.deleteAlertPreset(p.id)} className="text-muted-foreground">×</button>
                </span>
              ))}
            </div>
          )}
          <div className="mt-4 divide-y divide-border border-y border-border">
            {pageItems.map((h) => {
              const st = review[h.key] ?? "open";
              const active = h.triggers.some((t) => !t.recoveredAt);
              return (
                <div key={h.key} className={`py-4 text-sm ${overdue(h) ? "border-l-4 border-destructive pl-3" : ""}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-medium">{h.title} · <span className="capitalize">{h.metric}</span></p>
                    <span className="text-muted-foreground">{h.triggers.length} trigger{h.triggers.length > 1 ? "s" : ""} · {cfg.recent}d vs prior {cfg.prior}d</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${groupDuration(h).ongoing ? "border border-destructive text-destructive" : "border border-border"}`} title="Recovery duration">⏱ {durLabel(groupDuration(h))}</span>
                    {overdue(h) && <span className="rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">Over {target}-day target</span>}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>{active ? "Still dropping" : "Recovered"}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${st === "open" ? "border border-border" : st === "resolved" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{st}</span>
                    <span className="ml-auto space-x-3">
                      <Link to="/analytics" search={{ listing: h.listingId, days: periodDays }} className="underline">View analytics</Link>
                      {st === "open" && <button onClick={() => actions.setReview(h.key, "acknowledged")} className="underline">Acknowledge</button>}
                      {st !== "resolved" && <button onClick={() => actions.setReview(h.key, "resolved")} className="underline">Resolve</button>}
                      {st !== "open" && <button onClick={() => actions.setReview(h.key, null)} className="text-muted-foreground underline">Reopen</button>}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{recoveryInfo(h)}</p>
                  <button onClick={() => setOpen(open.includes(h.key) ? open.filter((k) => k !== h.key) : [...open, h.key])} className="mt-2 text-xs underline" aria-expanded={open.includes(h.key)}>{open.includes(h.key) ? "Hide details" : "Show details"}</button>
                  {open.includes(h.key) && <p className="mt-2 text-xs font-medium">Recovery duration: {durLabel(groupDuration(h))}{groupDuration(h).ongoing ? ` (elapsed since ${groupDuration(h).first})` : ` (${groupDuration(h).first} → ${groupDuration(h).end})`}</p>}
                  {open.includes(h.key) && <ol className="mt-2 border-l-2 border-border pl-4">
                    {h.triggers.flatMap((t) => [{ d: t.date, kind: "drop" as const, c: t.change, ref: t.date }, ...(t.recoveredAt ? [{ d: t.recoveredAt, kind: "recovery" as const, c: t.recoveryChange!, ref: t.date }] : [])]).sort((a, b) => a.d.localeCompare(b.d)).map((ev) => (
                      <li key={ev.kind + ev.d} className="relative py-1"><span className={`absolute -left-[21px] top-2 h-2.5 w-2.5 rounded-full ${ev.kind === "drop" ? "bg-destructive" : "bg-chart-2"}`} />
                        <b>{ev.d}</b> — {ev.kind === "drop" ? `Drop triggered: ${(ev.c * 100).toFixed(0)}% (threshold −${cfg.thresholds[h.metric]}%)` : `Recovered: ${ev.c >= 0 ? "+" : ""}${(ev.c * 100).toFixed(0)}%, linked to drop on ${ev.ref} (${daysBetween(ev.ref, ev.d)} days)`}</li>
                    ))}
                  </ol>}
                  <ul className="mt-2 hidden space-y-1 pl-4">
                    {h.triggers.map((t) => (
                      <li key={t.date} className="flex flex-wrap gap-x-4">
                        <span>{t.date}: <span className="text-destructive">{(t.change * 100).toFixed(0)}%</span></span>
                        {t.recoveredAt
                          ? <span className="text-primary">↳ Recovered {t.recoveredAt} ({t.recoveryChange! >= 0 ? "+" : ""}{(t.recoveryChange! * 100).toFixed(0)}%, back above −{cfg.thresholds[h.metric]}%)</span>
                          : <span className="text-muted-foreground">↳ Not yet recovered</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <button disabled={curPage === 1} onClick={() => setPage(curPage - 1)} className={`${inp} disabled:opacity-40`}>Previous</button>
              <span>Page {curPage} of {pages} · {filtered.length} groups</span>
              <button disabled={curPage === pages} onClick={() => setPage(curPage + 1)} className={`${inp} disabled:opacity-40`}>Next</button>
            </div>
          )}
          {filtered.length === 0 && <p className="py-4 text-sm text-muted-foreground">No alerts match these filters.</p>}
        </div>
      </div>
      <AlertDialog open={!!bulkAction} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {filtered.length} alert group{filtered.length > 1 ? "s" : ""} as {bulkAction}?</AlertDialogTitle>
            <AlertDialogDescription>This applies to every group matching your current filters. You can undo right after.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={runBulk}>Confirm</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SiteShell>
  );
}
