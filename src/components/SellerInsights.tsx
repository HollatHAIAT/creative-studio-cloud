import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocale } from "@/lib/i18n";

const sb = supabase as any;
type Row = { day: string; listing_id: string; units: number; revenue: number };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

function csv(name: string, rows: (string | number)[][]) {
  const text = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

/** Sales over time, period comparison, per-artwork performance and CSV — for the signed-in seller's own listings. */
export function SellerSales({ listings, views }: { listings: { id: string; title: string }[]; views: Record<string, number> }) {
  const { locale, num } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const [days, setDays] = useState(30);
  const [pid, setPid] = useState("all");
  const to = new Date(); const from = addDays(to, -(days - 1)); const pFrom = addDays(from, -days); const pTo = addDays(from, -1);
  const q = useQuery({
    queryKey: ["seller-sales", days],
    queryFn: async () => {
      const [cur, prev] = await Promise.all([
        sb.rpc("seller_sales", { _from: iso(from), _to: iso(to) }),
        sb.rpc("seller_sales", { _from: iso(pFrom), _to: iso(pTo) }),
      ]);
      if (cur.error) throw cur.error;
      return { cur: (cur.data ?? []) as Row[], prev: (prev.data ?? []) as Row[] };
    },
  });
  const name = (id: string) => listings.find((l) => l.id === id)?.title ?? id;
  const pick = (r: Row[]) => r.filter((x) => pid === "all" || x.listing_id === pid);
  const cur = pick(q.data?.cur ?? []), prev = pick(q.data?.prev ?? []);
  const tot = (r: Row[]) => ({ units: r.reduce((s, x) => s + x.units, 0), revenue: r.reduce((s, x) => s + Number(x.revenue), 0) });
  const c = tot(cur), p = tot(prev);
  const series = useMemo(() => Array.from({ length: days }, (_, i) => { const d = iso(addDays(from, i)); return { d, v: cur.filter((x) => x.day === d).reduce((s, x) => s + Number(x.revenue), 0) }; }), [cur, days]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(1, ...series.map((s) => s.v));
  const byListing = listings.filter((l) => pid === "all" || l.id === pid).map((l) => {
    const r = tot(cur.filter((x) => x.listing_id === l.id)); const v = views[l.id] ?? 0;
    return { ...l, ...r, views: v, conv: v ? (r.units / v) * 100 : null };
  }).sort((a, b) => b.revenue - a.revenue);
  const delta = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);
  const money = (n: number) => `$${num(Math.round(n))}`;
  const card = "rounded-2xl border border-border p-4";
  const sel = "rounded-full border border-border bg-background px-3 py-1.5 text-sm";

  return (
    <section aria-labelledby="sd-sales" className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sd-sales" className="font-display text-xl">{L("Sales & performance", "المبيعات والأداء")}</h2>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="ss-days">{L("Period", "الفترة")}</label>
          <select id="ss-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className={sel}>
            {[7, 30, 90, 365].map((n) => <option key={n} value={n}>{L(`Last ${n} days`, `آخر ${n} يومًا`)}</option>)}
          </select>
          <label className="sr-only" htmlFor="ss-pid">{L("Artwork", "العمل")}</label>
          <select id="ss-pid" value={pid} onChange={(e) => setPid(e.target.value)} className={sel}>
            <option value="all">{L("All artworks", "كل الأعمال")}</option>
            {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
          <button type="button" className={`${sel} inline-flex items-center gap-1`} onClick={() => {
            if (!byListing.length) { toast.info(L("Nothing to export", "لا شيء للتصدير")); return; }
            csv(`arwiqa-sales-${iso(from)}_${iso(to)}.csv`, [
              [L("Artwork", "العمل"), L("Units", "الوحدات"), L("Revenue (USD)", "الإيراد (دولار)"), L("Views", "المشاهدات"), L("Conversion %", "التحويل ٪")],
              ...byListing.map((r) => [r.title, r.units, r.revenue, r.views, r.conv == null ? "" : r.conv.toFixed(1)]),
              [], [L("Day", "اليوم"), L("Revenue (USD)", "الإيراد (دولار)")], ...series.map((s) => [s.d, s.v]),
            ]);
          }}><Download aria-hidden className="h-4 w-4" />CSV</button>
        </div>
      </div>
      {q.isLoading ? <p className="mt-4 text-sm text-muted-foreground">{L("Loading sales…", "جارٍ تحميل المبيعات…")}</p>
        : q.error ? <p role="alert" className="mt-4 text-sm text-destructive">{L("Couldn't load sales.", "تعذّر تحميل المبيعات.")}</p> : (<>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[[L("Revenue", "الإيراد"), money(c.revenue), delta(c.revenue, p.revenue)], [L("Units sold", "وحدات مباعة"), num(c.units), delta(c.units, p.units)],
            [L("Previous period", "الفترة السابقة"), money(p.revenue), null]].map(([l, v, d], i) => (
            <div key={i} className="rounded-xl bg-muted/40 p-3">
              <p className="text-sm text-muted-foreground">{l}</p><p className="font-display text-2xl">{v}</p>
              {d != null && <p className={`text-xs ${Number(d) >= 0 ? "text-success" : "text-destructive"}`}>{Number(d) >= 0 ? "▲" : "▼"} {num(Math.abs(Number(d)))}% {L("vs previous period", "مقارنة بالفترة السابقة")}</p>}
            </div>))}
        </div>
        <figure className="mt-5">
          <div role="img" aria-label={L(`Daily revenue, total ${money(c.revenue)}`, `الإيراد اليومي، الإجمالي ${money(c.revenue)}`)} className="flex h-32 items-end gap-px" dir="ltr">
            {series.map((s) => <div key={s.d} title={`${s.d}: ${money(s.v)}`} className="flex-1 rounded-t-sm bg-primary/80" style={{ height: `${Math.max(2, (s.v / max) * 100)}%`, opacity: s.v ? 1 : 0.2 }} />)}
          </div>
          <figcaption className="mt-1 flex justify-between text-xs text-muted-foreground" dir="ltr"><span>{iso(from)}</span><span>{iso(to)}</span></figcaption>
        </figure>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{L("Performance by artwork", "الأداء حسب العمل")}</caption>
            <thead><tr className="text-start text-muted-foreground">{[L("Artwork", "العمل"), L("Units", "الوحدات"), L("Revenue", "الإيراد"), L("Views", "المشاهدات"), L("Conversion", "التحويل")].map((h) => <th key={h} className="py-2 text-start font-normal">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">{byListing.map((r) => (
              <tr key={r.id}><td className="py-2">{r.title}</td><td>{num(r.units)}</td><td>{money(r.revenue)}</td><td>{num(r.views)}</td><td>{r.conv == null ? "—" : `${num(Math.round(r.conv * 10) / 10)}%`}</td></tr>))}
              {!byListing.length && <tr><td colSpan={5} className="py-3 text-muted-foreground">{L("No live artworks yet.", "لا أعمال منشورة بعد.")}</td></tr>}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">{L("Views are counted on this device only until page-view tracking is added.", "تُحسب المشاهدات على هذا الجهاز فقط حتى تُضاف متابعة الزيارات.")} {name("")}</p>
        </div>
      </>)}
    </section>
  );
}

/** Stock change history (manual edits and automatic sales). */
export function InventoryHistory({ listings }: { listings: { id: string; title: string }[] }) {
  const { locale, num } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const ids = listings.map((l) => l.id);
  const q = useQuery({
    queryKey: ["inventory-history", ids.join(",")], enabled: ids.length > 0,
    queryFn: async () => { const { data, error } = await sb.from("inventory_adjustments").select("*").in("listing_id", ids).order("created_at", { ascending: false }).limit(50); if (error) throw error; return data as any[]; },
  });
  const src: Record<string, [string, string]> = { manual: ["Manual edit", "تعديل يدوي"], sale: ["Sale", "بيع"], restock: ["Restock", "إعادة تخزين"] };
  const fmtS = (n: number | null) => (n == null ? L("not tracked", "غير متتبَّع") : num(n));
  return (
    <section aria-labelledby="sd-inv" className="rounded-2xl border border-border p-4">
      <h2 id="sd-inv" className="font-display text-xl">{L("Stock history", "سجل المخزون")}</h2>
      <p className="text-sm text-muted-foreground">{L("Stock goes down automatically when an order is paid. Sold-out works show as unavailable in the shop.", "ينقص المخزون تلقائيًا عند دفع الطلب، وتظهر الأعمال النافدة غير متاحة في المتجر.")}</p>
      <ul className="mt-3 divide-y divide-border text-sm">
        {(q.data ?? []).map((r) => (
          <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
            <span><span className="font-medium">{listings.find((l) => l.id === r.listing_id)?.title}</span> · {fmtS(r.from_stock)} → {fmtS(r.to_stock)} · {L(...(src[r.source] ?? [r.source, r.source]))}{r.reason ? ` — ${r.reason}` : ""}</span>
            <time dateTime={r.created_at} className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString(ar ? "ar-SA" : "en-US")}</time>
          </li>))}
        {q.data && !q.data.length && <li className="py-2 text-muted-foreground">{L("No stock changes yet.", "لا تغييرات على المخزون بعد.")}</li>}
        {q.isLoading && ids.length > 0 && <li className="py-2 text-muted-foreground">{L("Loading…", "جارٍ التحميل…")}</li>}
      </ul>
    </section>
  );
}

/** Answer buyer offers and questions without leaving the dashboard. */
export function OffersInbox({ listings, onChanged }: { listings: { id: string; title: string }[]; onChanged: () => void }) {
  const { locale, num } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const ids = listings.map((l) => l.id);
  const q = useQuery({
    queryKey: ["seller-inbox", ids.join(",")], enabled: ids.length > 0,
    queryFn: async () => {
      const [o, i] = await Promise.all([
        sb.from("offers").select("id,listing_id,amount,message,status,created_at").in("listing_id", ids).eq("status", "pending").order("created_at"),
        sb.from("inquiries").select("id,listing_id,message,created_at").in("listing_id", ids).is("reply", null).order("created_at"),
      ]);
      return { offers: (o.data ?? []) as any[], inquiries: (i.data ?? []) as any[] };
    },
  });
  const [text, setText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const t = (id: string) => listings.find((l) => l.id === id)?.title ?? id;
  const run = async (id: string, p: PromiseLike<{ error: unknown }>, ok: string) => {
    setBusy(id); const { error } = await p; setBusy(null);
    if (error) { toast.error(L("Couldn't save — try again.", "تعذّر الحفظ — حاول مجددًا.")); return; }
    toast.success(ok); setText((s) => ({ ...s, [id]: "" })); void q.refetch(); onChanged();
  };
  const field = "w-full rounded-lg border border-input bg-background px-2 py-1 text-sm";
  const d = q.data;
  return (
    <section aria-labelledby="sd-inbox" className="rounded-2xl border border-border p-4">
      <h2 id="sd-inbox" className="font-display text-xl">{L("Offers & questions", "العروض والأسئلة")}</h2>
      {!d || (!d.offers.length && !d.inquiries.length) ? <p className="mt-2 text-sm text-muted-foreground">{q.isLoading ? L("Loading…", "جارٍ التحميل…") : L("Nothing waiting for you.", "لا شيء بانتظارك.")}</p> : (
        <ul className="mt-3 space-y-3 text-sm">
          {d.offers.map((o) => (
            <li key={o.id} className="rounded-xl bg-muted/40 p-3">
              <p><strong>{L("Offer", "عرض")} ${num(Number(o.amount))}</strong> · {t(o.listing_id)}</p>
              {o.message && <p className="mt-1 text-muted-foreground">“{o.message}”</p>}
              <label className="sr-only" htmlFor={`of-${o.id}`}>{L("Note to buyer", "ملاحظة للمشتري")}</label>
              <input id={`of-${o.id}`} className={`${field} mt-2`} placeholder={L("Note to buyer (optional)", "ملاحظة للمشتري (اختياري)")} value={text[o.id] ?? ""} onChange={(e) => setText({ ...text, [o.id]: e.target.value })} maxLength={500} />
              <div className="mt-2 flex gap-2">
                <button disabled={busy === o.id} className="rounded-full bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50" onClick={() => void run(o.id, sb.from("offers").update({ status: "accepted", response: text[o.id]?.trim() || null }).eq("id", o.id), L("Offer accepted — buyer notified", "قُبل العرض — أُبلغ المشتري"))}>{L("Accept", "اقبل")}</button>
                <button disabled={busy === o.id} className="rounded-full border border-border px-3 py-1 disabled:opacity-50" onClick={() => void run(o.id, sb.from("offers").update({ status: "declined", response: text[o.id]?.trim() || null }).eq("id", o.id), L("Offer declined — buyer notified", "رُفض العرض — أُبلغ المشتري"))}>{L("Decline", "ارفض")}</button>
              </div>
            </li>))}
          {d.inquiries.map((i) => (
            <li key={i.id} className="rounded-xl bg-muted/40 p-3">
              <p><strong>{L("Question", "سؤال")}</strong> · {t(i.listing_id)}</p>
              <p className="mt-1">“{i.message}”</p>
              <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const r = text[i.id]?.trim(); if (!r) return; void run(i.id, sb.from("inquiries").update({ reply: r, replied_at: new Date().toISOString() }).eq("id", i.id), L("Reply sent", "أُرسل الرد")); }}>
                <label className="sr-only" htmlFor={`iq-${i.id}`}>{L("Your reply", "ردّك")}</label>
                <input id={`iq-${i.id}`} className={field} required maxLength={2000} value={text[i.id] ?? ""} onChange={(e) => setText({ ...text, [i.id]: e.target.value })} placeholder={L("Your reply", "ردّك")} />
                <button disabled={busy === i.id} className="rounded-full bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50">{L("Reply", "ردّ")}</button>
              </form>
            </li>))}
        </ul>)}
    </section>
  );
}
