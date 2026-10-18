import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, X, Crown } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { useLocale } from "@/lib/i18n";
import { useListings, useStore } from "@/lib/store";
import { compareArtworks, type CompareResult } from "@/lib/compare.functions";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare artworks side by side — Arwiqa أروقة" },
      { name: "description", content: "Pick up to four artworks, describe your style, budget and room, and get a personal side-by-side comparison." },
      { property: "og:title", content: "Compare artworks — Arwiqa" },
      { property: "og:description", content: "A personal AI comparison of the artworks you're considering." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Compare,
});

function Compare() {
  const { locale, pick, money } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const all = useListings();
  const { favorites } = useStore();
  const [sel, setSel] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [style, setStyle] = useState(""); const [budget, setBudget] = useState(""); const [room, setRoom] = useState("");
  const [busy, setBusy] = useState(false); const [res, setRes] = useState<CompareResult | null>(null);
  const run = useServerFn(compareArtworks);

  // Start from the buyer's favorites (after hydration; favorites live in the browser).
  useEffect(() => { if (!sel.length && favorites.length) setSel(favorites.filter((id) => all.some((a) => a.id === id)).slice(0, 4)); }, [favorites.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => { setRes(null); setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]); };
  const chosen = sel.map((id) => all.find((a) => a.id === id)!).filter(Boolean);
  const term = q.trim().toLowerCase();
  const options = all.filter((a) => !term || a.title.toLowerCase().includes(term) || (a.titleAr ?? "").includes(q.trim()) || a.artist.toLowerCase().includes(term)).slice(0, 24);
  const canRun = chosen.length >= 2 && (style.trim() || room.trim() || budget) && !busy;

  const submit = async () => {
    setBusy(true); setRes(null);
    try { setRes(await run({ data: { ids: sel, style, room, budget: budget ? Number(budget) : undefined } })); }
    catch { setRes({ error: L("Couldn't compare right now.", "تعذّرت المقارنة الآن.") }); }
    finally { setBusy(false); }
  };
  const rowFor = (id: string) => res?.rows?.find((r) => r.id === id);
  const lines: [string, "style" | "budget" | "room" | "pros" | "cons"][] = [[L("Style", "الأسلوب"), "style"], [L("Budget", "الميزانية"), "budget"], [L("Your room", "مساحتك"), "room"], [L("Strength", "نقطة القوة"), "pros"], [L("Watch out", "انتبه إلى"), "cons"]];

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Art advisor", "مستشار الفن")} title={L("Compare side by side", "قارن جنبًا إلى جنب")}
        sub={L("Choose 2–4 artworks, tell us your style, budget and room, and get a personal comparison.", "اختر من ٢ إلى ٤ أعمال، وأخبرنا بذوقك وميزانيتك ومساحتك، واحصل على مقارنة مخصّصة لك.")} />
      <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-[1fr_360px]">
        <section aria-labelledby="pick-h">
          <h2 id="pick-h" className="font-display text-xl">{L(`Your selection (${chosen.length}/4)`, `اختيارك (${chosen.length}/٤)`)}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {chosen.length === 0 && <p className="text-sm text-muted-foreground">{L("Tap artworks below to add them.", "اضغط على الأعمال أدناه لإضافتها.")}</p>}
            {chosen.map((a) => <button key={a.id} type="button" onClick={() => toggle(a.id)} className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-3 py-1 text-sm">{pick(a, "title")}<X aria-label={L("Remove", "إزالة")} className="h-3.5 w-3.5" /></button>)}
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L("Search by title or artist", "ابحث بالعنوان أو الفنان")} aria-label={L("Search artworks", "ابحث في الأعمال")} className="mt-4 w-full rounded-md border border-input bg-background px-3 py-2" />
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {options.map((a) => { const on = sel.includes(a.id); return (
              <button key={a.id} type="button" aria-pressed={on} onClick={() => toggle(a.id)} disabled={!on && sel.length >= 4}
                className={`overflow-hidden rounded-xl border text-start transition disabled:opacity-40 ${on ? "border-primary ring-2 ring-primary" : "border-border hover:border-primary"}`}>
                <img src={a.image} alt="" className="aspect-[4/5] w-full object-cover" loading="lazy" />
                <span className="block p-2 text-xs"><span className="block truncate font-medium">{pick(a, "title")}</span><span className="text-muted-foreground">{money(a.price)}</span></span>
              </button>); })}
          </div>
        </section>
        <aside className="space-y-3 rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-24 lg:self-start">
          <label className="block text-sm">{L("Your style", "ذوقك")}<textarea rows={2} maxLength={500} value={style} onChange={(e) => setStyle(e.target.value)} placeholder={L("e.g. calm, earthy colours, modern Najdi", "مثال: هادئ، ألوان ترابية، نجدي معاصر")} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" /></label>
          <label className="block text-sm">{L("Budget (USD)", "الميزانية (دولار)")}<input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" /></label>
          <label className="block text-sm">{L("Your room", "مساحتك")}<textarea rows={3} maxLength={500} value={room} onChange={(e) => setRoom(e.target.value)} placeholder={L("e.g. living room, 3 m white wall, north light", "مثال: مجلس، جدار أبيض ٣ أمتار، إضاءة شمالية")} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" /></label>
          <button type="button" onClick={submit} disabled={!canRun} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground disabled:opacity-50">
            <Sparkles aria-hidden className="h-4 w-4" />{busy ? L("Comparing…", "جارٍ المقارنة…") : L("Compare for me", "قارن لي")}</button>
          {chosen.length < 2 && <p className="text-xs text-muted-foreground">{L("Pick at least two artworks.", "اختر عملين على الأقل.")}</p>}
        </aside>
      </div>

      {res?.error && <p role="alert" className="mx-auto mt-8 max-w-7xl px-6 text-sm text-destructive">{res.error}</p>}
      {res?.rows && (
        <section aria-labelledby="cmp-h" className="mx-auto mt-10 max-w-7xl px-6">
          <h2 id="cmp-h" className="font-display text-2xl">{L("Your comparison", "مقارنتك")}</h2>
          <p className="mt-2 max-w-3xl">{ar ? res.verdictAr : res.verdict}</p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-x-3 text-sm">
              <thead><tr><th className="w-28" />{chosen.map((a) => (
                <th key={a.id} className="align-top font-normal">
                  <Link to="/artwork/$id" params={{ id: a.id }} className="block rounded-xl border border-border p-2 text-start hover:border-primary">
                    <img src={a.image} alt={pick(a, "title")} className="aspect-[4/3] w-full rounded-lg object-cover" />
                    <span className="mt-2 flex items-center gap-1 font-medium">{res.bestId === a.id && <Crown aria-label={L("Best fit", "الأنسب")} className="h-4 w-4 text-gold" />}{pick(a, "title")}</span>
                    <span className="text-muted-foreground">{L("from", "من")} {money(a.price)}</span>
                  </Link>
                </th>))}</tr></thead>
              <tbody>
                <tr><th className="py-3 text-start">{L("Match", "التوافق")}</th>{chosen.map((a) => { const f = rowFor(a.id)?.fit ?? 0; return (
                  <td key={a.id} className="py-3"><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${f}%` }} /></div><span className="text-xs">{f}%</span></td>); })}</tr>
                {lines.map(([label, k]) => (
                  <tr key={k}><th className="border-t border-border py-3 text-start align-top">{label}</th>
                    {chosen.map((a) => { const r = rowFor(a.id); return <td key={a.id} className="border-t border-border py-3 align-top">{r ? (ar ? r[`${k}Ar`] : r[k]) : "—"}</td>; })}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{L("AI suggestions based on each listing's details — check sizes and condition on the artwork page.", "اقتراحات بالذكاء الاصطناعي مبنية على بيانات كل إعلان — تحقّق من المقاس والحالة في صفحة العمل.")}</p>
        </section>
      )}
    </SiteShell>
  );
}
