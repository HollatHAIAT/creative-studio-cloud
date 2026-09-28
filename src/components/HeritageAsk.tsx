import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Landmark, Sparkles } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { askHeritage, type HeritageAnswer } from "@/lib/heritage-qa.functions";

const EXAMPLES: [string, string][] = [
  ["Which Sadu pieces have documented provenance?", "أي قطع السدو لها مصدر موثّق؟"],
  ["Is there pottery from Al-Ahsa in good condition?", "هل يوجد فخار من الأحساء بحالة جيدة؟"],
  ["What do you know about the Asir Qatt works?", "ماذا تعرف عن أعمال القط العسيري؟"],
];

/** Shoppers: ask about heritage works; answers come only from recorded provenance, condition and region. */
export function HeritageAsk() {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const ask = useServerFn(askHeritage);
  const [q, setQ] = useState(""); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null); const [res, setRes] = useState<HeritageAnswer | null>(null);

  async function go(text = q) {
    if (busy || text.trim().length < 5) return; setBusy(true); setErr(null);
    try { const r = await ask({ data: { question: text } }); if (r.error) setErr(r.error); else setRes(r.result!); }
    catch { setErr(L("Couldn't reach the assistant. Try again.", "تعذّر الوصول إلى المساعد. حاول مجددًا.")); } finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="hq-h" className="mx-auto max-w-7xl px-6 py-12">
      <div className="rounded-3xl border border-border bg-card p-6 md:p-8">
        <h2 id="hq-h" className="flex items-center gap-2 font-display text-3xl"><Landmark aria-hidden className="h-6 w-6 text-primary" />{L("Ask about heritage works", "اسأل عن الأعمال التراثية")}</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">{L("Ask about provenance, condition or region. Answers use only what's recorded for live listings, and point you to matching works.", "اسأل عن المصدر أو الحالة أو المنطقة. تعتمد الإجابات فقط على المسجّل للإعلانات المتاحة، وتقترح أعمالًا مطابقة.")}</p>
        <form onSubmit={(e) => { e.preventDefault(); void go(); }} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={2} maxLength={1000} aria-label={L("Your question", "سؤالك")}
            placeholder={L("e.g. Which pieces come from Najd and have a condition report?", "مثال: أي القطع من نجد ولها تقرير حالة؟")}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3" />
          <button type="submit" disabled={busy || q.trim().length < 5} aria-busy={busy} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground disabled:opacity-50">
            <Sparkles aria-hidden className="h-4 w-4" />{busy ? L("Looking…", "جارٍ البحث…") : L("Ask", "اسأل")}
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">{EXAMPLES.map(([e, a]) => (
          <button key={e} type="button" onClick={() => { const t = L(e, a); setQ(t); void go(t); }} className="rounded-full border border-border px-3 py-1 text-sm hover:bg-muted">{L(e, a)}</button>))}</div>

        <div aria-live="polite" className="mt-6 space-y-5">
          {err && <p role="alert" className="text-destructive">{err} <button type="button" onClick={() => void go()} className="underline">{L("Try again", "حاول مجددًا")}</button></p>}
          {res && (<>
            <p className="text-lg">{ar ? res.answerAr || res.answer : res.answer}</p>
            {res.facts.length > 0 && (<div>
              <h3 className="text-sm font-medium">{L("Based on", "استنادًا إلى")}</h3>
              <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-muted-foreground">{res.facts.map((f, i) => <li key={i}>{ar ? f.factAr || f.fact : f.fact}</li>)}</ul>
            </div>)}
            {res.unknowns.length > 0 && (<div className="rounded-2xl bg-muted/50 p-3">
              <h3 className="text-sm font-medium">{L("Not recorded — ask the seller", "غير مسجّل — اسأل البائع")}</h3>
              <ul className="mt-1 list-disc space-y-1 ps-5 text-sm">{res.unknowns.map((u, i) => <li key={i}>{ar ? u.noteAr || u.note : u.note}</li>)}</ul>
            </div>)}
            {res.picks.length > 0 && (<div>
              <h3 className="font-medium">{L("Matching works", "أعمال مطابقة")}</h3>
              <ul className="mt-2 grid gap-3 sm:grid-cols-2">{res.picks.map((p) => (
                <li key={p.id}><a href={p.href} className="block h-full rounded-2xl border border-border p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                  <span className="block font-display text-lg">{ar ? p.titleAr : p.title}</span>
                  <span className="block text-sm text-muted-foreground">{L("From", "من")} ${p.price.toLocaleString()}</span>
                  <span className="mt-1 block text-sm">{ar ? p.reasonAr || p.reason : p.reason}</span>
                </a></li>))}</ul>
            </div>)}
            <p className="text-xs text-muted-foreground">{L("Guidance only — not an authentication or valuation. Check documents with the seller before buying.", "إرشاد فقط — ليس توثيقًا ولا تقييمًا. تحقّق من المستندات مع البائع قبل الشراء.")} <Link to="/heritage" className="underline">{L("Explore the heritage map", "استكشف خريطة التراث")}</Link></p>
          </>)}
        </div>
      </div>
    </section>
  );
}
