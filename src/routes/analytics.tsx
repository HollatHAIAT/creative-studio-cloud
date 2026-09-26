import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Download, Trophy, TrendingDown } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { categories } from "@/lib/data";
import { actions, DEMO_CREATOR, useAllListings, useStore } from "@/lib/store";
import { detectDrops, download, listingDaily, pct, SOURCES, sourceSplit, toCsv, totals } from "@/lib/analytics";

export const Route = createFileRoute("/analytics")({
  validateSearch: (s: Record<string, unknown>): { listing?: string; days?: number } => ({
    ...(typeof s["listing"] === "string" ? { listing: s["listing"] } : {}),
    ...(Number(s["days"]) > 0 ? { days: Number(s["days"]) } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Listing analytics — creativestudio" },
      { name: "description", content: "Views, favorites, purchase conversions, trends and referral sources for your listings." },
      { property: "og:title", content: "Listing analytics — creativestudio" },
      { property: "og:description", content: "Track how your listings perform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Analytics,
});

const RANGES = [7, 14, 30, 90];

function Analytics() {
  const all = useAllListings().filter((l) => l.creatorId === DEMO_CREATOR);
  const { views: saved, alerts: alertCfg } = useStore();
  const search = Route.useSearch();
  const [days, setDays] = useState(search.days ?? 30);
  const [only, setOnly] = useState(search.listing);
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("all");
  const listings = all.filter((l) => (category === "All" || l.category === category) && (status === "all" || l.status === status) && (!only || l.id === only));

  const data = useMemo(() => {
    const per = listings.map((l) => {
      const daily = listingDaily(l.id, days);
      const t = totals(daily);
      return { l, daily, ...t, favRate: pct(t.favorites, t.views), buyRate: pct(t.purchases, t.favorites), conv: pct(t.purchases, t.views) };
    });
    const trend = (per[0]?.daily ?? []).map((d, i) => ({
      date: d.date.slice(5),
      views: per.reduce((a, p) => a + p.daily[i]!.views, 0),
      favorites: per.reduce((a, p) => a + p.daily[i]!.favorites, 0),
      purchases: per.reduce((a, p) => a + p.daily[i]!.purchases, 0),
    }));
    const sum = per.reduce((a, p) => ({ views: a.views + p.views, favorites: a.favorites + p.favorites, purchases: a.purchases + p.purchases }), { views: 0, favorites: 0, purchases: 0 });
    const sources = SOURCES.map((s) => {
      let v = 0, f = 0, b = 0;
      per.forEach((p) => { const x = sourceSplit(p.l.id).find((y) => y.source === s)!; v += p.views * x.share; f += p.favorites * x.share * x.conv; b += p.purchases * x.share * x.conv; });
      return { source: s, views: Math.round(v), favorites: Math.round(f), purchases: Math.round(b) };
    });
    const ranked = [...per].sort((a, b) => b.conv - a.conv);
    return { per, trend, sum, sources, best: ranked[0]?.l.id, worst: ranked.length > 1 ? ranked[ranked.length - 1]!.l.id : undefined };
  }, [listings.map((l) => l.id).join(), days]);

  const alerts = listings.flatMap((l) => detectDrops(l.id, alertCfg).map((a) => ({ ...a, title: l.title })));

  function exportCsv() {
    const rows = [["Listing", "Status", "Category", "Views", "Favorites", "Purchases", "View→Favorite %", "Favorite→Purchase %", "View→Purchase %"],
      ...data.per.map((p) => [p.l.title, p.l.status ?? "", p.l.category, p.views, p.favorites, p.purchases, p.favRate.toFixed(1), p.buyRate.toFixed(1), p.conv.toFixed(2)]),
      [], ["Source", "Views", "Favorites", "Purchases"], ...data.sources.map((s) => [s.source, s.views, s.favorites, s.purchases])];
    download(`creativestudio-analytics-${days}d.csv`, toCsv(rows));
  }
  function saveView() {
    const name = prompt("Name this view", `${days} days · ${category} · ${status}`)?.trim();
    if (!name) return;
    actions.saveView({ id: Date.now().toString(36), name: name.slice(0, 60), days, category, status });
    toast.success("View saved");
  }

  const sel = "rounded-full border border-border bg-background px-3 py-1.5 text-sm";
  return (
    <SiteShell>
      <PageTitle eyebrow="Creator analytics" title="Performance" sub="Sample data for now — live tracking starts once accounts are connected." />
      <div className="mx-auto max-w-7xl space-y-10 px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-full border border-border p-1">
            {[...new Set([...RANGES, days])].sort((a, b) => a - b).map((r) => <button key={r} onClick={() => setDays(r)} className={`rounded-full px-4 py-1 text-sm ${days === r ? "bg-primary text-primary-foreground" : ""}`}>{r} days</button>)}
          </div>
          <select className={sel} value={category} onChange={(e) => setCategory(e.target.value)}>{["All", ...categories].map((c) => <option key={c}>{c}</option>)}</select>
          <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All states</option><option value="published">Published</option><option value="draft">Drafts</option><option value="archived">Archived</option></select>
          {only && <button onClick={() => setOnly(undefined)} className="rounded-full bg-muted px-3 py-1.5 text-sm">Only: {all.find((l) => l.id === only)?.title ?? only} ×</button>}
          <button onClick={saveView} className={sel}>Save view</button>
          <button onClick={exportCsv} className="ml-auto flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"><Download className="h-4 w-4" />Export CSV</button>
          <Link to="/reports" className="text-sm underline">Email reports</Link>
          <Link to="/alerts" className="text-sm underline">Alerts</Link>
        </div>
        {saved.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="text-muted-foreground">Saved views:</span>
            {saved.map((v) => (
              <span key={v.id} className="flex items-center gap-2 rounded-full bg-muted px-3 py-1">
                <button onClick={() => { setDays(v.days); setCategory(v.category); setStatus(v.status); }}>{v.name}</button>
                <button aria-label="Delete view" onClick={() => actions.deleteView(v.id)} className="text-muted-foreground">×</button>
              </span>
            ))}
          </div>
        )}

        {alerts.length > 0 && (
          <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-5">
            <p className="flex items-center gap-2 font-medium text-destructive"><AlertTriangle className="h-4 w-4" />Sudden drops in the last {alertCfg.recent} days <Link to="/alerts" className="ml-auto text-sm font-normal underline">Manage alerts</Link></p>
            <ul className="mt-2 space-y-1 text-sm">{alerts.map((a) => <li key={a.listingId + a.metric}><b>{a.title}</b>: {a.metric} down {Math.round(-a.change * 100)}% vs the previous {alertCfg.prior} days</li>)}</ul>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          {[["Views", data.sum.views.toLocaleString()], ["Favorites", data.sum.favorites.toLocaleString()], ["Purchases", data.sum.purchases.toLocaleString()], ["Conversion", `${pct(data.sum.purchases, data.sum.views).toFixed(2)}%`]].map(([k, v]) => (
            <div key={k} className="rounded-sm border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{k}</p><p className="font-display text-4xl">{v}</p></div>
          ))}
        </div>

        <div className="rounded-sm border border-border bg-card p-5">
          <h2 className="mb-4 font-display text-2xl">Trends</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis yAxisId="l" fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis yAxisId="r" orientation="right" fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Legend />
                <Line yAxisId="l" dataKey="views" stroke="var(--secondary)" dot={false} strokeWidth={2} />
                <Line yAxisId="r" dataKey="favorites" stroke="var(--primary)" dot={false} strokeWidth={2} />
                <Line yAxisId="r" dataKey="purchases" stroke="var(--chart-4)" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-sm border border-border bg-card p-5">
          <h2 className="mb-4 font-display text-2xl">Listing breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="py-2">Listing</th><th>Views</th><th>Favorites</th><th>Purchases</th><th>View→Fav</th><th>Fav→Buy</th><th>Overall</th></tr></thead>
              <tbody>
                {data.per.map((p) => {
                  const best = p.l.id === data.best, worst = p.l.id === data.worst;
                  return (
                    <tr key={p.l.id} className={`border-t border-border ${best ? "bg-primary/10" : worst ? "bg-destructive/5" : ""}`}>
                      <td className="py-3"><span className="flex items-center gap-2">{best && <Trophy className="h-4 w-4 text-primary" />}{worst && <TrendingDown className="h-4 w-4 text-destructive" />}{p.l.title}</span></td>
                      <td>{p.views.toLocaleString()}</td><td>{p.favorites}</td><td>{p.purchases}</td>
                      <td><Bar v={p.favRate} max={20} />{p.favRate.toFixed(1)}%</td>
                      <td><Bar v={p.buyRate} max={50} />{p.buyRate.toFixed(1)}%</td>
                      <td className="font-medium">{p.conv.toFixed(2)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.best && <p className="mt-3 text-xs text-muted-foreground">Highlighted: strongest and weakest overall view→purchase conversion.</p>}
        </div>

        <div className="rounded-sm border border-border bg-card p-5">
          <h2 className="mb-4 font-display text-2xl">Referral sources</h2>
          <div className="space-y-3">
            {data.sources.map((s) => (
              <div key={s.source} className="grid grid-cols-[140px_1fr_auto] items-center gap-4 text-sm">
                <span>{s.source}</span>
                <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${pct(s.views, data.sum.views)}%` }} /></div>
                <span className="text-muted-foreground">{s.views.toLocaleString()} views · {s.favorites} favs · {s.purchases} sales</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

function Bar({ v, max }: { v: number; max: number }) {
  return <span className="mr-2 inline-block h-1.5 w-12 rounded-full bg-muted align-middle"><span className="block h-1.5 rounded-full bg-primary" style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></span>;
}
