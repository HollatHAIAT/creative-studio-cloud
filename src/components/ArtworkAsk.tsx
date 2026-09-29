import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircleQuestion } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { askArtwork, type ArtworkAnswer } from "@/lib/artwork-qa.functions";

const SRC_AR: Record<string, string> = { description: "الوصف", creator: "الفنان", provenance: "المصدر", condition: "الحالة", heritage: "التراث", listing: "الإعلان" };

/** Buyer asks a question; AI answers only from this work's description, creator record, provenance and condition. */
export function ArtworkAsk({ listingId }: { listingId: string }) {
  const { locale } = useLocale(); const ar = locale === "ar"; const L = (e: string, a: string) => (ar ? a : e);
  const ask = useServerFn(askArtwork);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ArtworkAnswer | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const examples = [L("Is it in good condition?", "هل حالته جيدة؟"), L("What else has this artist made?", "ما أعمال الفنان الأخرى؟"), L("Where did it come from?", "ما مصدر العمل؟")];

  async function submit(question: string) {
    if (question.trim().length < 3 || busy) return;
    setBusy(true); setErr(null); setRes(null);
    try { const r = await ask({ data: { listingId, question: question.trim() } }); if (r.error) setErr(r.error); else setRes(r.result ?? null); }
    catch { setErr(L("Couldn't reach the assistant. Please try again.", "تعذّر الوصول إلى المساعد. حاول مجددًا.")); }
    finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="aa-h" className="mt-8 rounded-2xl border border-border p-5">
      <h2 id="aa-h" className="flex items-center gap-2 font-display text-xl"><MessageCircleQuestion aria-hidden className="h-5 w-5 text-primary" />{L("Ask about this artwork", "اسأل عن هذا العمل")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{L("AI answers only from this work's description, artist record, provenance and condition. It isn't a certification.", "يجيب الذكاء الاصطناعي من وصف العمل وسجل الفنان ومصدره وحالته فقط، وليس شهادة توثيق.")}</p>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void submit(q); }}>
        <label htmlFor="aa-q" className="sr-only">{L("Your question", "سؤالك")}</label>
        <input id="aa-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={800} placeholder={L("e.g. Has it been restored?", "مثال: هل رُمّم العمل؟")} className="w-full rounded-full border border-input bg-background px-4 py-2 text-sm" />
        <button disabled={busy || q.trim().length < 3} className="shrink-0 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? L("Thinking…", "جارٍ التفكير…") : L("Ask", "اسأل")}</button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">{examples.map((x) => <button key={x} type="button" onClick={() => { setQ(x); void submit(x); }} className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary">{x}</button>)}</div>
      <div aria-live="polite" className="mt-4 text-sm">
        {err && <p role="alert" className="text-destructive">{err}</p>}
        {res && (<>
          <p className="leading-relaxed">{ar ? res.answerAr || res.answer : res.answer}</p>
          {res.sources.length > 0 && <ul className="mt-3 space-y-1 text-muted-foreground">{res.sources.map((s, i) => <li key={i}><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{ar ? SRC_AR[s.source] ?? s.source : s.source}</span> {ar ? s.factAr || s.fact : s.fact}</li>)}</ul>}
          {res.askSeller.length > 0 && <div className="mt-3"><p className="font-medium">{L("Worth asking the seller", "يُستحسن سؤال البائع")}</p><ul className="ms-5 list-disc">{res.askSeller.map((a, i) => <li key={i}>{ar ? a.noteAr || a.note : a.note}</li>)}</ul></div>}
        </>)}
      </div>
    </section>
  );
}
