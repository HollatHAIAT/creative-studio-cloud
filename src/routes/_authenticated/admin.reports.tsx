import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { StaffGate } from "@/components/StaffGate";
import { supabase } from "@/integrations/supabase/client";
import { useLocale, type Key } from "@/lib/i18n";
import { downloadText, itemsOf, toCsv } from "@/lib/orders";
import { fmt } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [
    { title: "Admin reports — Arwiqa أروقة" }, { name: "description", content: "Sales, orders, ticket activity and bids with date filters and CSV export." },
    { property: "og:title", content: "Admin reports — Arwiqa أروقة" }, { property: "og:description", content: "Staff reports." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: () => <StaffGate><Reports /></StaffGate>,
});

const iso = (d: Date) => d.toISOString().slice(0, 10);
const PAID = ["paid", "processing", "shipped", "delivered", "completed"];

function Reports() {
  const { t, num } = useLocale();
  const [from, setFrom] = useState(iso(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(iso(new Date()));
  const start = `${from}T00:00:00Z`, end = `${to}T23:59:59Z`;
  const q = useQuery({
    queryKey: ["admin", "reports", from, to],
    queryFn: async () => {
      const [o, b, tk, sc] = await Promise.all([
        supabase.from("orders").select("id, reference, created_at, status, total, items").gte("created_at", start).lte("created_at", end).limit(5000),
        supabase.from("bids").select("id, auction_id, amount, created_at, bidder_name").gte("created_at", start).lte("created_at", end).limit(5000),
        supabase.from("tickets").select("id, status, ticket_type, created_at, used_at").gte("created_at", start).lte("created_at", end).limit(5000),
        supabase.from("ticket_scans").select("id, code, result, created_at").gte("created_at", start).lte("created_at", end).limit(5000),
      ]);
      return { orders: o.data ?? [], bids: b.data ?? [], tickets: tk.data ?? [], scans: sc.data ?? [] };
    },
  });
  const d = q.data;
  const paid = (d?.orders ?? []).filter((o) => PAID.includes(o.status));
  const revenue = paid.reduce((s, o) => s + Number(o.total), 0);
  const byStatus = Object.entries((d?.orders ?? []).reduce<Record<string, number>>((m, o) => ({ ...m, [o.status]: (m[o.status] ?? 0) + 1 }), {})).map(([k, v]) => ({ name: t(`st.${k}` as Key), v }));
  const byKind = Object.entries(paid.flatMap((o) => itemsOf(o.items)).reduce<Record<string, number>>((m, i) => ({ ...m, [i.kind]: (m[i.kind] ?? 0) + i.amount }), {})).map(([name, v]) => ({ name, v }));
  const checkins = (d?.scans ?? []).filter((s) => s.result === "valid").length;

  const exportAll = () => {
    if (!d) return;
    const rows: (string | number)[][] = [["section", "id", "date", "status_or_result", "type", "amount"]];
    d.orders.forEach((o) => rows.push(["order", o.reference, o.created_at, o.status, itemsOf(o.items).map((i) => i.kind).join("|"), Number(o.total)]));
    d.tickets.forEach((x) => rows.push(["ticket", x.id, x.created_at, x.status, x.ticket_type, ""]));
    d.scans.forEach((x) => rows.push(["scan", x.code, x.created_at, x.result, "", ""]));
    d.bids.forEach((x) => rows.push(["bid", x.auction_id, x.created_at, x.bidder_name, "", Number(x.amount)]));
    downloadText(toCsv(rows), `Arwiqa-report-${from}-${to}.csv`);
  };

  const card = "rounded-sm border border-border bg-card p-5";
  return (
    <SiteShell>
      <PageTitle eyebrow={t("nav.admin")} title={t("adm.reports")} />
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-6 flex flex-wrap items-end gap-3 text-sm">
          <label>{t("adm.from")}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="block rounded-sm border border-border bg-background px-3 py-1.5" /></label>
          <label>{t("adm.to")}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="block rounded-sm border border-border bg-background px-3 py-1.5" /></label>
          <button onClick={exportAll} className="rounded-full bg-primary px-5 py-2 text-primary-foreground">{t("adm.export")}</button>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className={card}><p className="text-xs text-muted-foreground">{t("adm.sales")}</p><p className="font-display text-3xl">{fmt(Math.round(revenue))}</p></div>
          <div className={card}><p className="text-xs text-muted-foreground">{t("adm.orderCount")}</p><p className="font-display text-3xl">{num(d?.orders.length ?? 0)}</p></div>
          <div className={card}><p className="text-xs text-muted-foreground">{t("adm.ticketsSold")}</p><p className="font-display text-3xl">{num(d?.tickets.length ?? 0)}</p></div>
          <div className={card}><p className="text-xs text-muted-foreground">{t("adm.checkins")}</p><p className="font-display text-3xl">{num(checkins)}</p></div>
          <div className={card}><p className="text-xs text-muted-foreground">{t("adm.bids")}</p><p className="font-display text-3xl">{num(d?.bids.length ?? 0)}</p></div>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {[{ title: t("adm.byStatus"), data: byStatus }, { title: t("adm.byKind"), data: byKind }].map((c) => (
            <div key={c.title} className={card}>
              <p className="mb-3 font-display text-xl">{c.title}</p>
              <div className="h-64" dir="ltr">
                <ResponsiveContainer><BarChart data={c.data}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="v" fill="var(--primary)" /></BarChart></ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
