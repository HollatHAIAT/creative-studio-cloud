import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Check, Minus } from "lucide-react";
import { SiteShell, PageTitle } from "@/components/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { categories, creatorOf, minPrice } from "@/lib/data";
import { useListings } from "@/lib/store";
import { useLocale } from "@/lib/i18n";
import { ActionButton, useAction } from "@/components/ActionButton";
import { explainMatch, type MatchExplanation } from "@/lib/match-explainer.functions";

export const Route = createFileRoute("/_authenticated/match-explainer")({
  head: () => ({
    meta: [
      { title: "Why this artwork fits — Arwiqa أروقة" },
      { name: "description", content: "See why a newly listed artwork matches your saved-search preferences." },
      { property: "og:title", content: "Why this artwork fits — Arwiqa أروقة" },
      { property: "og:description", content: "AI explanations of how new artworks match what you're looking for." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MatchExplainer,
});

type Saved = { id: string; name: string; keywords: string; categories: string[]; min_price: number | null; max_price: number | null };
const CAT_AR: Record<string, string> = { Painting: "رسم", Photography: "تصوير", Calligraphy: "خط عربي", Illustration: "رسوم توضيحية", Digital: "رقمي", Print: "مطبوعات" };
const input = "w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";
const num = (v: string) => (v.trim() === "" || isNaN(+v) ? null : +v);

function MatchExplainer() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const all = useListings();
  const call = useServerFn(explainMatch);
  const saved = useQuery({ queryKey: ["saved-searches"], queryFn: async () => {
    const { data } = await (supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }).from("saved_searches").select("*");
    return (data ?? []) as unknown as Saved[];
  } });

  const [c, setC] = useState({ keywords: "", categories: [] as string[], min: "", max: "", notes: "" });
  const [a, setA] = useState({ title: "", artist: "", category: "", medium: "", price: "", description: "" });
  const [res, setRes] = useState<MatchExplanation | null>(null);

  const loadSaved = (id: string) => {
    const s = saved.data?.find((x) => x.id === id); if (!s) return;
    setC({ ...c, keywords: s.keywords, categories: s.categories, min: s.min_price?.toString() ?? "", max: s.max_price?.toString() ?? "" });
  };
  const loadListing = (id: string) => {
    const l = all.find((x) => x.id === id); if (!l) return;
    setA({ title: (ar ? l.titleAr : l.title) ?? l.title, artist: creatorOf(l.creatorId)?.name ?? "", category: l.category, medium: l.medium, price: String(minPrice(l)), description: (ar ? l.descriptionAr : l.description) ?? l.description });
  };

  const act = useAction(async () => {
    const r = await call({ data: {
      criteria: { keywords: c.keywords, categories: c.categories, minPrice: num(c.min), maxPrice: num(c.max), notes: c.notes },
      artwork: { title: a.title, artist: a.artist, category: a.category, medium: a.medium, price: num(a.price), description: a.description },
    } });
    setRes(r);
    if (r.error) throw new Error(r.error);
  });
  const fitLabel = { strong: L("Strong fit", "تطابق قوي"), partial: L("Partial fit", "تطابق جزئي"), weak: L("Weak fit", "تطابق ضعيف") };

  return (
    <SiteShell>
      <PageTitle eyebrow={L("Saved searches", "عمليات البحث المحفوظة")} title={L("Why this artwork fits", "لماذا يناسبك هذا العمل")}
        sub={L("Enter your preferences and a new artwork's details — we'll explain how well they match.", "أدخل تفضيلاتك وتفاصيل العمل الجديد، وسنشرح مدى التطابق.")} />
      <form className="mx-auto grid max-w-5xl gap-10 px-6 pb-20 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (a.title.trim()) void act.run(); }}>
        <fieldset className="space-y-3">
          <legend className="mb-3 font-display text-xl">{L("Your preferences", "تفضيلاتك")}</legend>
          {!!saved.data?.length && (
            <select aria-label={L("Use a saved search", "استخدم بحثًا محفوظًا")} className={input} defaultValue="" onChange={(e) => loadSaved(e.target.value)}>
              <option value="" disabled>{L("Use a saved search…", "استخدم بحثًا محفوظًا…")}</option>
              {saved.data.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <label className="block text-sm">{L("Keywords", "كلمات مفتاحية")}
            <input className={input} value={c.keywords} maxLength={200} onChange={(e) => setC({ ...c, keywords: e.target.value })} /></label>
          <div role="group" aria-label={L("Categories", "الفئات")} className="flex flex-wrap gap-2">
            {categories.map((k) => { const on = c.categories.includes(k); return (
              <button key={k} type="button" aria-pressed={on} onClick={() => setC({ ...c, categories: on ? c.categories.filter((x) => x !== k) : [...c.categories, k] })}
                className={`rounded-full border px-3 py-1 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{ar ? CAT_AR[k] : k}</button>); })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">{L("Min price ($)", "أدنى سعر ($)")}<input inputMode="numeric" className={input} value={c.min} onChange={(e) => setC({ ...c, min: e.target.value })} /></label>
            <label className="text-sm">{L("Max price ($)", "أعلى سعر ($)")}<input inputMode="numeric" className={input} value={c.max} onChange={(e) => setC({ ...c, max: e.target.value })} /></label>
          </div>
          <label className="block text-sm">{L("Anything else (optional)", "أي تفاصيل أخرى (اختياري)")}
            <textarea rows={2} maxLength={500} className={input} value={c.notes} onChange={(e) => setC({ ...c, notes: e.target.value })} /></label>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-3 font-display text-xl">{L("New artwork", "العمل الجديد")}</legend>
          <select aria-label={L("Fill from a listing", "املأ من عمل معروض")} className={input} defaultValue="" onChange={(e) => loadListing(e.target.value)}>
            <option value="" disabled>{L("Fill from a listing…", "املأ من عمل معروض…")}</option>
            {all.map((l) => <option key={l.id} value={l.id}>{ar ? l.titleAr : l.title}</option>)}
          </select>
          <label className="block text-sm">{L("Title", "العنوان")} *<input required maxLength={160} className={input} value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">{L("Artist", "الفنان")}<input className={input} value={a.artist} onChange={(e) => setA({ ...a, artist: e.target.value })} /></label>
            <label className="text-sm">{L("Category", "الفئة")}<input className={input} value={a.category} onChange={(e) => setA({ ...a, category: e.target.value })} /></label>
            <label className="text-sm">{L("Medium", "الخامة")}<input className={input} value={a.medium} onChange={(e) => setA({ ...a, medium: e.target.value })} /></label>
            <label className="text-sm">{L("Price ($)", "السعر ($)")}<input inputMode="numeric" className={input} value={a.price} onChange={(e) => setA({ ...a, price: e.target.value })} /></label>
          </div>
          <label className="block text-sm">{L("Description", "الوصف")}
            <textarea rows={3} maxLength={2000} className={input} value={a.description} onChange={(e) => setA({ ...a, description: e.target.value })} /></label>
        </fieldset>

        <div className="md:col-span-2">
          <ActionButton type="submit" state={act.state} disabled={!a.title.trim()}
            loadingLabel={L("Explaining…", "جارٍ الشرح…")} successLabel={L("Done", "تم")}
            errorLabel={res?.error ?? L("Couldn't explain the match", "تعذّر شرح التطابق")}
            onRetry={act.retry} retryLabel={L("Try again", "حاول مجددًا")}
            className="rounded-md bg-primary px-5 py-2.5 text-primary-foreground">
            <Sparkles aria-hidden className="h-4 w-4" />{L("Explain the fit", "اشرح التطابق")}
          </ActionButton>

          {res && !res.error && (
            <section aria-live="polite" className="mt-10 border-t border-border pt-8">
              <p className="text-xs uppercase tracking-widest text-primary">{fitLabel[res.fit ?? "partial"]}</p>
              <p className="mt-3 max-w-3xl font-display text-2xl leading-snug">{ar ? res.summaryAr : res.summary}</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <ul className="space-y-2">{res.matches?.map((m, i) => <li key={i} className="flex gap-2 text-sm"><Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />{ar ? m.ar : m.en}</li>)}</ul>
                <ul className="space-y-2">{res.gaps?.map((m, i) => <li key={i} className="flex gap-2 text-sm text-muted-foreground"><Minus aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />{ar ? m.ar : m.en}</li>)}</ul>
              </div>
            </section>
          )}
        </div>
      </form>
    </SiteShell>
  );
}
