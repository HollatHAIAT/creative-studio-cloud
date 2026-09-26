import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { T } from "@/lib/i18n";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { actions, DEMO_CREATOR, useAllListings, useStore } from "@/lib/store";
import { SEVERITIES } from "@/lib/alert-rules";
import { dayKey, download, toCsv } from "@/lib/analytics";
import { breaches, buildDeliveries, CHANNELS, errorBudget, inRange, perf, today, type Channel, type Perf, type RouteRule, type Slo } from "@/lib/delivery";

export const Route = createFileRoute("/delivery")({
  head: () => ({
    meta: [
      { title: "Alert delivery — creativestudio" },
      { name: "description", content: "Route alerts by listing and severity, manage retries and fallbacks, and track delivery performance and SLOs." },
      { property: "og:title", content: "Alert delivery — creativestudio" },
      { property: "og:description", content: "Alert routing, retries, delivery performance and SLOs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Delivery,
});

const card = "rounded-sm border border-border bg-card p-6";
const inp = "rounded-sm border border-border bg-background px-2 py-1.5 text-sm";
const DAY = 86400000;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

function Delivery() {
  const st = useStore();
  const listings = useAllListings().filter((l) => l.creatorId === DEMO_CREATOR && l.status !== "archived");
  const name = (id: string) => (id === "all" ? "All listings" : listings.find((l) => l.id === id)?.title ?? id);
  const records = useMemo(() => buildDeliveries(listings, st.alerts, st.routes, st.retry, st.manualDeliveries),
    [listings.map((l) => l.id).join(), JSON.stringify([st.alerts, st.routes, st.retry, st.manualDeliveries])]);

  // ---- log filters
  const [fCh, setFCh] = useState("all");
  const [fOut, setFOut] = useState("all");
  const [page, setPage] = useState(1);
  const logRows = records.filter((r) => (fOut === "all" || r.outcome === fOut) && (fCh === "all" || r.attempts.some((a) => a.channel === fCh)));
  const pages = Math.max(1, Math.ceil(logRows.length / 8));
  const cur = Math.min(page, pages);

  // ---- performance
  const [range, setRange] = useState(14);
  const end = today();
  const now = records.filter((r) => inRange(r, end - range * DAY, end));
  const prev = records.filter((r) => inRange(r, end - 2 * range * DAY, end - range * DAY));
  const dims = {
    Channel: (_: unknown, a: { channel: Channel }) => a.channel,
    Listing: (r: { service: string }) => name(r.service),
    Severity: (r: { severity: string }) => r.severity,
  } as const;
  const trend = useMemo(() => {
    const out: { date: string; success: number; latency: number; retries: number }[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = dayKey(end - (i + 1) * DAY);
      const p = perf(now.filter((r) => r.attempts.some((a) => dayKey(a.at) === d)), () => "x")[0];
      out.push({ date: d.slice(5), success: p ? +p.success.toFixed(1) : 0, latency: p ? +p.latency.toFixed(1) : 0, retries: p?.retries ?? 0 });
    }
    return out;
  }, [JSON.stringify(now.map((r) => r.id)), range]);

  function exportPerf() {
    const rows: (string | number)[][] = [["Dimension", "Value", "Attempts", "Delivered", "Success %", "Prev success %", "Avg latency (s)", "Prev latency (s)", "Retries", "Prev retries"]];
    (Object.keys(dims) as (keyof typeof dims)[]).forEach((k) => {
      const p0 = perf(prev, dims[k] as never);
      perf(now, dims[k] as never).forEach((p) => { const q = p0.find((x) => x.key === p.key); rows.push([k, p.key, p.sent, p.delivered, p.success.toFixed(1), q ? q.success.toFixed(1) : "", p.latency.toFixed(2), q ? q.latency.toFixed(2) : "", p.retries, q?.retries ?? ""]); });
    });
    download(`creativestudio-delivery-performance-${range}d.csv`, toCsv(rows));
  }

  // ---- SLOs + breaches
  const allBreaches = useMemo(() => breaches(st.slos, records), [JSON.stringify(st.slos), JSON.stringify(records.map((r) => r.id + r.outcome))]);
  const [bCh, setBCh] = useState("all");
  const [bSvc, setBSvc] = useState("all");
  const [bSev, setBSev] = useState("all");
  const [bStatus, setBStatus] = useState("all");
  const [recurring, setRecurring] = useState(false);
  const countBySlo = allBreaches.reduce<Record<string, number>>((m, b) => ({ ...m, [b.slo.id]: (m[b.slo.id] ?? 0) + 1 }), {});
  const shownBreaches = allBreaches.filter((b) => (bCh === "all" || b.slo.channel === bCh) && (bSvc === "all" || b.slo.service === bSvc) && (bSev === "all" || b.slo.severity === bSev)
    && (bStatus === "all" || (bStatus === "ongoing" ? !b.end : !!b.end)) && (!recurring || (countBySlo[b.slo.id] ?? 0) > 1));
  const ongoing = allBreaches.filter((b) => !b.end);

  // Breach notifications with dedup: one per breach episode, optional re-notify interval.
  useEffect(() => {
    const { destinations, renotifyHours } = st.breachNotify;
    if (!destinations.length) return;
    const due = ongoing.filter((b) => { const t = st.breachNotified[b.id]; return !t || (renotifyHours > 0 && Date.now() - t > renotifyHours * 3600000); });
    if (!due.length) return;
    actions.markBreachNotified(due.map((b) => b.id));
    const others = destinations.filter((d) => d !== "In-app");
    if (destinations.includes("In-app")) toast.error(`${due.length} delivery SLO breach${due.length > 1 ? "es" : ""} in progress`, { description: due.slice(0, 3).map((b) => `${b.slo.channel} · ${name(b.slo.service)} · ${b.slo.severity} since ${b.start}`).join(" — ") + (others.length ? ` · also queued to ${others.join(", ")}` : ""), duration: 12000 });
  }, [JSON.stringify(ongoing.map((b) => b.id)), JSON.stringify(st.breachNotify)]);

  const updRoute = (id: string, patch: Partial<RouteRule>) => actions.setRoutes(st.routes.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const updSlo = (id: string, patch: Partial<Slo>) => actions.setSlos(st.slos.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const svcOpts = [<option key="all" value="all">All listings</option>, ...listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)];
  const sevOpts = [<option key="all" value="all">All severities</option>, ...SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)];
  const chOpts = CHANNELS.map((c) => <option key={c}>{c}</option>);

  return (
    <SiteShell>
      <PageTitle eyebrow="Alerts" title={<T k="delivery.title" />} sub="Where alerts go, what happens when a channel fails, and how reliably they arrive. Delivery results are simulated until real channels are connected." />
      <div className="mx-auto max-w-7xl space-y-8 px-6">
        <Link to="/alerts" className="text-sm underline">Back to alerts</Link>

        {ongoing.length > 0 && (
          <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <b className="text-destructive">{ongoing.length} SLO breach{ongoing.length > 1 ? "es" : ""} ongoing:</b> {ongoing.map((b) => `${b.slo.channel} / ${name(b.slo.service)} / ${b.slo.severity} (since ${b.start})`).join("; ")}
          </div>
        )}

        {/* Routing */}
        <div className={card}>
          <h2 className="font-display text-2xl">Routing rules</h2>
          <p className="mt-1 text-sm text-muted-foreground">The most specific matching rule wins (listing + severity, then listing, then severity, then catch-all). If the primary channel fails after all retries, fallbacks are tried in order.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-start text-muted-foreground"><tr><th className="py-2">Listing</th><th>Severity</th><th>Responder</th><th>Primary</th><th>Fallbacks (in order)</th><th /></tr></thead>
              <tbody>
                {st.routes.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="py-2"><select className={inp} value={r.service} onChange={(e) => updRoute(r.id, { service: e.target.value })}>{svcOpts}</select></td>
                    <td className="py-2"><select className={inp} value={r.severity} onChange={(e) => updRoute(r.id, { severity: e.target.value as RouteRule["severity"] })}>{sevOpts}</select></td>
                    <td className="py-2"><input className={`${inp} w-28`} value={r.responder} maxLength={40} onChange={(e) => updRoute(r.id, { responder: e.target.value })} /></td>
                    <td className="py-2"><select className={inp} value={r.primary} onChange={(e) => updRoute(r.id, { primary: e.target.value as Channel, fallbacks: r.fallbacks.filter((f) => f !== e.target.value) })}>{chOpts}</select></td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        {CHANNELS.filter((c) => c !== r.primary).map((c) => {
                          const i = r.fallbacks.indexOf(c);
                          return <label key={c} className="flex items-center gap-1"><input type="checkbox" checked={i >= 0} onChange={(e) => updRoute(r.id, { fallbacks: e.target.checked ? [...r.fallbacks, c] : r.fallbacks.filter((f) => f !== c) })} />{c}{i >= 0 && <span className="text-xs text-muted-foreground">#{i + 1}</span>}</label>;
                        })}
                      </div>
                    </td>
                    <td className="py-2 text-end"><button onClick={() => actions.setRoutes(st.routes.filter((x) => x.id !== r.id))} className="text-muted-foreground underline">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <button className={inp} onClick={() => actions.setRoutes([...st.routes, { id: uid(), service: "all", severity: "all", responder: st.responder || "You", primary: "Email", fallbacks: ["In-app"] }])}>Add rule</button>
            <span className="ms-auto">Retry every <input type="number" min={1} max={120} className={`${inp} w-16`} value={st.retry.intervalMin} onChange={(e) => actions.setRetry({ ...st.retry, intervalMin: Math.max(1, Math.min(120, +e.target.value || 1)) })} /> min, up to <input type="number" min={1} max={10} className={`${inp} w-14`} value={st.retry.maxAttempts} onChange={(e) => actions.setRetry({ ...st.retry, maxAttempts: Math.max(1, Math.min(10, +e.target.value || 1)) })} /> attempts per channel</span>
          </div>
        </div>

        {/* Delivery log */}
        <div className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="me-auto font-display text-2xl">Delivery status</h2>
            <select className={inp} value={fCh} onChange={(e) => { setFCh(e.target.value); setPage(1); }}><option value="all">All channels</option>{chOpts}</select>
            <select className={inp} value={fOut} onChange={(e) => { setFOut(e.target.value); setPage(1); }}><option value="all">All outcomes</option><option value="delivered">Delivered</option><option value="exhausted">Retries exhausted</option></select>
          </div>
          <div className="mt-4 divide-y divide-border border-y border-border text-sm">
            {logRows.slice((cur - 1) * 8, cur * 8).map((r) => {
              const chans = [...new Set(r.attempts.map((a) => a.channel))];
              return (
                <div key={r.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <b>{r.title}</b><span className="capitalize">{r.metric}</span><span className="rounded-full bg-muted px-2 text-xs capitalize">{r.severity}</span>
                    <span className="text-muted-foreground">{r.date} → {r.responder}</span>
                    {r.outcome === "delivered"
                      ? <span className="ms-auto rounded-full bg-primary px-2 text-xs text-primary-foreground">Delivered via {r.deliveredVia}{r.manual ? " (manual retry)" : ""} after {r.attempts.length} attempt{r.attempts.length > 1 ? "s" : ""}</span>
                      : <span className="ms-auto rounded-full bg-destructive px-2 text-xs text-destructive-foreground">Retries exhausted on {chans.join(", ")} — not delivered</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {chans.map((c) => {
                      const at = r.attempts.filter((a) => a.channel === c);
                      const ok = at.some((a) => a.ok);
                      return (
                        <span key={c} className={`flex items-center gap-2 rounded-sm border px-2 py-1 text-xs ${ok ? "border-primary" : "border-destructive/50"}`} title={at.map((a) => `#${a.n} ${a.ok ? "ok" : a.error}`).join("\n")}>
                          {c}: {ok ? `sent (${at.length} attempt${at.length > 1 ? "s" : ""})` : `failed ×${at.length} — ${at[at.length - 1]?.error}`}
                          {!ok && r.outcome === "exhausted" && <button onClick={() => { actions.manualRetry(r.id, c); toast.success(`Retried via ${c}`); }} className="underline">Retry</button>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {pages > 1 && <div className="mt-3 flex items-center justify-center gap-3 text-sm"><button className={inp} disabled={cur === 1} onClick={() => setPage(cur - 1)}>Previous</button>Page {cur} of {pages}<button className={inp} disabled={cur === pages} onClick={() => setPage(cur + 1)}>Next</button></div>}
        </div>

        {/* Performance */}
        <div className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="me-auto font-display text-2xl">Delivery performance</h2>
            <select className={inp} value={range} onChange={(e) => setRange(+e.target.value)}>{[7, 14, 30].map((d) => <option key={d} value={d}>Last {d} days vs previous {d}</option>)}</select>
            <button onClick={exportPerf} className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">Export CSV</button>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis yAxisId="l" domain={[0, 100]} fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis yAxisId="r" orientation="right" fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Legend />
                <Line yAxisId="l" dataKey="success" name="Success %" stroke="var(--primary)" dot={false} strokeWidth={2} />
                <Line yAxisId="r" dataKey="latency" name="Latency (s)" stroke="var(--secondary)" dot={false} strokeWidth={2} />
                <Line yAxisId="r" dataKey="retries" name="Retries" stroke="var(--chart-4)" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {(Object.keys(dims) as (keyof typeof dims)[]).map((k) => <PerfTable key={k} title={`By ${k.toLowerCase()}`} now={perf(now, dims[k] as never)} prev={perf(prev, dims[k] as never)} />)}
          </div>
        </div>

        {/* SLOs */}
        <div className={card}>
          <h2 className="font-display text-2xl">Delivery SLOs &amp; error budget</h2>
          <p className="mt-1 text-sm text-muted-foreground">Error budget = failures allowed by the success target over the last {range} days. Burn rate above 1× means the budget runs out before the period ends.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-start text-muted-foreground"><tr><th className="py-2">Channel</th><th>Listing</th><th>Severity</th><th>Min success %</th><th>Max latency (s)</th><th>Budget left</th><th>Burn rate</th><th /></tr></thead>
              <tbody>
                {st.slos.map((s) => {
                  const eb = errorBudget(s, now);
                  return (
                    <tr key={s.id} className="border-t border-border">
                      <td className="py-2"><select className={inp} value={s.channel} onChange={(e) => updSlo(s.id, { channel: e.target.value as Slo["channel"] })}><option value="all">All channels</option>{chOpts}</select></td>
                      <td><select className={inp} value={s.service} onChange={(e) => updSlo(s.id, { service: e.target.value })}>{svcOpts}</select></td>
                      <td><select className={inp} value={s.severity} onChange={(e) => updSlo(s.id, { severity: e.target.value as Slo["severity"] })}>{sevOpts}</select></td>
                      <td><input type="number" min={50} max={99.9} step={0.5} className={`${inp} w-20`} value={s.minSuccess} onChange={(e) => updSlo(s.id, { minSuccess: Math.max(50, Math.min(99.9, +e.target.value || 50)) })} /></td>
                      <td><input type="number" min={0.1} max={120} step={0.5} className={`${inp} w-20`} value={s.maxLatency} onChange={(e) => updSlo(s.id, { maxLatency: Math.max(0.1, +e.target.value || 1) })} /></td>
                      <td><span className={eb.remaining <= 0 ? "font-medium text-destructive" : ""}>{isFinite(eb.remaining) ? `${eb.remaining.toFixed(0)}%` : "0%"}</span> <span className="text-xs text-muted-foreground">({eb.failed}/{eb.allowed} failures)</span></td>
                      <td className={eb.burn > 1 ? "font-medium text-destructive" : ""}>{eb.burn.toFixed(2)}×</td>
                      <td className="text-end"><button onClick={() => actions.setSlos(st.slos.filter((x) => x.id !== s.id))} className="text-muted-foreground underline">Remove</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <button className={inp} onClick={() => actions.setSlos([...st.slos, { id: uid(), channel: "all", service: "all", severity: "all", minSuccess: 90, maxLatency: 5 }])}>Add SLO</button>
            <span className="ms-auto">Breach notifications to:</span>
            {CHANNELS.map((c) => <label key={c} className="flex items-center gap-1"><input type="checkbox" checked={st.breachNotify.destinations.includes(c)} onChange={(e) => actions.setBreachNotify({ ...st.breachNotify, destinations: e.target.checked ? [...st.breachNotify.destinations, c] : st.breachNotify.destinations.filter((d) => d !== c) })} />{c}</label>)}
            <label className="flex items-center gap-2">Deduplicate
              <select className={inp} value={st.breachNotify.renotifyHours} onChange={(e) => actions.setBreachNotify({ ...st.breachNotify, renotifyHours: +e.target.value })}>
                <option value={0}>Once per breach</option><option value={6}>Remind every 6h</option><option value={24}>Remind daily</option>
              </select>
            </label>
          </div>
        </div>

        {/* Breach history */}
        <div className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="me-auto font-display text-2xl">SLO breach history</h2>
            <select className={inp} value={bCh} onChange={(e) => setBCh(e.target.value)}><option value="all">All channels</option>{chOpts}</select>
            <select className={inp} value={bSvc} onChange={(e) => setBSvc(e.target.value)}>{svcOpts}</select>
            <select className={inp} value={bSev} onChange={(e) => setBSev(e.target.value)}>{sevOpts}</select>
            <select className={inp} value={bStatus} onChange={(e) => setBStatus(e.target.value)}><option value="all">Ongoing + recovered</option><option value="ongoing">Ongoing</option><option value="recovered">Recovered</option></select>
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />Recurring only</label>
          </div>
          <table className="mt-4 w-full text-sm">
            <thead className="text-start text-muted-foreground"><tr><th className="py-2">Started</th><th>Recovered</th><th>Channel</th><th>Listing</th><th>Severity</th><th>Violated</th><th>Worst</th><th>Repeats</th></tr></thead>
            <tbody>
              {shownBreaches.slice(0, 50).map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="py-2">{b.start}</td>
                  <td>{b.end ?? <span className="text-destructive">Ongoing</span>}</td>
                  <td>{b.slo.channel === "all" ? "All" : b.slo.channel}</td><td>{name(b.slo.service)}</td><td className="capitalize">{b.slo.severity}</td>
                  <td>{b.kind.join(" + ")}</td>
                  <td>{b.kind.includes("success") && `${b.worstSuccess.toFixed(0)}% success `}{b.kind.includes("latency") && `${b.worstLatency.toFixed(1)}s`}</td>
                  <td>{countBySlo[b.slo.id]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shownBreaches.length === 0 && <p className="py-3 text-sm text-muted-foreground">No breaches match these filters.</p>}
        </div>
      </div>
    </SiteShell>
  );
}

function PerfTable({ title, now, prev }: { title: string; now: Perf[]; prev: Perf[] }) {
  const delta = (a: number, b: number | undefined, suffix: string, invert = false) => {
    if (b == null) return null;
    const d = a - b; if (Math.abs(d) < 0.05) return <span className="text-xs text-muted-foreground"> ±0</span>;
    const good = invert ? d < 0 : d > 0;
    return <span className={`text-xs ${good ? "text-primary" : "text-destructive"}`}> {d > 0 ? "▲" : "▼"}{Math.abs(d).toFixed(1)}{suffix}</span>;
  };
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <table className="w-full text-xs">
        <thead className="text-start text-muted-foreground"><tr><th className="py-1" /><th>Success</th><th>Latency</th><th>Retries</th></tr></thead>
        <tbody>
          {now.map((p) => { const q = prev.find((x) => x.key === p.key); return (
            <tr key={p.key} className="border-t border-border">
              <td className="py-1.5 capitalize">{p.key}</td>
              <td>{p.success.toFixed(0)}%{delta(p.success, q?.success, "pt")}</td>
              <td>{p.latency.toFixed(1)}s{delta(p.latency, q?.latency, "s", true)}</td>
              <td>{p.retries}{delta(p.retries, q?.retries, "", true)}</td>
            </tr>
          ); })}
        </tbody>
      </table>
    </div>
  );
}
