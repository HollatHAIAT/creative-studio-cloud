import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { actions, DEMO_CREATOR, useAllListings, useStore, type Delivery, type Report, type ReportMetric } from "@/lib/store";
import { listingDaily, pct, SOURCES, sourceSplit, totals } from "@/lib/analytics";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Scheduled email reports — creativestudio" },
      { name: "description", content: "Schedule weekly or monthly listing performance emails with referral insights." },
      { property: "og:title", content: "Email reports — creativestudio" },
      { property: "og:description", content: "Weekly or monthly performance emails." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reports,
});

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ZONES = ["UTC", "Asia/Dubai", "Asia/Riyadh", "Africa/Cairo", "Asia/Beirut", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Tokyo"];

/** Next send as wall-clock time in the report's time zone. */
export function nextSend(r: Report, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: r.timezone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now).map((p) => [p.type, p.value])) as { year: string; month: string; day: string; hour: string; minute: string };
  const wallNow = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  const [h = 9, m = 0] = r.time.split(":").map(Number);
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day + i, h, m));
    const ok = r.frequency === "weekly" ? d.getUTCDay() === r.weekday : d.getUTCDate() === Math.min(r.monthday, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate());
    if (ok && d.getTime() > wallNow) return d.toLocaleString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) + ` (${r.timezone})`;
  }
  return "—";
}

const METRIC_OPTS: [ReportMetric, string][] = [["views", "Views"], ["favorites", "Favorites"], ["purchases", "Purchases"], ["conversion", "Conversion rate"], ["top", "Top listings"]];
const ALL_METRICS = METRIC_OPTS.map(([k]) => k);
const metricsOf = (r: Report) => r.metrics ?? ALL_METRICS;
const sourcesOf = (r: Report) => r.sources ?? [...SOURCES];

/** Sample delivery log until the email service is connected: past periods plus the upcoming send. */
function deliveries(r: Report): Delivery[] {
  if (r.history) return r.history;
  const step = r.frequency === "weekly" ? 7 : 30;
  const past: Delivery[] = [1, 2, 3, 4].map((i) => {
    const at = new Date(Date.now() - i * step * 86400000).toISOString().slice(0, 10) + " " + r.time;
    const failed = (r.id.charCodeAt(r.id.length - 1) + i) % 4 === 0;
    return failed ? { id: `${r.id}-${i}`, at, status: "failed", error: "Recipient mailbox unavailable" } : { id: `${r.id}-${i}`, at, status: "sent" };
  });
  return past;
}
function retry(r: Report, d: Delivery) {
  const list = deliveries(r).map((x) => x.id === d.id ? { ...x, status: "retrying" as const, error: undefined } : x);
  actions.saveReport({ ...r, history: list.map(({ error, ...x }) => (error ? { ...x, error } : x)) });
  toast("Retry queued — it will send once the email service is connected");
}

const blank = (): Report => ({ id: "", name: "Weekly performance", frequency: "weekly", weekday: 1, monthday: 1, time: "09:00", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", email: "", paused: false, includeSources: true, metrics: ALL_METRICS, sources: [...SOURCES] });

function Reports() {
  const { reports } = useStore();
  const [form, setForm] = useState<Report | null>(null);

  function save() {
    if (!form) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast.error("Enter a valid email address");
    if (!form.name.trim()) return toast.error("Give the report a name");
    if (metricsOf(form).length === 0) return toast.error("Pick at least one metric");
    actions.saveReport({ ...form, id: form.id || Date.now().toString(36), name: form.name.trim().slice(0, 80) });
    toast.success(form.id ? "Schedule updated" : "Report scheduled");
    setForm(null);
  }

  const f = "w-full rounded-sm border border-border bg-background px-3 py-2";
  return (
    <SiteShell>
      <PageTitle eyebrow="Analytics" title="Email reports" sub="Schedules are saved now. Emails will start sending once the email service is connected." />
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-8 flex gap-4"><button onClick={() => setForm(blank())} className="rounded-full bg-primary px-6 py-3 text-primary-foreground">New schedule</button><Link to="/analytics" className="self-center text-sm underline">Back to analytics</Link></div>

        {form && (
          <div className="mb-12 grid gap-8 lg:grid-cols-2">
            <div className="grid gap-4 rounded-sm border border-border bg-card p-6">
              <h2 className="font-display text-2xl">{form.id ? "Edit schedule" : "New schedule"}</h2>
              <label className="text-sm">Name<input className={f} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="text-sm">Send to<input type="email" className={f} value={form.email} placeholder="you@studio.com" onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <div className="grid grid-cols-2 gap-4">
                <label className="text-sm">Frequency<select className={f} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as Report["frequency"] })}><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
                {form.frequency === "weekly"
                  ? <label className="text-sm">Day<select className={f} value={form.weekday} onChange={(e) => setForm({ ...form, weekday: +e.target.value })}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
                  : <label className="text-sm">Day of month<select className={f} value={form.monthday} onChange={(e) => setForm({ ...form, monthday: +e.target.value })}>{Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label>}
                <label className="text-sm">Send time<input type="time" className={f} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value || "09:00" })} /></label>
                <label className="text-sm">Time zone<select className={f} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>{[...new Set([form.timezone, ...ZONES])].map((z) => <option key={z}>{z}</option>)}</select></label>
              </div>
              <fieldset className="text-sm"><legend className="mb-1">Metrics to include</legend>
                <div className="flex flex-wrap gap-3">{METRIC_OPTS.map(([k, label]) => <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={metricsOf(form).includes(k)} onChange={(e) => setForm({ ...form, metrics: e.target.checked ? [...metricsOf(form), k] : metricsOf(form).filter((x) => x !== k) })} />{label}</label>)}</div>
              </fieldset>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.includeSources} onChange={(e) => setForm({ ...form, includeSources: e.target.checked })} />Include referral-source insights</label>
              {form.includeSources && (
                <div className="flex flex-wrap gap-3 pl-6 text-sm">{SOURCES.map((src) => <label key={src} className="flex items-center gap-1"><input type="checkbox" checked={sourcesOf(form).includes(src)} onChange={(e) => setForm({ ...form, sources: e.target.checked ? [...sourcesOf(form), src] : sourcesOf(form).filter((x) => x !== src) })} />{src}</label>)}</div>
              )}
              <p className="text-sm text-muted-foreground">Next send: {nextSend(form)}</p>
              <div className="flex gap-3"><button onClick={save} className="rounded-full bg-primary px-6 py-3 text-primary-foreground">Save schedule</button><button onClick={() => setForm(null)} className="rounded-full border border-border px-6 py-3">Cancel</button></div>
            </div>
            <EmailPreview r={form} />
          </div>
        )}

        <div className="divide-y divide-border border-y border-border">
          {reports.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-4 py-4">
              <div className="flex-1">
                <p className="font-display text-xl">{r.name} {r.paused && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">Paused</span>}</p>
                <p className="text-sm text-muted-foreground">{r.frequency === "weekly" ? `Every ${WEEKDAYS[r.weekday]}` : `Monthly on day ${r.monthday}`} at {r.time} · {r.email}</p>
                <p className="text-sm">{r.paused ? "Not scheduled while paused" : `Next send: ${nextSend(r)}`}</p>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Delivery history (sample)</summary>
                  <ul className="mt-2 space-y-1">
                    {!r.paused && <li className="flex gap-3"><span className="rounded-full bg-muted px-2 text-xs">upcoming</span>{nextSend(r)}</li>}
                    {deliveries(r).map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center gap-3">
                        <span className={`rounded-full px-2 text-xs ${d.status === "sent" ? "bg-primary text-primary-foreground" : d.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>{d.status}</span>
                        {d.at} ({r.timezone})
                        {d.error && <span className="text-muted-foreground">— {d.error}</span>}
                        {d.status === "failed" && <button onClick={() => retry(r, d)} className="underline">Retry</button>}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
              <button onClick={() => actions.saveReport({ ...r, paused: !r.paused })} className="rounded-full border border-border px-4 py-2 text-sm">{r.paused ? "Resume" : "Pause"}</button>
              <button onClick={() => setForm(r)} className="rounded-full border border-border px-4 py-2 text-sm">Edit</button>
              <button onClick={() => { if (confirm(`Delete “${r.name}”?`)) actions.deleteReport(r.id); }} className="rounded-full border border-destructive px-4 py-2 text-sm text-destructive">Delete</button>
            </div>
          ))}
          {reports.length === 0 && <p className="py-6 text-muted-foreground">No scheduled reports yet.</p>}
        </div>
      </div>
    </SiteShell>
  );
}

function EmailPreview({ r }: { r: Report }) {
  const days = r.frequency === "weekly" ? 7 : 30;
  const listings = useAllListings().filter((l) => l.creatorId === DEMO_CREATOR && l.status === "published");
  const per = listings.map((l) => ({ l, ...totals(listingDaily(l.id, days)) })).sort((a, b) => b.purchases - a.purchases);
  const sum = per.reduce((a, p) => ({ v: a.v + p.views, f: a.f + p.favorites, b: a.b + p.purchases }), { v: 0, f: 0, b: 0 });
  const src = SOURCES.map((s) => ({ s, v: Math.round(per.reduce((a, p) => a + p.views * sourceSplit(p.l.id).find((x) => x.source === s)!.share, 0)) })).sort((a, b) => b.v - a.v);
  return (
    <div className="rounded-sm border border-border bg-muted p-4">
      <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Email preview</p>
      <div className="rounded-sm bg-card p-6 text-sm shadow-sm">
        <p className="text-muted-foreground">To: {r.email || "you@studio.com"}</p>
        <p className="mb-4 text-muted-foreground">Subject: Your {r.frequency} creativestudio report — {r.name}</p>
        <p className="font-display text-2xl">creative<span className="text-primary">studio</span></p>
        <p className="mt-3">Here's how your listings did over the last {days} days.</p>
        <div className="my-4 grid grid-cols-3 gap-2 text-center">
          {([["views", "Views", sum.v.toLocaleString()], ["favorites", "Favorites", sum.f.toLocaleString()], ["purchases", "Purchases", sum.b.toLocaleString()], ["conversion", "Conversion", `${pct(sum.b, sum.v).toFixed(2)}%`]] as const).filter(([k]) => metricsOf(r).includes(k)).map(([, k, v]) => [k, v]).map(([k, v]) => <div key={k} className="rounded-sm bg-muted p-3"><p className="font-display text-xl">{v}</p><p className="text-xs text-muted-foreground">{k}</p></div>)}
        </div>
        {metricsOf(r).includes("top") && (<><p className="font-medium">Top listings</p>
        <ol className="mb-4 list-decimal pl-5">{per.slice(0, 3).map((p) => <li key={p.l.id}>{p.l.title} — {p.purchases} sales, {pct(p.purchases, p.views).toFixed(2)}% conversion</li>)}</ol></>)}
        {r.includeSources && (<><p className="font-medium">Where visitors came from</p><ul className="pl-5">{src.filter((x) => sourcesOf(r).includes(x.s)).map((x) => <li key={x.s}>{x.s}: {pct(x.v, sum.v).toFixed(0)}% of views</li>)}</ul></>)}
      </div>
    </div>
  );
}
