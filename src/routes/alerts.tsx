import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { actions, DEMO_CREATOR, useAllListings, useStore } from "@/lib/store";
import { compliance, daysBetween, daysPast, defaultTargets, durLabel, groupDuration, SEVERITIES, severity, targetFor } from "@/lib/alert-rules";
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

const METRICS: Metric[] = ["views", "favorites", "purchases"];
const card = "rounded-sm border border-border bg-card p-6";
const inp = "rounded-sm border border-border bg-background px-3 py-2";

function Alerts() {
  const { alerts: cfg, review, notify, alertSort, alertPresets, owners, responder, maintenance } = useStore();
  const [cFrom, setCFrom] = useState("");
  const [cTo, setCTo] = useState("");
  const [cListing, setCListing] = useState("all");
  const [cMetric, setCMetric] = useState("all");
  const [mw, setMw] = useState({ start: "", end: "", note: "" });
  const inMaint = maintenance.some((w) => Date.parse(w.start) <= Date.now() && Date.now() <= Date.parse(w.end));
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
  const targets = cfg.recoveryTargets ?? defaultTargets;
  const overdue = (g: Parameters<typeof groupDuration>[0]) => daysPast(g, cfg) > 0;

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
    const rows: (string | number)[][] = [["Listing", "Metric", "Review status", "Trigger date", "Change %", "Recovered on", "Recovery change %", "Comparison", "Group duration (days)", "Group duration status", "Severity", "Recovery target (days)", "Days past target", "Owner", "Analytics link"]];
    filtered.forEach((h) => h.triggers.forEach((t) => rows.push([h.title, h.metric, review[h.key] ?? "open", t.date, (t.change * 100).toFixed(1), t.recoveredAt ?? "", t.recoveryChange != null ? (t.recoveryChange * 100).toFixed(1) : "", `${cfg.recent}d vs prior ${cfg.prior}d`, groupDuration(h).days, groupDuration(h).ongoing ? "ongoing" : "recovered", severity(h), targetFor(h, cfg), daysPast(h, cfg), owners[h.key]?.name ?? "", `${origin}/analytics?listing=${h.listingId}&days=${periodDays}`])));
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
              <p className="pt-2 text-sm font-medium">Recovery targets by severity</p>
              {SEVERITIES.map((sv) => (
                <label key={sv} className="flex items-center justify-between text-sm capitalize">{sv} <span className="text-xs normal-case text-muted-foreground">{sv === "critical" ? "drop ≥ 60%" : sv === "high" ? "drop 45–60%" : "smaller drops"}</span>
                  <span className="flex items-center gap-2"><input type="number" min={1} max={90} className={`${inp} w-20`} value={targets[sv]} onChange={(e) => setCfg({ recoveryTargets: { ...targets, [sv]: Math.max(1, Math.min(90, +e.target.value || 1)) } })} />days</span>
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
              <label className="flex items-center justify-between gap-3">Overdue reminder cooldown
                <select className={inp} value={notify.cooldownHours ?? 24} onChange={(e) => actions.setNotify({ ...notify, cooldownHours: +e.target.value })}>
                  {[1, 6, 12, 24, 48, 168].map((h) => <option key={h} value={h}>{h < 24 ? `${h} hours` : h === 168 ? "1 week" : `${h / 24} day${h > 24 ? "s" : ""}`}</option>)}
                </select>
              </label>
              <p className="text-xs text-muted-foreground">An ongoing group past its recovery target notifies you once, then again only after this cooldown.</p>
              <div className="border-t border-border pt-3">
                <p className="font-medium">Maintenance windows {inMaint && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">Active now — notifications paused</span>}</p>
                <p className="text-xs text-muted-foreground">Recovery-target notifications are paused during these times.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input type="datetime-local" className={inp} value={mw.start} onChange={(e) => setMw({ ...mw, start: e.target.value })} aria-label="Window start" />
                  <input type="datetime-local" className={inp} value={mw.end} onChange={(e) => setMw({ ...mw, end: e.target.value })} aria-label="Window end" />
                  <input className={inp} placeholder="Note (optional)" maxLength={60} value={mw.note} onChange={(e) => setMw({ ...mw, note: e.target.value })} />
                  <button className={inp} onClick={() => { if (!mw.start || !mw.end || mw.end <= mw.start) { toast.error("End must be after start"); return; } actions.saveMaintenance({ id: Date.now().toString(36), ...mw }); setMw({ start: "", end: "", note: "" }); }}>Add window</button>
                </div>
                <ul className="mt-2 space-y-1">{maintenance.map((w) => <li key={w.id} className="flex gap-2">{w.start.replace("T", " ")} → {w.end.replace("T", " ")}{w.note && ` · ${w.note}`}<button onClick={() => actions.deleteMaintenance(w.id)} className="text-muted-foreground underline">Remove</button></li>)}</ul>
              </div>
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

        {(() => {
          const cGroups = history.filter((h) => (cListing === "all" || h.listingId === cListing) && (cMetric === "all" || h.metric === cMetric)).map((h) => ({ ...h, triggers: h.triggers.filter((t) => (!cFrom || t.date >= cFrom) && (!cTo || t.date <= cTo)) })).filter((h) => h.triggers.length);
          const c = compliance(cGroups, cfg);
          const exportCompliance = () => download("creativestudio-recovery-compliance.csv", toCsv([
            ["Filters", `listing=${cListing}`, `metric=${cMetric}`, `from=${cFrom || "any"}`, `to=${cTo || "any"}`], [],
            ["Overall", "Met", "Total", "% met"], ["All", c.overall.met, c.overall.total, c.overall.pct.toFixed(1)], [],
            ["Week starting", "Met", "Total", "% met"], ...c.weeks.map((w) => [w.week, w.met, w.total, w.pct.toFixed(1)]), [],
            ["Severity", "Target (days)", "Met", "Total", "% met"], ...c.bySeverity.map((x) => [x.severity, x.target, x.met, x.total, x.pct.toFixed(1)]),
          ]));
          return (
        <div className={card}>
          <h2 className="font-display text-2xl">Recovery-target compliance</h2>
          <p className="mt-1 text-sm text-muted-foreground">Share of drop episodes that recovered within their severity target. Episodes still inside their target aren't counted yet.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <select className={inp} value={cListing} onChange={(e) => setCListing(e.target.value)} aria-label="Compliance listing"><option value="all">All listings</option>{listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select>
            <select className={inp} value={cMetric} onChange={(e) => setCMetric(e.target.value)} aria-label="Compliance metric"><option value="all">All metrics</option>{METRICS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
            <input type="date" className={inp} value={cFrom} onChange={(e) => setCFrom(e.target.value)} aria-label="Compliance from" />
            <input type="date" className={inp} value={cTo} onChange={(e) => setCTo(e.target.value)} aria-label="Compliance to" />
            <button onClick={exportCompliance} className="ml-auto rounded-full bg-primary px-4 py-2 text-primary-foreground">Export compliance CSV</button>
          </div>
          <p className="mt-4 font-display text-4xl">{c.overall.pct.toFixed(0)}% <span className="text-base text-muted-foreground">met ({c.overall.met}/{c.overall.total})</span></p>
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">By week</p>
              <div className="flex h-32 items-end gap-2">
                {c.weeks.map((w) => (
                  <div key={w.week} className="flex flex-1 flex-col items-center gap-1 text-xs" title={`${w.met}/${w.total} met`}>
                    <span>{w.pct.toFixed(0)}%</span>
                    <div className="w-full rounded-t-sm bg-primary" style={{ height: `${Math.max(4, w.pct)}%` }} />
                    <span className="text-muted-foreground">{w.week.slice(5)}</span>
                  </div>
                ))}
                {c.weeks.length === 0 && <p className="text-sm text-muted-foreground">No completed episodes yet.</p>}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">By severity</p>
              <div className="space-y-3">
                {c.bySeverity.map((sv) => (
                  <div key={sv.severity} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
                    <span className="capitalize">{sv.severity} <span className="text-xs text-muted-foreground">≤{sv.target}d</span></span>
                    <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${sv.pct}%` }} /></div>
                    <span className="text-muted-foreground">{sv.total ? `${sv.pct.toFixed(0)}% (${sv.met}/${sv.total})` : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>); })()}

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
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{severity(h)}</span>
                    {overdue(h) && <span className="rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">{daysPast(h, cfg)}d past {targetFor(h, cfg)}-day target</span>}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>{active ? "Still dropping" : "Recovered"}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${st === "open" ? "border border-border" : st === "resolved" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{st}</span>
                    {owners[h.key] ? <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">Handled by {owners[h.key]!.name} · since {new Date(owners[h.key]!.at).toLocaleDateString()}</span> : groupDuration(h).ongoing && <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">Unclaimed</span>}
                    <span className="ml-auto space-x-3">
                      {groupDuration(h).ongoing && (owners[h.key]
                        ? <button onClick={() => actions.release(h.key)} className="underline">Release</button>
                        : <button onClick={() => { const n = prompt("Your name", responder)?.trim(); if (n) { actions.claim(h.key, n.slice(0, 40)); if (st === "open") actions.setReview(h.key, "acknowledged"); toast.success(`Claimed by ${n}`); } }} className="underline">Claim</button>)}
                      <Link to="/analytics" search={{ listing: h.listingId, days: periodDays }} className="underline">View analytics</Link>
                      {st === "open" && <button onClick={() => actions.setReview(h.key, "acknowledged")} className="underline">Acknowledge</button>}
                      {st !== "resolved" && <button onClick={() => actions.setReview(h.key, "resolved")} className="underline">Resolve</button>}
                      {st !== "open" && <button onClick={() => actions.setReview(h.key, null)} className="text-muted-foreground underline">Reopen</button>}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{recoveryInfo(h)}</p>
                  <button onClick={() => setOpen(open.includes(h.key) ? open.filter((k) => k !== h.key) : [...open, h.key])} className="mt-2 text-xs underline" aria-expanded={open.includes(h.key)}>{open.includes(h.key) ? "Hide details" : "Show details"}</button>
                  {open.includes(h.key) && <p className="mt-2 text-xs font-medium">Recovery duration: {durLabel(groupDuration(h))}{groupDuration(h).ongoing ? ` (elapsed since ${groupDuration(h).first})` : ` (${groupDuration(h).first} → ${groupDuration(h).end})`} · <span className="capitalize">{severity(h)}</span> target {targetFor(h, cfg)} days{groupDuration(h).ongoing && (daysPast(h, cfg) > 0 ? <span className="text-destructive"> · {daysPast(h, cfg)} days past target</span> : <span> · {targetFor(h, cfg) - groupDuration(h).days} days left</span>)}</p>}
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
