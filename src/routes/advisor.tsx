import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { SiteShell, ArtCard, PageTitle } from "@/components/SiteShell";
import { useListings } from "@/lib/store";
import { useLocale, type Key } from "@/lib/i18n";
import { categories, mediumGroup } from "@/lib/data";
import { recommendArtworks, type AdvisorResult } from "@/lib/advisor.functions";
import { ActionButton, useAction } from "@/components/ActionButton";

export const Route = createFileRoute("/advisor")({
  head: () => ({
    meta: [
      { title: "Art advisor — Arwiqa أروقة" },
      { name: "description", content: "Describe what you're looking for and get artwork recommendations from live listings." },
      { property: "og:title", content: "Art advisor — Arwiqa أروقة" },
      { property: "og:description", content: "Tell us your space, taste and budget — we'll suggest matching artworks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Advisor,
});

const EXAMPLES = [
  ["A calm piece for a living room, under $800", "عمل هادئ لغرفة المعيشة بأقل من ٨٠٠ دولار"],
  ["Calligraphy gift for my office", "هدية خط عربي لمكتبي"],
  ["Desert photography I can license for a website", "تصوير صحراوي يمكن ترخيصه لموقع إلكتروني"],
] as const;

const PRICES: { en: string; ar: string; min?: number; max?: number }[] = [
  { en: "Any price", ar: "أي سعر" },
  { en: "Under $100", ar: "أقل من ١٠٠$", max: 100 },
  { en: "$100 – 1,000", ar: "١٠٠ – ١٬٠٠٠$", min: 100, max: 1000 },
  { en: "$1,000 – 5,000", ar: "١٬٠٠٠ – ٥٬٠٠٠$", min: 1000, max: 5000 },
  { en: "$5,000+", ar: "+٥٬٠٠٠$", min: 5000 },
];

function Advisor() {
  const { locale, t, pick } = useLocale();
  const ar = locale === "ar";
  const all = useListings();
  const call = useServerFn(recommendArtworks);
  const [need, setNeed] = useState("");
  const [res, setRes] = useState<AdvisorResult | null>(null);
  const [price, setPrice] = useState(0);
  const [cats, setCats] = useState<string[]>([]);
  const [meds, setMeds] = useState<string[]>([]);
  const mediumOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of all) { const k = mediumGroup(a.medium); if (!m.has(k)) m.set(k, a.mediumAr ? mediumGroup(a.mediumAr).replace("،", ",").split(",")[0]!.trim() : k); }
    return [...m.entries()];
  }, [all]);
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const range = PRICES[price]!;
  const filterCount = (price ? 1 : 0) + cats.length + meds.length;
  const act = useAction(async () => {
    const r = await call({ data: { need, categories: cats, mediums: meds, ...(range.min != null ? { minPrice: range.min } : {}), ...(range.max != null ? { maxPrice: range.max } : {}) } });
    setRes(r);
    if (r.error) throw new Error(r.error);
  });
  const picks = (res?.picks ?? []).map((p) => ({ p, a: all.find((x) => x.id === p.id) })).filter((x) => x.a || x.p.seller);
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground"}`;

  return (
    <SiteShell>
      <PageTitle eyebrow={ar ? "مستشار فني" : "Art advisor"} title={ar ? "صِف ما تبحث عنه" : "Describe what you need"}
        sub={ar ? "اكتب المكان والذوق والميزانية، وسنقترح أعمالًا من المعروض حاليًا، ومنها إعلانات البائعين." : "Tell us the space, mood and budget — we'll suggest works from live listings, including sellers' own listings."} />
      <div className="mx-auto max-w-4xl px-6 pb-20">
        <form onSubmit={(e) => { e.preventDefault(); if (need.trim().length >= 3) void act.run(); }} className="space-y-3">
          <label htmlFor="need" className="sr-only">{ar ? "ما تبحث عنه" : "What you need"}</label>
          <textarea id="need" value={need} onChange={(e) => setNeed(e.target.value)} maxLength={1000} rows={4}
            placeholder={ar ? "مثال: لوحة بألوان دافئة لمدخل المنزل بأقل من ١٠٠٠ دولار" : "e.g. A warm-toned painting for my entrance, under $1,000"}
            className="w-full rounded-md border border-border bg-card p-4 text-base outline-none focus:border-primary" />
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button key={ex[0]} type="button" onClick={() => setNeed(ar ? ex[1] : ex[0])}
                className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:border-primary hover:text-foreground">{ar ? ex[1] : ex[0]}</button>
            ))}
          </div>
          <fieldset className="space-y-4 border-t border-border pt-5">
            <legend className="flex w-full items-center justify-between pt-5 text-sm font-medium">
              <span>{ar ? "تضييق النتائج" : "Narrow the results"}{filterCount > 0 && <span className="ms-2 text-muted-foreground">({filterCount})</span>}</span>
            </legend>
            <div role="group" aria-label={ar ? "السعر" : "Price"} className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-xs uppercase tracking-wider text-muted-foreground">{ar ? "السعر" : "Price"}</span>
              {PRICES.map((p, i) => <button key={p.en} type="button" aria-pressed={price === i} onClick={() => setPrice(i)} className={chip(price === i)}>{ar ? p.ar : p.en}</button>)}
            </div>
            <div role="group" aria-label={ar ? "الفئة" : "Category"} className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-xs uppercase tracking-wider text-muted-foreground">{ar ? "الفئة" : "Category"}</span>
              {categories.map((c) => <button key={c} type="button" aria-pressed={cats.includes(c)} onClick={() => toggle(cats, setCats, c)} className={chip(cats.includes(c))}>{t(`cat.${c}` as Key)}</button>)}
            </div>
            <div role="group" aria-label={ar ? "الخامة" : "Medium"} className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-xs uppercase tracking-wider text-muted-foreground">{ar ? "الخامة" : "Medium"}</span>
              {mediumOptions.map(([k, arLabel]) => <button key={k} type="button" aria-pressed={meds.includes(k)} onClick={() => toggle(meds, setMeds, k)} className={chip(meds.includes(k))}>{ar ? arLabel : k}</button>)}
            </div>
            {filterCount > 0 && <button type="button" onClick={() => { setPrice(0); setCats([]); setMeds([]); }} className="text-sm underline">{ar ? "مسح الفلاتر" : "Clear filters"}</button>}
          </fieldset>
          <ActionButton type="submit" state={act.state} disabled={need.trim().length < 3}
            loadingLabel={ar ? "جارٍ البحث…" : "Finding matches…"} successLabel={ar ? "تم" : "Done"}
            errorLabel={res?.error ?? (ar ? "تعذّر الحصول على اقتراحات" : "Couldn't get suggestions")}
            onRetry={act.retry} retryLabel={ar ? "حاول مجددًا" : "Try again"}
            className="rounded-md bg-primary px-5 py-2.5 text-primary-foreground">
            <Sparkles aria-hidden className="h-4 w-4" />{ar ? "اقترح أعمالًا" : "Recommend artworks"}
          </ActionButton>
        </form>

        {res && !res.error && (
          <section aria-live="polite" className="mt-12">
            {picks.length === 0 ? (
              <p className="text-muted-foreground">{res.noneLive ? (ar ? "لا توجد أعمال معروضة تطابق الفلاتر — جرّب توسيعها." : "No live listings match these filters — try widening them.") : (ar ? "لم نجد تطابقًا — جرّب وصفًا آخر." : "No close matches — try describing it differently.")}</p>
            ) : (
              <div className="grid gap-8 sm:grid-cols-2">
                {picks.map(({ p, a }) => (
                  <div key={p.id} className="space-y-3">
                    {a ? <ArtCard a={a} /> : (
                      <Link to="/listing/$id" params={{ id: p.id }} className="group block">
                        <div className="aspect-[4/5] overflow-hidden rounded-md bg-muted">
                          {p.seller!.imageUrl && <img src={p.seller!.imageUrl} alt={ar ? p.seller!.titleAr : p.seller!.title} className="h-full w-full object-cover transition group-hover:scale-105" />}
                        </div>
                        <div className="mt-3 flex items-baseline justify-between gap-3">
                          <h3 className="font-display text-lg">{ar ? p.seller!.titleAr : p.seller!.title}</h3>
                          <span className="text-sm">${p.seller!.price.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{ar ? "إعلان بائع" : "Seller listing"} · {p.seller!.medium}</p>
                      </Link>
                    )}
                    <p className="border-s-2 border-accent ps-3 text-sm text-muted-foreground">{ar ? p.reasonAr : p.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </SiteShell>
  );
}
